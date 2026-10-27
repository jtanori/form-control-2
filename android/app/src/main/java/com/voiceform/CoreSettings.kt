package com.voiceform

import android.content.Context
import android.provider.Settings
import com.voiceform.network.CoreClient
import java.util.UUID

/**
 * Core endpoint + provisional session identity (AND-005).
 * sessionId = "a-" + deviceId + "-" + windowHash (stable per window — INTE-002).
 */
object CoreSettings {
    const val PREFS = "voiceform"
    const val DEFAULT_BASE_URL = "http://10.0.2.2:8020" // emulator → host loopback
    private const val DEFAULT_DEVICE_ID = "device"

    fun baseUrl(context: Context): String =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString("coreUrl", null)
            ?: DEFAULT_BASE_URL

    fun setBaseUrl(context: Context, url: String) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString("coreUrl", url)
            .apply()
    }

    fun deviceId(context: Context): String {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        prefs.getString("deviceId", null)?.let { return it }
        val id = Settings.Secure.getString(
            context.contentResolver,
            Settings.Secure.ANDROID_ID,
        ) ?: UUID.randomUUID().toString()
        val short = id.take(8)
        prefs.edit().putString("deviceId", short).apply()
        return short
    }

    private var cachedSession: String? = null
    private var cachedWindow: String? = null

    fun sessionIdFor(context: Context, windowKey: String): String {
        val hash = Integer.toHexString(windowKey.hashCode())
        if (cachedWindow != hash || cachedSession == null) {
            cachedWindow = hash
            cachedSession = "a-${deviceId(context)}-$hash"
        }
        return cachedSession!!
    }

    fun newClient(context: Context): CoreClient =
        CoreClient(baseUrl = baseUrl(context), deviceId = deviceId(context))
}
