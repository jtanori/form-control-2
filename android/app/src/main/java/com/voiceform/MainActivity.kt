package com.voiceform

import android.Manifest
import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.content.pm.PackageManager
import android.text.InputType
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * AND-006 / spec §6.8 — setup checklist:
 *  1) accessibility service (+ overlay grant) → 2) microphone → 3) check & continue.
 * Status is **rechecked on resume** (never trusted stale — §6.8 behavior).
 * Mic is never requested here until the user taps step 2 (B-1a parity).
 */
class MainActivity : Activity() {

    private companion object {
        const val MIC_DENIED_KEY = "mic_permission_denied"
    }

    private val micPermissionRequest = 41
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private var probeJob: Job? = null

    private lateinit var dotAccessibility: View
    private lateinit var dotMic: View
    private lateinit var progressDots: List<View>
    private lateinit var micDeniedText: TextView
    private lateinit var allowMicButton: Button
    private lateinit var openAppSettings: Button
    private var micDeniedByUser = false
    private lateinit var checkAccessibility: TextView
    private lateinit var checkMic: TextView
    private lateinit var checkOverlay: TextView
    private lateinit var checkCore: TextView
    private lateinit var continueBtn: Button

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        micDeniedByUser = getPreferences(MODE_PRIVATE).getBoolean(MIC_DENIED_KEY, false)

        dotAccessibility = findViewById(R.id.dotAccessibility)
        dotMic = findViewById(R.id.dotMic)
        progressDots = listOf(
            findViewById(R.id.setupProgress1),
            findViewById(R.id.setupProgress2),
            findViewById(R.id.setupProgress3),
        )
        micDeniedText = findViewById(R.id.micDeniedText)
        allowMicButton = findViewById(R.id.allowMic)
        openAppSettings = findViewById(R.id.openAppSettings)
        checkAccessibility = findViewById(R.id.checkAccessibility)
        checkMic = findViewById(R.id.checkMic)
        checkOverlay = findViewById(R.id.checkOverlay)
        checkCore = findViewById(R.id.checkCore)
        continueBtn = findViewById(R.id.continueBtn)

        findViewById<Button>(R.id.openAccessibility).setOnClickListener {
            startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
        }

        findViewById<Button>(R.id.openOverlayPermission).setOnClickListener {
            if (Settings.canDrawOverlays(this)) {
                Toast.makeText(this, getString(R.string.setup_ready), Toast.LENGTH_SHORT).show()
            } else {
                startActivity(
                    Intent(
                        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                        Uri.parse("package:$packageName"),
                    ),
                )
            }
        }

