import Capacitor
import HealthKit
import UIKit

@objc(WellnessHealthPlugin)
final class WellnessHealthPlugin: CAPPlugin, CAPBridgedPlugin {
    let identifier = "WellnessHealthPlugin"
    let jsName = "WellnessHealth"
    let pluginMethods = ["status", "requestRead", "openSettings", "read"].map {
        CAPPluginMethod(name: $0, returnType: CAPPluginReturnPromise)
    }

    private lazy var store = HKHealthStore()
    private let quantities: [String: (HKQuantityTypeIdentifier, HKUnit, HKStatisticsOptions)] = [
        "steps": (.stepCount, .count(), .cumulativeSum),
        "distance": (.distanceWalkingRunning, .meter(), .cumulativeSum),
        "active_energy": (.activeEnergyBurned, .kilocalorie(), .cumulativeSum),
        "heart_rate": (.heartRate, .count().unitDivided(by: .minute()), .discreteAverage),
        "resting_heart_rate": (.restingHeartRate, .count().unitDivided(by: .minute()), .discreteAverage)
    ]
    private let sleep = HKObjectType.categoryType(forIdentifier: .sleepAnalysis)

    @objc func status(_ call: CAPPluginCall) {
        call.resolve(["availability": HKHealthStore.isHealthDataAvailable() ? "available" : "unavailable"])
    }

    @objc func requestRead(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable(), let sleep else {
            call.reject("Health data unavailable", "unavailable")
            return
        }
        let types: Set<HKObjectType> = Set(quantities.values.compactMap {
            HKObjectType.quantityType(forIdentifier: $0.0) as HKObjectType?
        }).union([sleep])
        store.requestAuthorization(toShare: [], read: types) { completed, _ in
            if completed { call.resolve() }
            else { call.reject("Health authorization request failed", "permission-unknown") }
        }
    }

    @objc func openSettings(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let url = URL(string: UIApplication.openSettingsURLString) else {
                call.reject("Settings unavailable", "settings-failed")
                return
            }
            UIApplication.shared.open(url) { opened in
                if opened { call.resolve() }
                else { call.reject("Settings unavailable", "settings-failed") }
            }
        }
    }

    @objc func read(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.reject("Health data unavailable", "unavailable")
            return
        }
        guard let metric = call.getString("metric"), let start = call.getDouble("start"),
              let end = call.getDouble("end"), start < end else {
            call.reject("Invalid health range", "read-failed")
            return
        }
        let from = Date(timeIntervalSince1970: start / 1000)
        let to = Date(timeIntervalSince1970: end / 1000)
        if metric == "sleep", let sleep {
            let predicate = HKQuery.predicateForSamples(withStart: from, end: to, options: [])
            store.execute(HKSampleQuery(sampleType: sleep, predicate: predicate, limit: HKObjectQueryNoLimit, sortDescriptors: nil) {
                _, samples, error in
                if self.rejectRead(call, error) { return }
                let rows: [[String: Any]] = (samples as? [HKCategorySample] ?? []).compactMap { sample in
                    // HealthKit usa 1 para dormido y 3–5 para sus etapas dormido.
                    guard [1, 3, 4, 5].contains(sample.value) else { return nil }
                    return ["start": sample.startDate.timeIntervalSince1970 * 1000,
                            "end": sample.endDate.timeIntervalSince1970 * 1000,
                            "id": sample.uuid.uuidString,
                            "value": 0]
                }
                call.resolve(["records": rows])
            })
            return
        }
        guard let (identifier, unit, operation) = quantities[metric],
              let type = HKObjectType.quantityType(forIdentifier: identifier) else {
            call.reject("Health type unavailable", "read-failed")
            return
        }
        let predicate = HKQuery.predicateForSamples(withStart: from, end: to, options: .strictStartDate)
        store.execute(HKStatisticsQuery(quantityType: type, quantitySamplePredicate: predicate, options: operation) {
            _, stats, error in
            if self.rejectRead(call, error) { return }
            let quantity = operation == .cumulativeSum ? stats?.sumQuantity() : stats?.averageQuantity()
            let records = quantity.map { [["start": start, "end": end, "value": $0.doubleValue(for: unit)]] } ?? []
            call.resolve(["records": records])
        })
    }

    private func rejectRead(_ call: CAPPluginCall, _ error: Error?) -> Bool {
        guard let error = error as NSError? else { return false }
        if error.domain == HKErrorDomain && error.code == HKError.Code.errorNoData.rawValue {
            call.resolve(["records": []])
        } else {
            call.reject("Health data query failed", "read-failed")
        }
        return true
    }
}
