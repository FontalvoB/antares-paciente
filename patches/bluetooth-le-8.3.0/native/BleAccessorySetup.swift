import Foundation
import UIKit
import CoreBluetooth
#if canImport(AccessorySetupKit)
import AccessorySetupKit

/// Una sesión coordina listado, alta de accesorios nuevos y migración por UUID.
@available(iOS 18.0, *)
final class BleAccessorySetup {
    static let shared = BleAccessorySetup()
    static func trace(_ message: String) {
        guard let folder = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first else { return }
        let file = folder.appendingPathComponent("AntaresBleSetup.log")
        var data = (try? Data(contentsOf: file)) ?? Data()
        data.append(Data("\(Date().timeIntervalSince1970) \(message)\n".utf8))
        try? Data(data.suffix(16_384)).write(to: file, options: .atomic)
    }
    private enum Operation {
        case list
        case discover
        case migrate(UUID, String, String)
    }
    private struct Request {
        let id = UUID()
        let operation: Operation
        let completion: (Result<[ASAccessory], Error>) -> Void
    }
    private var listCompletions: [(Result<[ASAccessory], Error>) -> Void] = []
    private var session = ASAccessorySession()
    private var activated = false
    private var pending: Request?
    private var selected: ASAccessory?
    private var generation = 0
    private var pickerPresented = false
    private var operationCompleted = false
    private var discoveryBaseline = Set<UUID>()
    private var watchdog: DispatchWorkItem?

    private func failure(_ message: String) -> NSError {
        NSError(domain: "AntaresAccessorySetup", code: 1, userInfo: [NSLocalizedDescriptionKey: message])
    }
    func setup(deviceId: String, name: String, kind: String, completion: @escaping (Result<Bool, Error>) -> Void) {
        guard let id = UUID(uuidString: deviceId), kind == "colmi" || kind == "ycbt" else {
            completion(.failure(failure("Unsupported accessory for setup"))); return
        }
        begin(.migrate(id, name, kind)) { completion($0.map { !$0.isEmpty }) }
    }
    func discover(completion: @escaping (Result<[ASAccessory], Error>) -> Void) {
        begin(.discover, completion: completion)
    }
    func list(completion: @escaping (Result<[ASAccessory], Error>) -> Void) {
        if activated {
            let devices = authorized()
            Self.trace("authorized count=\(devices.count)")
            completion(.success(devices)); return
        }
        listCompletions.append(completion)
        guard listCompletions.count == 1 else { return }
        begin(.list) { [weak self] result in
            guard let self = self else { return }
            let completions = self.listCompletions
            self.listCompletions.removeAll()
            completions.forEach { $0(result) }
        }
    }
    private func begin(_ operation: Operation, completion: @escaping (Result<[ASAccessory], Error>) -> Void) {
        dispatchPrecondition(condition: .onQueue(.main))
        guard pending == nil else { completion(.failure(failure("Accessory setup is already in progress"))); return }
        if case .list = operation {} else {
            guard UIApplication.shared.applicationState == .active else {
                completion(.failure(failure("Accessory setup requires the foreground"))); return
            }
        }
        let request = Request(operation: operation, completion: completion)
        pending = request
        selected = nil
        pickerPresented = false
        operationCompleted = false
        Self.trace("operation started")
        let timeout = DispatchWorkItem { [weak self] in
            guard let self = self, self.pending?.id == request.id else { return }
            self.resetSession()
            self.finish(.failure(self.failure("Accessory setup timed out")))
        }
        watchdog = timeout
        DispatchQueue.main.asyncAfter(deadline: .now() + 45, execute: timeout)
        if activated { presentIfNeeded(); return }
        generation += 1
        let current = generation
        session.activate(on: .main) { [weak self] event in
            guard let self = self, self.generation == current else { return }
            self.handle(event)
        }
    }
    private func resetSession() {
        generation += 1
        session.invalidate()
        session = ASAccessorySession()
        activated = false
    }
    private func authorized() -> [ASAccessory] {
        session.accessories.filter { $0.state == .authorized && $0.bluetoothIdentifier != nil }
    }
    func authorizedSnapshot() -> [ASAccessory] { activated ? authorized() : [] }