        allowMicButton.setOnClickListener {
            when {
                voiceReady() -> refresh()
                micDeniedByUser -> openApplicationSettings()
                else -> requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), micPermissionRequest)
            }
        }
        openAppSettings.setOnClickListener { openApplicationSettings() }

        continueBtn.setOnClickListener {
            Toast.makeText(
                this,
                if (voiceReady()) getString(R.string.setup_ready) else getString(R.string.setup_continue_voiceless),
                Toast.LENGTH_SHORT,
            ).show()
            finish() // user returns to whatever app they came from
        }

        findViewById<Button>(R.id.coreUrl).setOnClickListener {
            val input = EditText(this).apply {
                inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_URI
                setSingleLine(true)
                setText(CoreSettings.baseUrl(this@MainActivity))
                hint = "http://10.0.2.2:8020"
            }
            AlertDialog.Builder(this)
                .setTitle(R.string.core_url_title)
                .setMessage(R.string.core_url_help)
                .setView(input)
                .setNegativeButton(R.string.cancel, null)
                .setPositiveButton(R.string.core_url_save) { _, _ ->
                    val candidate = input.text.toString().trim().trimEnd('/')
                    val uri = android.net.Uri.parse(candidate)
                    if ((uri.scheme == "http" || uri.scheme == "https") && !uri.host.isNullOrBlank()) {
                        CoreSettings.setBaseUrl(this, candidate)
                        refresh()
                    } else {
                        Toast.makeText(this, R.string.core_url_invalid, Toast.LENGTH_LONG).show()
                    }
                }
                .show()
        }

        val learnToggle = findViewById<TextView>(R.id.learnMoreToggle)
        val learnBody = findViewById<TextView>(R.id.learnMoreBody)
        learnToggle.setOnClickListener {
            learnBody.visibility =
                if (learnBody.visibility == View.VISIBLE) View.GONE else View.VISIBLE
        }
    }

    override fun onResume() {
        super.onResume()
        refresh()
    }

    private fun accessibilityEnabled(): Boolean {
        val enabled = Settings.Secure.getString(
            contentResolver,
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES,
        ) ?: ""
        return enabled.split(':').any { it.startsWith("$packageName/") }
    }

    private fun voiceReady(): Boolean =
        checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED

    private fun paintDot(view: View, ok: Boolean) {
        view.setBackgroundResource(
            if (ok) R.color.vf_success else R.color.vf_info,
        )
    }

    private fun mark(check: TextView, label: String, ok: Boolean) {
        check.text = "$label ${if (ok) "●" else "○"}"
        check.setTextColor(
            getColor(if (ok) R.color.vf_success else R.color.vf_text_secondary),
        )
    }

    private fun refresh() {
        val a11y = accessibilityEnabled()
        val mic = voiceReady()
        val overlay = Settings.canDrawOverlays(this)
        if (mic && micDeniedByUser) {
            micDeniedByUser = false
            getPreferences(MODE_PRIVATE).edit().putBoolean(MIC_DENIED_KEY, false).apply()
        }
        val denied = !mic && micDeniedByUser
        micDeniedText.visibility = if (denied) View.VISIBLE else View.GONE
        allowMicButton.visibility = if (denied) View.GONE else View.VISIBLE
        openAppSettings.visibility = if (denied) View.VISIBLE else View.GONE

        paintDot(dotAccessibility, a11y)
        paintDot(dotMic, mic)
        mark(checkAccessibility, getString(R.string.setup_check_accessibility), a11y)
        mark(checkMic, getString(R.string.setup_check_microphone), mic)
        mark(checkOverlay, getString(R.string.setup_check_overlay), overlay)
        paintProgressDots(a11y && overlay, mic, coreReady = false)

        continueBtn.isEnabled = true // §6.8: continue allowed; voiceless path stays usable
        continueBtn.text =
            if (a11y && mic && overlay) getString(R.string.setup_continue)
            else getString(R.string.setup_continue_voiceless)

        // Core is async — never show a stale "ok" (§6.8 / HealthStrip rule)
        checkCore.text = getString(R.string.setup_checking)
        checkCore.setTextColor(getColor(R.color.vf_text_secondary))
        probeJob?.cancel() // rapid re-checks must not race to a stale mark
        probeJob = scope.launch {
            val ok = withContext(Dispatchers.IO) { probeCore() }
            mark(checkCore, getString(R.string.setup_check_core), ok)
            paintProgressDots(a11y && overlay, mic, coreReady = ok)
        }
    }

    private fun paintProgressDots(step1Ready: Boolean, micReady: Boolean, coreReady: Boolean) {
        val complete = listOf(step1Ready, step1Ready && micReady, step1Ready && micReady && coreReady)
        val activeIndex = when {
            !step1Ready -> 0
            !micReady -> 1
            !coreReady -> 2
            else -> -1
        }
        progressDots.forEachIndexed { index, dot ->
            val color = when {
                complete[index] -> getColor(R.color.vf_success)
                index == activeIndex -> getColor(R.color.vf_accent)
                else -> getColor(R.color.vf_info)
            }
            dot.backgroundTintList = android.content.res.ColorStateList.valueOf(color)
            val stepLabel = getString(
                when (index) {
                    0 -> R.string.setup_step1
                    1 -> R.string.setup_step2
                    else -> R.string.setup_step3
                },
            )
            dot.contentDescription = "$stepLabel, ${getString(
                if (complete[index]) R.string.setup_step_complete else R.string.setup_step_incomplete,
            )}"
        }
    }

    private fun openApplicationSettings() {
        startActivity(
            Intent(
                Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                Uri.fromParts("package", packageName, null),
            ),
        )
    }

    override fun onDestroy() {
        scope.cancel()
        super.onDestroy()
    }

    private fun probeCore(): Boolean =
        try {
            val url = java.net.URL("${CoreSettings.baseUrl(this)}/api/v1/health")
            val conn = url.openConnection() as java.net.HttpURLConnection
            conn.connectTimeout = 2500
            conn.readTimeout = 2500
            try {
                conn.responseCode == 200
            } finally {
                conn.disconnect()
            }
        } catch (_: Exception) {
            false
        }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray,
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == micPermissionRequest) {
            val granted =
                grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED
            micDeniedByUser = !granted
            getPreferences(MODE_PRIVATE).edit().putBoolean(MIC_DENIED_KEY, micDeniedByUser).apply()
            Toast.makeText(
                this,
                if (granted) getString(R.string.setup_ready)
                else getString(R.string.setup_step2_hint),
                Toast.LENGTH_LONG,
            ).show()
            refresh()
        }
    }
}
