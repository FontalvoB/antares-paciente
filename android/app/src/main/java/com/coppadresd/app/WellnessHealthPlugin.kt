package com.coppadresd.app

import android.content.Intent
import androidx.activity.result.ActivityResultLauncher
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.aggregate.AggregateMetric
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ActiveCaloriesBurnedRecord
import androidx.health.connect.client.records.DistanceRecord
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.RestingHeartRateRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import java.time.Instant

@CapacitorPlugin(name = "WellnessHealth")
class WellnessHealthPlugin : Plugin() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private lateinit var launcher: ActivityResultLauncher<Set<String>>
    private var permissionCall: PluginCall? = null
    private val permissions = mapOf(
        "steps" to HealthPermission.getReadPermission(StepsRecord::class),
        "distance" to HealthPermission.getReadPermission(DistanceRecord::class),
        "active_energy" to HealthPermission.getReadPermission(ActiveCaloriesBurnedRecord::class),
        "heart_rate" to HealthPermission.getReadPermission(HeartRateRecord::class),
        "resting_heart_rate" to HealthPermission.getReadPermission(RestingHeartRateRecord::class),
        "sleep" to HealthPermission.getReadPermission(SleepSessionRecord::class)
    )

    override fun load() {
        launcher = bridge.registerForActivityResult(PermissionController.createRequestPermissionResultContract()) {
            permissionCall?.resolve(JSObject())
            permissionCall = null
        }
    }

    override fun handleOnDestroy() {
        scope.cancel()
        permissionCall = null
        super.handleOnDestroy()
    }

    @PluginMethod
    fun status(call: PluginCall) = run(call) {
        when (HealthConnectClient.getSdkStatus(context)) {
            HealthConnectClient.SDK_AVAILABLE -> {
                val granted = client().permissionController.getGrantedPermissions()
                call.resolve(JSObject().put("availability", "available")
                    .put("granted", JSArray(permissions.filterValues { it in granted }.keys.toTypedArray())))
            }
            HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED ->
                call.resolve(JSObject().put("availability", "not-installed"))
            else -> call.resolve(JSObject().put("availability", "unavailable"))
        }
    }

    @PluginMethod
    fun requestRead(call: PluginCall) = run(call) {
        if (permissionCall != null) {
            call.reject("Health permission request already in progress", "busy")
        } else {
            permissionCall = call
            try {
                launcher.launch(permissions.values.toSet())
            } catch (error: Exception) {
                permissionCall = null
                throw error
            }
        }
    }

    @PluginMethod
    fun openSettings(call: PluginCall) = run(call) {
        activity.startActivity(Intent(HealthConnectClient.ACTION_HEALTH_CONNECT_SETTINGS))
        call.resolve()
    }

    @PluginMethod
    fun read(call: PluginCall) = run(call) {
        val metric = call.getString("metric") ?: error("Missing metric")
        val from = Instant.ofEpochMilli(call.getLong("start") ?: error("Missing start"))
        val to = Instant.ofEpochMilli(call.getLong("end") ?: error("Missing end"))
        val client = client()
        require(from < to)
        if (permissions.getValue(metric) !in client.permissionController.getGrantedPermissions()) {
            call.reject("Read permission unavailable", "permission-denied")
            return@run
        }

        val range = TimeRangeFilter.between(from, to)
        val records = JSArray()
        if (metric == "sleep") {
            var pageToken: String? = null
            do {
                val page = client.readRecords(ReadRecordsRequest(SleepSessionRecord::class, range, pageToken = pageToken))
                page.records.forEach { session ->
                    // Si la fuente no distingue etapas, el registro es una sesión de sueño.
                    if (session.stages.isEmpty()) {
                        records.put(row(session.startTime, session.endTime, 0.0, session.metadata.id))
                    } else {
                        session.stages.filter {
                            it.stage in setOf(
                                SleepSessionRecord.STAGE_TYPE_SLEEPING, SleepSessionRecord.STAGE_TYPE_LIGHT,
                                SleepSessionRecord.STAGE_TYPE_DEEP, SleepSessionRecord.STAGE_TYPE_REM
                            )
                        }.forEach { stage -> records.put(row(stage.startTime, stage.endTime, 0.0)) }
                    }
                }
                pageToken = page.pageToken
            } while (pageToken != null)
        } else {
            val value = when (metric) {
                "steps" -> client.total(StepsRecord.COUNT_TOTAL, range)?.toDouble()
                "distance" -> client.total(DistanceRecord.DISTANCE_TOTAL, range)?.inMeters
                "active_energy" -> client.total(ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL, range)?.inKilocalories
                "heart_rate" -> client.total(HeartRateRecord.BPM_AVG, range)?.toDouble()
                "resting_heart_rate" -> client.total(RestingHeartRateRecord.BPM_AVG, range)?.toDouble()
                else -> null
            }
            value?.let { records.put(row(from, to, it)) }
        }
        call.resolve(JSObject().put("records", records))
    }

    private fun client() = HealthConnectClient.getOrCreate(context)

    private suspend fun <T : Any> HealthConnectClient.total(metric: AggregateMetric<T>, range: TimeRangeFilter): T? =
        aggregate(AggregateRequest(setOf(metric), range))[metric]

    private fun row(start: Instant, end: Instant, value: Double, id: String? = null) =
        JSObject().put("start", start.toEpochMilli()).put("end", end.toEpochMilli()).put("value", value).put("id", id)

    private fun run(call: PluginCall, action: suspend () -> Unit) {
        scope.launch {
            try {
                action()
            } catch (error: CancellationException) {
                throw error
            } catch (_: SecurityException) {
                call.reject("Health Connect access unavailable", "permission-denied")
            } catch (_: Exception) {
                call.reject("Health Connect operation failed", "read-failed")
            }
        }
    }
}