    private func matches(_ accessory: ASAccessory) -> Bool {
        guard let request = pending else { return false }
        if case .migrate(let id, _, _) = request.operation { return accessory.bluetoothIdentifier == id }
        guard let id = accessory.bluetoothIdentifier else { return false }
        if case .discover = request.operation { return !discoveryBaseline.contains(id) }
        return true
    }
    private func handle(_ event: ASAccessoryEvent) {
        Self.trace("event \(event.eventType.rawValue)")
        if let error = event.error, event.eventType != .invalidated { finishPickerError(error); return }
        switch event.eventType {
        case .activated:
            activated = true
            presentIfNeeded()
        case .accessoryAdded, .accessoryChanged:
            if let accessory = event.accessory, matches(accessory) { selected = accessory }
            completeSilentOperation()
        case .migrationComplete:
            operationCompleted = true
            completeSilentOperation()
        case .pickerDidPresent:
            pickerPresented = true
        case .pickerDidDismiss:
            pickerPresented = false
            operationCompleted = true
            let result = selection()
            if !result.isEmpty || selected == nil { finish(.success(result)) }
        case .invalidated:
            resetSession()
            finish(.failure(failure("Accessory setup session invalidated")))
        default: break
        }
    }
    private func selection() -> [ASAccessory] {
        guard let request = pending else { return [] }
        if case .migrate = request.operation {
            return authorized().filter(matches)
        }
        // No elegir un accesorio anterior cuando el usuario cancela el alta.
        guard let selected = selected, selected.state == .authorized, matches(selected) else { return [] }
        return [selected]
    }
    private func completeSilentOperation() {
        guard !pickerPresented, operationCompleted else { return }
        let result = selection()
        if !result.isEmpty { finish(.success(result)) }
    }
    private func displayItem(kind: String, name: String? = nil, identifier: UUID? = nil) throws -> ASPickerDisplayItem {
        let descriptor = ASDiscoveryDescriptor()
        descriptor.bluetoothServiceUUID = CBUUID(string: kind == "colmi"
            ? "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e" : "be940000-7333-be46-b7ae-689e71722bd5")
        descriptor.bluetoothNameSubstring = kind == "colmi" ? "H59" : "R88"
        guard let image = UIImage(systemName: kind == "colmi" ? "applewatch" : "circle.circle") else {
            throw failure("Accessory image unavailable")
        }
        let label = name?.isEmpty == false ? name! : (kind == "colmi" ? "H59" : "R88")
        if let id = identifier {
            let item = ASMigrationDisplayItem(name: label, productImage: image, descriptor: descriptor)
            item.peripheralIdentifier = id
            return item
        }
        return ASPickerDisplayItem(name: label, productImage: image, descriptor: descriptor)
    }
    private func presentIfNeeded() {
        guard let request = pending else { return }
        var items: [ASPickerDisplayItem]
        do {
            switch request.operation {
            case .list:
                finish(.success(authorized())); return
            case .migrate(let id, let name, let kind):
                if let existing = authorized().first(where: { $0.bluetoothIdentifier == id }) {
                    finish(.success([existing])); return
                }
                items = [try displayItem(kind: kind, name: name, identifier: id)]
            case .discover:
                discoveryBaseline = Set(authorized().compactMap { $0.bluetoothIdentifier })
                // Descubrimiento nuevo: no usar ASMigrationDisplayItem ni un UUID previo.
                items = [try displayItem(kind: "colmi"), try displayItem(kind: "ycbt")]
            }
        } catch { finish(.failure(error)); return }
        guard UIApplication.shared.applicationState == .active else {
            finish(.failure(failure("Accessory setup requires the foreground"))); return
        }
        session.showPicker(for: items) { [weak self] error in
            guard let self = self, self.pending?.id == request.id else { return }
            if let error = error { self.finishPickerError(error) }
            else {
                self.operationCompleted = true
                self.completeSilentOperation()
            }
        }
    }
    private func finish(_ result: Result<[ASAccessory], Error>) {
        Self.trace("operation finished")
        watchdog?.cancel()
        watchdog = nil
        let completion = pending?.completion
        pending = nil
        selected = nil
        completion?(result)
    }
    private func finishPickerError(_ error: Error) {
        let nativeError = error as NSError
        Self.trace("error \(nativeError.domain) \(nativeError.code)")
        if nativeError.domain == ASErrorDomain && nativeError.code == ASError.Code.userCancelled.rawValue {
            finish(.success([]))
        } else { finish(.failure(error)) }
    }
}
#endif
