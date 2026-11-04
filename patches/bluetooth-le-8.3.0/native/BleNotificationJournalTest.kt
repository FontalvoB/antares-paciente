package com.capacitorjs.community.plugins.bluetoothle

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.After
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.util.UUID
import android.database.sqlite.SQLiteDatabase

/** Pruebas de recuperación del diario sin radio Bluetooth ni cuentas reales. */
@RunWith(AndroidJUnit4::class)
class BleNotificationJournalTest {
    private val journal = BleNotificationJournal.get(InstrumentationRegistry.getInstrumentation().targetContext)
    private val device = "test-${UUID.randomUUID()}"
    private val owner = "test-owner"

    @After fun clean() { journal.stop(device, true) }

    @Test fun pendingReadSurvivesDatabaseReopenUntilExactAcknowledgement() {
        journal.start(device, owner)
        journal.append(device, "service", "characteristic", "0102")
        journal.append(device, "service", "characteristic", "0304")
        val first = journal.pending(device, owner, 10).getJSONArray("notifications")
        assertEquals(2, first.length())
        val id = first.getJSONObject(0).getString("id")
        journal.close()
        assertEquals(2, journal.pending(device, owner, 10).getJSONArray("notifications").length())
        journal.acknowledge(device, owner, listOf(id))
        journal.acknowledge(device, owner, listOf(id))
        val remaining = journal.pending(device, owner, 10).getJSONArray("notifications")
        assertEquals(1, remaining.length())
        assertEquals("0304", remaining.getJSONObject(0).getString("value"))
    }

    @Test fun changingPatientDropsPreviousPatientFramesAndSubscriptions() {
        journal.start(device, owner)
        journal.rememberSubscription(device, "service", "characteristic")
        journal.append(device, "service", "characteristic", "0102")
        journal.start(device, "next-owner")
        assertEquals(0, journal.pending(device, "next-owner", 10).getJSONArray("notifications").length())
        assertTrue(journal.subscriptions(device).isEmpty())
        assertThrows(IllegalArgumentException::class.java) { journal.pending(device, owner, 10) }
        assertThrows(IllegalArgumentException::class.java) { journal.acknowledge(device, owner, emptyList()) }
    }

    @Test fun stoppingCollectionKeepsUnacknowledgedFramesButAcceptsNoNewFrames() {
        journal.start(device, owner)
        journal.append(device, "service", "characteristic", "0102")
        journal.stop(device, false)
        journal.append(device, "service", "characteristic", "0304")
        assertFalse(journal.isTracking(device))
        assertEquals(1, journal.pending(device, owner, 10).getJSONArray("notifications").length())
        journal.start(device, owner)
        assertTrue(journal.isTracking(device))
        assertEquals(1, journal.pending(device, owner, 10).getJSONArray("notifications").length())
    }

    @Test fun cursorCanPassUnacknowledgedFramesAndSurvivesAcknowledgingItsRecord() {
        journal.start(device, owner)
        journal.append(device, "service", "first-channel", "01")
        journal.append(device, "service", "second-channel", "02")
        val first = journal.pending(device, owner, 1).getJSONArray("notifications").getJSONObject(0)
        val sequence = first.getString("sequence")
        val second = journal.pending(device, owner, 1, sequence).getJSONArray("notifications")
        assertEquals(1, second.length())
        assertEquals("02", second.getJSONObject(0).getString("value"))
        journal.acknowledge(device, owner, listOf(first.getString("id")))
        assertEquals("02", journal.pending(device, owner, 1, sequence).getJSONArray("notifications").getJSONObject(0).getString("value"))
        journal.acknowledge(device, owner, listOf(second.getJSONObject(0).getString("id")))
        journal.append(device, "service", "second-channel", "03")
        val third = journal.pending(device, owner, 1, second.getJSONObject(0).getString("sequence")).getJSONArray("notifications")
        assertEquals("03", third.getJSONObject(0).getString("value"))
    }

    @Test fun explicitNotificationStopIsNotUndoneByAutomaticReconnectOrOrdinaryPause() {
        journal.start(device, owner)
        journal.stop(device, false, true)
        journal.stop(device, false)
        assertTrue(journal.stoppedByUser(device))
        assertThrows(IllegalArgumentException::class.java) { journal.start(device, owner, true) }
        assertFalse(journal.isTracking(device))
        journal.start(device, owner, false)
        assertTrue(journal.isTracking(device))
        assertFalse(journal.stoppedByUser(device))
    }

    @Test fun versionOneMigrationPreservesPendingFramesAndSubscriptions() {
        journal.close()
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        context.deleteDatabase("antares-ble.sqlite")
        val db = SQLiteDatabase.openOrCreateDatabase(context.getDatabasePath("antares-ble.sqlite"), null)
        db.execSQL("CREATE TABLE devices (device TEXT PRIMARY KEY, owner TEXT NOT NULL, enabled INTEGER NOT NULL, dropped INTEGER NOT NULL DEFAULT 0)")
        db.execSQL("CREATE TABLE notifications (id TEXT PRIMARY KEY, device TEXT NOT NULL, service TEXT NOT NULL, characteristic TEXT NOT NULL, value TEXT NOT NULL, received REAL NOT NULL)")
        db.execSQL("CREATE INDEX pending_device ON notifications(device)")
        db.execSQL("CREATE TABLE subscriptions (device TEXT NOT NULL, service TEXT NOT NULL, characteristic TEXT NOT NULL, PRIMARY KEY(device,service,characteristic))")
        db.execSQL("INSERT INTO devices(device,owner,enabled) VALUES(?,?,1)", arrayOf(device, owner))
        db.execSQL("INSERT INTO notifications VALUES('original-id',?,'service','characteristic','0102',1234)", arrayOf(device))
        db.execSQL("INSERT INTO subscriptions VALUES(?,'service','characteristic')", arrayOf(device))
        db.version = 1
        db.close()
        val pending = journal.pending(device, owner, 10).getJSONArray("notifications")
        assertEquals(1, pending.length())
        assertEquals("original-id", pending.getJSONObject(0).getString("id"))
        assertEquals("0102", pending.getJSONObject(0).getString("value"))
        assertTrue(pending.getJSONObject(0).getLong("sequence") > 0)
        assertEquals(listOf("service" to "characteristic"), journal.subscriptions(device))
        assertTrue(journal.isTracking(device))
    }
}
