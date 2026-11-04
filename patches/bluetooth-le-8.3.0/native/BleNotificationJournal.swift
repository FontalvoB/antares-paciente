import Foundation
import SQLite3

/// Diario privado durable; las confirmaciones de JS son la única vía de borrado.
final class BleNotificationJournal {
    static let shared = BleNotificationJournal()
    private var db: OpaquePointer?
    private let lock = NSRecursiveLock()
    private var lastError: String?
    private let transient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)

    private init() {
        do {
            let support = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
            var folder = support.appendingPathComponent("AntaresBluetooth", isDirectory: true)
            try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true, attributes: [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication])
            var resource = URLResourceValues(); resource.isExcludedFromBackup = true
            try folder.setResourceValues(resource)
            let file = folder.appendingPathComponent("antares-ble.sqlite")
            guard sqlite3_open_v2(file.path, &db, SQLITE_OPEN_CREATE | SQLITE_OPEN_READWRITE | SQLITE_OPEN_FULLMUTEX, nil) == SQLITE_OK else { return }
            sqlite3_busy_timeout(db, 2000)
            try execute("PRAGMA journal_mode=WAL")
            try execute("PRAGMA synchronous=FULL")
            try execute("CREATE TABLE IF NOT EXISTS devices (device TEXT PRIMARY KEY, owner TEXT NOT NULL, enabled INTEGER NOT NULL, dropped INTEGER NOT NULL DEFAULT 0)")
            try execute("CREATE TABLE IF NOT EXISTS notifications (sequence INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT UNIQUE NOT NULL, device TEXT NOT NULL, service TEXT NOT NULL, characteristic TEXT NOT NULL, value TEXT NOT NULL, received REAL NOT NULL)")
            if !(scalar("SELECT sql FROM sqlite_master WHERE name='notifications'", []) ?? "").contains("sequence INTEGER") {
                try transaction {
                    try execute("ALTER TABLE notifications RENAME TO notifications_v1")
                    try execute("CREATE TABLE notifications (sequence INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT UNIQUE NOT NULL, device TEXT NOT NULL, service TEXT NOT NULL, characteristic TEXT NOT NULL, value TEXT NOT NULL, received REAL NOT NULL)")
                    try execute("INSERT INTO notifications(id,device,service,characteristic,value,received) SELECT id,device,service,characteristic,value,received FROM notifications_v1 ORDER BY rowid")
                    try execute("DROP TABLE notifications_v1")
                }
            }
            try execute("CREATE INDEX IF NOT EXISTS pending_device ON notifications(device)")
            try execute("CREATE TABLE IF NOT EXISTS subscriptions (device TEXT NOT NULL, service TEXT NOT NULL, characteristic TEXT NOT NULL, PRIMARY KEY(device,service,characteristic))")
            // El diario sigue disponible en segundo plano después del primer desbloqueo.
            try FileManager.default.setAttributes([.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication], ofItemAtPath: folder.path)
            try FileManager.default.setAttributes([.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication], ofItemAtPath: file.path)
        } catch { NSLog("[Antares BLE] No se pudo abrir el diario: %@", error.localizedDescription) }
    }

    private func statement(_ sql: String, _ arguments: [String] = []) throws -> OpaquePointer {
        guard let db = db else { throw failure("Bluetooth journal unavailable") }
        var stmt: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK, let prepared = stmt else { throw failure(String(cString: sqlite3_errmsg(db))) }
        for (index, value) in arguments.enumerated() { sqlite3_bind_text(prepared, Int32(index + 1), value, -1, transient) }
        return prepared
    }
    private func execute(_ sql: String, _ arguments: [String] = []) throws {
        let stmt = try statement(sql, arguments); defer { sqlite3_finalize(stmt) }
        let status = sqlite3_step(stmt)
        guard status == SQLITE_DONE || status == SQLITE_ROW else { throw failure(String(cString: sqlite3_errmsg(db))) }
    }
    private func failure(_ text: String) -> NSError { NSError(domain: "AntaresBluetoothJournal", code: 1, userInfo: [NSLocalizedDescriptionKey: text]) }
    private func scalar(_ sql: String, _ args: [String]) -> String? {
        guard let stmt = try? statement(sql, args) else { return nil }; defer { sqlite3_finalize(stmt) }
        guard sqlite3_step(stmt) == SQLITE_ROW, let text = sqlite3_column_text(stmt, 0) else { return nil }
        return String(cString: text)
    }
    private func transaction(_ operation: () throws -> Void) throws {
        try execute("BEGIN IMMEDIATE")
        do { try operation(); try execute("COMMIT") } catch { try? execute("ROLLBACK"); throw error }
    }

    func start(_ device: String, owner: String) throws {
        lock.lock(); defer { lock.unlock() }
        guard !device.isEmpty && !owner.isEmpty else { throw failure("deviceId and ownerId required") }
        try transaction {
            if scalar("SELECT owner FROM devices WHERE device=?", [device]) != owner {
                try execute("DELETE FROM notifications WHERE device=?", [device])
                try execute("DELETE FROM subscriptions WHERE device=?", [device])
                try execute("DELETE FROM devices WHERE device=?", [device])
            }
            try execute("INSERT INTO devices(device,owner,enabled) VALUES(?,?,1) ON CONFLICT(device) DO UPDATE SET enabled=1", [device, owner])
        }
    }
    func stop(_ device: String, forget: Bool) throws {
        lock.lock(); defer { lock.unlock() }
        try transaction {
            if forget {
                try execute("DELETE FROM notifications WHERE device=?", [device])
                try execute("DELETE FROM subscriptions WHERE device=?", [device])
                try execute("DELETE FROM devices WHERE device=?", [device])
            } else { try execute("UPDATE devices SET enabled=0 WHERE device=?", [device]) }
        }
    }
    func isTracking(_ device: String) -> Bool {
        lock.lock(); defer { lock.unlock() }
        return scalar("SELECT enabled FROM devices WHERE device=?", [device]) == "1"
    }
    func rememberSubscription(_ device: String, service: String, characteristic: String) {
        lock.lock(); defer { lock.unlock() }
        guard isTracking(device) else { return }
        try? execute("INSERT OR IGNORE INTO subscriptions VALUES(?,?,?)", [device, service.lowercased(), characteristic.lowercased()])
    }
    func subscriptions(_ device: String) -> [(String, String)] {
        lock.lock(); defer { lock.unlock() }
        guard let stmt = try? statement("SELECT service,characteristic FROM subscriptions WHERE device=?", [device]) else { return [] }; defer { sqlite3_finalize(stmt) }
        var values: [(String, String)] = []
        while sqlite3_step(stmt) == SQLITE_ROW { values.append((String(cString: sqlite3_column_text(stmt, 0)), String(cString: sqlite3_column_text(stmt, 1)))) }
        return values
    }
    func append(_ device: String, service: String, characteristic: String, value: String) {
        lock.lock(); defer { lock.unlock() }
        guard isTracking(device) else { return }
        do {
            try transaction {
                try execute("INSERT INTO notifications(id,device,service,characteristic,value,received) VALUES(?,?,?,?,?,?)", [UUID().uuidString, device, service.lowercased(), characteristic.lowercased(), value, String(Date().timeIntervalSince1970 * 1000)])
                let count = Int(scalar("SELECT COUNT(*) FROM notifications WHERE device=?", [device]) ?? "0") ?? 0
                if count > 20_000 {
                    let removed = String(count - 20_000)
                    try execute("DELETE FROM notifications WHERE rowid IN (SELECT rowid FROM notifications WHERE device=? ORDER BY rowid LIMIT ?)", [device, removed])
                    try execute("UPDATE devices SET dropped=dropped+? WHERE device=?", [removed, device])
                }
            }
        } catch { lastError = error.localizedDescription; NSLog("[Antares BLE] Error al guardar notificación: %@", error.localizedDescription) }
    }
    func pending(_ device: String, owner: String, limit: Int, afterSequence: String? = nil) throws -> [String: Any] {
        lock.lock(); defer { lock.unlock() }
        guard scalar("SELECT owner FROM devices WHERE device=?", [device]) == owner else { throw failure("Bluetooth journal owner mismatch") }
        guard let after = Int64(afterSequence ?? "0"), after >= 0 else { throw failure("Invalid Bluetooth journal cursor") }
        let stmt = try statement("SELECT id,service,characteristic,value,received,sequence FROM notifications WHERE device=? AND sequence>? ORDER BY sequence LIMIT ?", [device, String(after), String(max(1, min(1000, limit)))]); defer { sqlite3_finalize(stmt) }
        var records: [[String: Any]] = []
        while sqlite3_step(stmt) == SQLITE_ROW {
            records.append(["id": String(cString: sqlite3_column_text(stmt, 0)), "deviceId": device, "service": String(cString: sqlite3_column_text(stmt, 1)), "characteristic": String(cString: sqlite3_column_text(stmt, 2)), "value": String(cString: sqlite3_column_text(stmt, 3)), "receivedAt": sqlite3_column_double(stmt, 4), "sequence": String(sqlite3_column_int64(stmt, 5))])
        }
        var result: [String: Any] = ["notifications": records, "droppedCount": Int(scalar("SELECT dropped FROM devices WHERE device=?", [device]) ?? "0") ?? 0]
        if let error = lastError { result["lastError"] = error }
        return result
    }
    func acknowledge(_ device: String, owner: String, ids: [String]) throws {
        lock.lock(); defer { lock.unlock() }
        guard scalar("SELECT owner FROM devices WHERE device=?", [device]) == owner else { throw failure("Bluetooth journal owner mismatch") }
        try transaction { for id in ids.prefix(1000) { try execute("DELETE FROM notifications WHERE device=? AND id=?", [device, id]) } }
    }
}
