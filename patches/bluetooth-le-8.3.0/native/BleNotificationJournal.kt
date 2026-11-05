package com.capacitorjs.community.plugins.bluetoothle

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import java.util.UUID

/** Diario privado: una lectura no se elimina hasta que JS confirma su persistencia. */
internal class BleNotificationJournal private constructor(context: Context) :
    SQLiteOpenHelper(context.applicationContext, "antares-ble.sqlite", null, 2) {
    companion object {
        private const val MAX_RECORDS = 20_000
        @Volatile private var instance: BleNotificationJournal? = null
        fun get(context: Context): BleNotificationJournal = instance ?: synchronized(this) {
            instance ?: BleNotificationJournal(context).also { instance = it }
        }
    }

    @Volatile private var lastError: String? = null

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL("CREATE TABLE devices (device TEXT PRIMARY KEY, owner TEXT NOT NULL, enabled INTEGER NOT NULL, dropped INTEGER NOT NULL DEFAULT 0, user_stopped INTEGER NOT NULL DEFAULT 0)")
        createNotifications(db)
        db.execSQL("CREATE INDEX pending_device ON notifications(device)")
        db.execSQL("CREATE TABLE subscriptions (device TEXT NOT NULL, service TEXT NOT NULL, characteristic TEXT NOT NULL, PRIMARY KEY(device,service,characteristic))")
    }
    private fun createNotifications(db: SQLiteDatabase) {
        db.execSQL("CREATE TABLE notifications (sequence INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT UNIQUE NOT NULL, device TEXT NOT NULL, service TEXT NOT NULL, characteristic TEXT NOT NULL, value TEXT NOT NULL, received REAL NOT NULL)")
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        if (oldVersion < 2) {
            db.execSQL("ALTER TABLE devices ADD COLUMN user_stopped INTEGER NOT NULL DEFAULT 0")
            db.execSQL("ALTER TABLE notifications RENAME TO notifications_v1")
            createNotifications(db)
            db.execSQL("INSERT INTO notifications(id,device,service,characteristic,value,received) SELECT id,device,service,characteristic,value,received FROM notifications_v1 ORDER BY rowid")
            db.execSQL("DROP TABLE notifications_v1")
            db.execSQL("CREATE INDEX pending_device ON notifications(device)")
        }
    }

    @Synchronized fun start(device: String, owner: String, automatic: Boolean = false) {
        require(device.isNotBlank() && owner.isNotBlank()) { "deviceId and ownerId required" }
        val db = writableDatabase
        db.beginTransaction()
        try {
            require(ownerOf(device) != owner || !automatic || !stoppedByUser(device)) { "Bluetooth background collection stopped by user" }
            if (ownerOf(device) != owner) {
                db.delete("notifications", "device=?", arrayOf(device))
                db.delete("subscriptions", "device=?", arrayOf(device))
                db.delete("devices", "device=?", arrayOf(device))
            }
            db.execSQL("INSERT OR IGNORE INTO devices(device,owner,enabled) VALUES(?,?,1)", arrayOf(device, owner))
            db.execSQL("UPDATE devices SET enabled=1,user_stopped=0 WHERE device=?", arrayOf(device))
            db.setTransactionSuccessful()
        } finally { db.endTransaction() }
    }

    @Synchronized fun stop(device: String, forget: Boolean, userInitiated: Boolean = false) {
        val db = writableDatabase
        db.beginTransaction()
        try {
            if (forget) {
                db.delete("notifications", "device=?", arrayOf(device))
                db.delete("subscriptions", "device=?", arrayOf(device))
                db.delete("devices", "device=?", arrayOf(device))
            } else {
                db.execSQL("UPDATE devices SET enabled=0,user_stopped=MAX(user_stopped,?) WHERE device=?", arrayOf<Any>(if (userInitiated) 1 else 0, device))
            }
            db.setTransactionSuccessful()
        } finally { db.endTransaction() }
    }

    private fun ownerOf(device: String): String? = readableDatabase.rawQuery(
        "SELECT owner FROM devices WHERE device=?", arrayOf(device)
    ).use { if (it.moveToFirst()) it.getString(0) else null }

    @Synchronized fun isTracking(device: String): Boolean = readableDatabase.rawQuery(
        "SELECT enabled FROM devices WHERE device=?", arrayOf(device)
    ).use { it.moveToFirst() && it.getInt(0) == 1 }

    @Synchronized fun stoppedByUser(device: String): Boolean = readableDatabase.rawQuery(
        "SELECT user_stopped FROM devices WHERE device=?", arrayOf(device)
    ).use { it.moveToFirst() && it.getInt(0) == 1 }

    @Synchronized fun trackedDevices(): List<String> = readableDatabase.rawQuery(
        "SELECT device FROM devices WHERE enabled=1", null
    ).use { cursor -> buildList { while (cursor.moveToNext()) add(cursor.getString(0)) } }

    @Synchronized fun rememberSubscription(device: String, service: String, characteristic: String) {
        if (!isTracking(device)) return
        writableDatabase.execSQL("INSERT OR IGNORE INTO subscriptions VALUES(?,?,?)", arrayOf(device, service, characteristic))
    }

    @Synchronized fun subscriptions(device: String): List<Pair<String, String>> = readableDatabase.rawQuery(
        "SELECT service,characteristic FROM subscriptions WHERE device=?", arrayOf(device)
    ).use { cursor -> buildList { while (cursor.moveToNext()) add(cursor.getString(0) to cursor.getString(1)) } }

    @Synchronized fun append(device: String, service: String, characteristic: String, value: String) {
        try { appendRecord(device, service, characteristic, value) }
        catch (error: Exception) {
            lastError = error.message ?: "Bluetooth journal write failed"
            android.util.Log.e("AntaresBLE", "No se pudo guardar una notificación BLE", error)
        }
    }

    private fun appendRecord(device: String, service: String, characteristic: String, value: String) {
        if (!isTracking(device)) return
        val db = writableDatabase
        db.beginTransaction()
        try {
            val values = ContentValues().apply {
                put("id", UUID.randomUUID().toString()); put("device", device)
                put("service", service.lowercase()); put("characteristic", characteristic.lowercase())
                put("value", value); put("received", System.currentTimeMillis().toDouble())
            }
            db.insertOrThrow("notifications", null, values)
            val count = db.rawQuery("SELECT COUNT(*) FROM notifications WHERE device=?", arrayOf(device)).use { it.moveToFirst(); it.getInt(0) }
            if (count > MAX_RECORDS) {
                val removed = count - MAX_RECORDS
                db.execSQL("DELETE FROM notifications WHERE rowid IN (SELECT rowid FROM notifications WHERE device=? ORDER BY rowid LIMIT ?)", arrayOf<Any>(device, removed))
                db.execSQL("UPDATE devices SET dropped=dropped+? WHERE device=?", arrayOf<Any>(removed, device))
            }
            db.setTransactionSuccessful()
        } finally { db.endTransaction() }
    }

    @Synchronized fun pending(device: String, owner: String, limit: Int, afterSequence: String? = null): JSObject {
        require(ownerOf(device) == owner) { "Bluetooth journal owner mismatch" }
        val after = afterSequence?.toLongOrNull() ?: if (afterSequence == null) 0L else throw IllegalArgumentException("Invalid Bluetooth journal cursor")
        require(after >= 0L) { "Invalid Bluetooth journal cursor" }
        val records = JSArray()
        readableDatabase.rawQuery("SELECT id,service,characteristic,value,received,sequence FROM notifications WHERE device=? AND sequence>? ORDER BY sequence LIMIT ?", arrayOf(device, after.toString(), limit.coerceIn(1, 1000).toString())).use { cursor ->
            while (cursor.moveToNext()) records.put(JSObject().apply {
                put("id", cursor.getString(0)); put("deviceId", device)
                put("service", cursor.getString(1)); put("characteristic", cursor.getString(2))
                put("value", cursor.getString(3)); put("receivedAt", cursor.getDouble(4))
                put("sequence", cursor.getLong(5).toString())
            })
        }
        val dropped = readableDatabase.rawQuery("SELECT dropped FROM devices WHERE device=?", arrayOf(device)).use { it.moveToFirst(); it.getLong(0) }
        return JSObject().apply { put("notifications", records); put("droppedCount", dropped); put("stoppedByUser", stoppedByUser(device)); lastError?.let { put("lastError", it) } }
    }

    @Synchronized fun acknowledge(device: String, owner: String, ids: List<String>) {
        require(ownerOf(device) == owner) { "Bluetooth journal owner mismatch" }
        val db = writableDatabase
        db.beginTransaction()
        try {
            ids.take(1000).forEach { db.delete("notifications", "device=? AND id=?", arrayOf(device, it)) }
            db.setTransactionSuccessful()
        } finally { db.endTransaction() }
    }
}
