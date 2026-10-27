package com.voiceform

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
import android.widget.Button
import android.widget.TextView
import android.widget.Toast

/**
 * Launcher: permission gates for accessibility + overlay + microphone (AND-001).
 * RECORD_AUDIO is never requested at install — only when the user taps the
 * mic shortcut here (or the capture path is blocked until it is granted).
 */
class MainActivity : Activity() {

    private val micPermissionRequest = 41

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        val info = findViewById<TextView>(R.id.info)
        info.text = getString(R.string.accessibility_service_description)

        findViewById<Button>(R.id.openAccessibility).setOnClickListener {
            startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
        }

        findViewById<Button>(R.id.openOverlayPermission).setOnClickListener {
            if (Settings.canDrawOverlays(this)) {
                Toast.makeText(this, "Overlay permission granted", Toast.LENGTH_SHORT).show()
            } else {
                val intent = Intent(
                    Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:$packageName"),
                )
                startActivity(intent)
            }
        }

        findViewById<Button>(R.id.allowMic).setOnClickListener {
            if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                Toast.makeText(this, "Microphone already granted", Toast.LENGTH_SHORT).show()
            } else {
                requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), micPermissionRequest)
            }
        }

        findViewById<Button>(R.id.coreUrl).setOnClickListener {
            val current = CoreSettings.baseUrl(this)
            CoreSettings.setBaseUrl(
                this,
                if (current.contains("10.0.2.2")) "http://192.168.1.10:8020"
                else CoreSettings.DEFAULT_BASE_URL,
            )
            Toast.makeText(
                this,
                "Core URL: ${CoreSettings.baseUrl(this)}",
                Toast.LENGTH_SHORT,
            ).show()
        }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray,
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == micPermissionRequest) {
            val granted = grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED
            Toast.makeText(
                this,
                if (granted) "Microphone granted" else "Microphone denied — voice capture stays off",
                Toast.LENGTH_LONG,
            ).show()
        }
    }
}
