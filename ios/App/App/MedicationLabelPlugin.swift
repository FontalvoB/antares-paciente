import Capacitor
import Foundation
import Vision

@objc(MedicationLabelPlugin)
public class MedicationLabelPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "MedicationLabelPlugin"
    public let jsName = "MedicationLabel"
    public let pluginMethods: [CAPPluginMethod] = [CAPPluginMethod(name: "read", returnType: CAPPluginReturnPromise)]

    @objc func read(_ call: CAPPluginCall) {
        guard let encoded = call.getString("image"), encoded.count <= 8_000_000,
              let image = Data(base64Encoded: encoded) else {
            call.reject("Invalid label image")
            return
        }

        DispatchQueue.global(qos: .userInitiated).async {
            let request = VNRecognizeTextRequest()
            request.recognitionLevel = .accurate
            request.recognitionLanguages = ["es-ES", "en-US"]
            request.usesLanguageCorrection = false
            do {
                try VNImageRequestHandler(data: image).perform([request])
                let text = request.results?.compactMap { $0.topCandidates(1).first?.string }
                    .joined(separator: "\n") ?? ""
                call.resolve(["text": text])
            } catch {
                call.reject("Could not read label")
            }
        }
    }
}

class MedicationBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(MedicationLabelPlugin())
        bridge?.registerPluginInstance(WellnessHealthPlugin())
    }
}
