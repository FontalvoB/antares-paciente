package com.capacitorjs.community.plugins.bluetoothle

import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.bluetooth.BluetoothManager
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

/** El servicio conserva GATT aunque la Activity desaparezca de Recientes. */
@SuppressLint("MissingPermission")
class BleBackgroundService : Service() {
    companion object {
        private const val CHANNEL = "antares-wearable"
        private const val NOTIFICATION = 7124
        private const val STOP = "com.coppadresd.ble.STOP"
        val devices = ConcurrentHashMap<String, Device>()
        @Volatile var appActive = false
        @Volatile private var running: BleBackgroundService? = null

        fun start(context: Context) {
            val intent = Intent(context, BleBackgroundService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(intent)
            else context.startService(intent)
        }
        fun changed(context: Context) {
            if (BleNotificationJournal.get(context).trackedDevices().isEmpty()) {
                context.stopService(Intent(context, BleBackgroundService::class.java))
            }
        }
        fun reconnect(device: String) { running?.scheduleReconnect(device) }
        fun paused(context: Context) {
            appActive = false
            BleNotificationJournal.get(context).trackedDevices().forEach { reconnect(it) }
        }
    }

    private val handler = Handler(Looper.getMainLooper())
    private val reconnecting = mutableSetOf<String>()
    private val pending = mutableSetOf<String>()
    private val journal by lazy { BleNotificationJournal.get(this) }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        running = this
        val manager = getSystemService(NotificationManager::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            manager.createNotificationChannel(NotificationChannel(CHANNEL, getString(R.string.antares_ble_channel), NotificationManager.IMPORTANCE_LOW))
        }
        val launch = packageManager.getLaunchIntentForPackage(packageName)
        val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        val stop = PendingIntent.getService(this, 2, Intent(this, BleBackgroundService::class.java).setAction(STOP), flags)
        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) Notification.Builder(this, CHANNEL) else Notification.Builder(this)
        builder.setSmallIcon(android.R.drawable.stat_sys_data_bluetooth)
            .setContentTitle("Copp Adresd")
            .setContentText(getString(R.string.antares_ble_receiving))
            .setOngoing(true)
            .setCategory(Notification.CATEGORY_SERVICE)
            .addAction(Notification.Action.Builder(null, getString(R.string.antares_ble_stop), stop).build())
        if (launch != null) builder.setContentIntent(PendingIntent.getActivity(this, 1, launch, flags))
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION, builder.build(), ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE)
        } else { startForeground(NOTIFICATION, builder.build()) }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == STOP) {
            journal.trackedDevices().forEach { id ->
                journal.stop(id, false, true)
                devices.remove(id)?.disconnect(5000) { }
            }
            stopSelf()
            return START_NOT_STICKY
        }
        // START_STICKY permite reconstruir GATT tras muerte del proceso. No elude Force Stop.
        if (journal.trackedDevices().isEmpty()) {
            stopSelf()
            return START_NOT_STICKY
        }
        journal.trackedDevices().forEach { scheduleReconnect(it) }
        return START_STICKY
    }

    private fun scheduleReconnect(id: String) {
        handler.post {
            if (!journal.isTracking(id) || devices[id]?.isConnected() == true || reconnecting.contains(id) || !pending.add(id)) return@post
            handler.postDelayed({
                pending.remove(id)
                // Con JS activo, el controlador de conexión de la app es el propietario.
                if (!appActive) connect(id)
            }, 5000)
        }
    }

    private fun connect(id: String) {
        if (!journal.isTracking(id) || devices[id]?.isConnected() == true || !reconnecting.add(id)) return
        val adapter = getSystemService(BluetoothManager::class.java)?.adapter
        if (adapter?.isEnabled != true) {
            reconnecting.remove(id); scheduleReconnect(id); return
        }
        try {
            val device = devices.getOrPut(id) { Device(applicationContext, adapter, id) { scheduleReconnect(id) } }
            device.connect(20_000, true) { response ->
                handler.post {
                    reconnecting.remove(id)
                    if (response.success) restoreSubscriptions(id, device, journal.subscriptions(id), 0)
                    else scheduleReconnect(id)
                }
            }
        } catch (error: Exception) {
            reconnecting.remove(id)
            Log.e("AntaresBLE", "Reconexión en segundo plano falló", error)
            scheduleReconnect(id)
        }
    }

    private fun restoreSubscriptions(id: String, device: Device, subscriptions: List<Pair<String, String>>, index: Int) {
        if (appActive || !journal.isTracking(id) || !device.isConnected() || index >= subscriptions.size) return
        val (service, characteristic) = subscriptions[index]
        device.setNotifications(UUID.fromString(service), UUID.fromString(characteristic), true, { }, 5000) {
            handler.post { restoreSubscriptions(id, device, subscriptions, index + 1) }
        }
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        appActive = false
        journal.trackedDevices().forEach { scheduleReconnect(it) }
        super.onTaskRemoved(rootIntent)
    }

    override fun onDestroy() {
        running = null
        handler.removeCallbacksAndMessages(null)
        super.onDestroy()
    }
}
