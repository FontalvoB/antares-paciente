import Foundation
import UIKit
import CoreBluetooth
#if canImport(AccessorySetupKit)
import AccessorySetupKit

/// El permiso del accesorio solo se solicita tras una conexión manual.
/// La migración se limita al UUID elegido, sin autorizar otro dispositivo.
@available(iOS 18.0, *)
final class BleAccessorySetup {
    static let shared = BleAccessorySetup()
    private var session = ASAccessorySession()
    private var activated = false
    private var activating = false
    private var pending: Request?
    private var selected: ASAccessory?
    private var activationGeneration = 0

    private struct Request {
        let requestId = UUID()
        let identifier: UUID
        let name: String
        let kind: String
        let completion: (Result<Bool, Error>) -> Void
    }

    private func failure(_ message: String) -> NSError {
        NSError(domain: "AntaresAccessorySetup", code: 1, userInfo: [NSLocalizedDescriptionKey: message])
    }

    func setup(deviceId: String, name: String, kind: String, completion: @escaping (Result<Bool, Error>) -> Void) {
        dispatchPrecondition(condition: .onQueue(.main))
        guard pending == nil else { completion(.failure(failure("Accessory setup is already in progress"))); return }
        guard UIApplication.shared.applicationState == .active else {
            completion(.failure(failure("Accessory setup requires a user action in the foreground"))); return
        }
        guard let identifier = UUID(uuidString: deviceId), kind == "colmi" || kind == "ycbt" else {
            completion(.failure(failure("Unsupported accessory for setup"))); return
        }
        pending = Request(identifier: identifier, name: name, kind: kind, completion: completion)
        selected = nil
        if activated { presentIfNeeded(); return }
        guard !activating else { return }
        activating = true
        activationGeneration += 1
        let generation = activationGeneration
        session.activate(on: .main) { [weak self] event in
            guard let self = self, self.activationGeneration == generation else { return }
            self.handle(event)
        }
    }

    private func handle(_ event: ASAccessoryEvent) {
        if let error = event.error, event.eventType != .invalidated { finishPickerError(error); return }
        switch event.eventType {
        case .activated:
            activated = true
            activating = false
            presentIfNeeded()
        case .accessoryAdded, .accessoryChanged:
            // Un evento de otro accesorio nunca satisface esta solicitud.
            if event.accessory?.bluetoothIdentifier == pending?.identifier { selected = event.accessory }
        case .migrationComplete:
            if let identifier = pending?.identifier {
                selected = session.accessories.first { $0.bluetoothIdentifier == identifier }
            }
        case .pickerDidDismiss:
            guard let request = pending else { return }
            let accessory = session.accessories.first { $0.bluetoothIdentifier == request.identifier } ?? selected
            finish(.success(accessory?.bluetoothIdentifier == request.identifier && accessory?.state == .authorized))
        case .invalidated:
            activated = false
            activating = false
            activationGeneration += 1
            session = ASAccessorySession()
            finish(.failure(failure("Accessory setup session invalidated")))
        default: break
        }
    }

    private func presentIfNeeded() {
        guard let request = pending else { return }
        if session.accessories.contains(where: { $0.bluetoothIdentifier == request.identifier && $0.state == .authorized }) {
            finish(.success(true)); return
        }
        guard UIApplication.shared.applicationState == .active else {
            finish(.failure(failure("Accessory setup requires the foreground"))); return
        }
        let descriptor = ASDiscoveryDescriptor()
        descriptor.bluetoothServiceUUID = CBUUID(string: request.kind == "colmi"
            ? "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e"
            : "be940000-7333-be46-b7ae-689e71722bd5")
        descriptor.bluetoothNameSubstring = request.kind == "colmi" ? "H59" : "R88"
        guard let image = UIImage(systemName: request.kind == "colmi" ? "applewatch" : "circle.circle") else {
            finish(.failure(failure("Accessory image unavailable"))); return
        }
        let item = ASMigrationDisplayItem(name: request.name.isEmpty ? (request.kind == "colmi" ? "H59" : "R88") : request.name,
                                         productImage: image,
                                         descriptor: descriptor)
        item.peripheralIdentifier = request.identifier
        session.showPicker(for: [item]) { [weak self] error in
            guard self?.pending?.requestId == request.requestId else { return }
            if let error = error { self?.finishPickerError(error) }
            // La autorización se verifica al cerrar el picker, no al mostrarlo.
        }
    }

    private func finish(_ result: Result<Bool, Error>) {
        let completion = pending?.completion
        pending = nil
        selected = nil
        completion?(result)
    }

    private func finishPickerError(_ error: Error) {
        let nativeError = error as NSError
        if nativeError.domain == ASErrorDomain && nativeError.code == ASError.Code.userCancelled.rawValue {
            finish(.success(false))
        } else { finish(.failure(error)) }
    }
}
#endif
