package com.voiceform.voice

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

/**
 * AND-004 part 1 — Android built-in speech recognition client.
 * Falls back to Core STT (`POST /stt/transcribe`) when the device recognizer
 * is unavailable — host configurable via CoreSettings (Termux/LAN).
 */
class VoiceClient(
    context: Context,
    private val onResult: (String) -> Unit,
    private val onError: (String) -> Unit,
) {
    private val appContext = context.applicationContext
    private var recognizer: SpeechRecognizer? = null

    fun isAvailable(): Boolean = SpeechRecognizer.isRecognitionAvailable(appContext)

    fun startListening() {
        if (!isAvailable()) {
            onError("Speech recognition unavailable on this device")
            return
        }
        // QA-001: RECORD_AUDIO must be granted before capture (never earlier).
        if (appContext.checkSelfPermission(android.Manifest.permission.RECORD_AUDIO)
            != android.content.pm.PackageManager.PERMISSION_GRANTED
        ) {
            onError("Microphone permission not granted — enable it in app settings")
            return
        }
        stop()
        val r = SpeechRecognizer.createSpeechRecognizer(appContext)
        recognizer = r
        r.setRecognitionListener(object : RecognitionListener {
            override fun onResults(results: Bundle?) {
                val text = results
                    ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                    ?.firstOrNull()
                    ?.trim()
                if (text.isNullOrEmpty()) onError("No speech recognized")
                else onResult(text)
            }

            override fun onError(error: Int) {
                onError(humanizeError(error))
            }

            override fun onReadyForSpeech(params: Bundle?) = Unit
            override fun onBeginningOfSpeech() = Unit
            override fun onRmsChanged(rmsdB: Float) = Unit
            override fun onBufferReceived(buffer: ByteArray?) = Unit
            override fun onEndOfSpeech() = Unit
            override fun onPartialResults(partialResults: Bundle?) = Unit
            override fun onEvent(eventType: Int, params: Bundle?) = Unit
        })

        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(
                RecognizerIntent.EXTRA_LANGUAGE_MODEL,
                RecognizerIntent.LANGUAGE_MODEL_FREE_FORM,
            )
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
        }
        r.startListening(intent)
    }

    fun stop() {
        recognizer?.destroy()
        recognizer = null
    }

    /**
     * STT-001 fallback: upload raw audio to Core `POST /stt/transcribe`.
     * Consumes the v1 stt-response contract as-is:
     * `{transcript, language, confidence, duration_sec}`.
     * Blocking — call from a background thread.
     */
    fun postTranscribe(
        coreBaseUrl: String,
        audio: ByteArray,
        fileName: String = "speech.wav",
        language: String = "auto",
    ): String {
        val url = URL("${coreBaseUrl.trimEnd('/')}/stt/transcribe")
        val boundary = "VoiceForm${System.nanoTime()}"
        val conn = url.openConnection() as HttpURLConnection
        try {
            conn.requestMethod = "POST"
            conn.connectTimeout = 10_000
            conn.readTimeout = 60_000
            conn.doOutput = true
            conn.setRequestProperty("Content-Type", "multipart/form-data; boundary=$boundary")
            conn.outputStream.use { out ->
                fun line(s: String) = out.write("$s\r\n".toByteArray(Charsets.UTF_8))
                line("--$boundary")
                line("Content-Disposition: form-data; name=\"language\"")
                line("")
                line(language)
                line("--$boundary")
                line("Content-Disposition: form-data; name=\"audio\"; filename=\"$fileName\"")
                line("Content-Type: audio/wav")
                line("")
                out.write(audio)
                line("")
                line("--$boundary--")
            }
            val status = conn.responseCode
            val stream = if (status >= 400) conn.errorStream else conn.inputStream
            val body = stream?.bufferedReader()?.use { it.readText() } ?: ""
            if (status !in 200..299) {
                throw IOException("stt -> HTTP $status ${body.take(160)}")
            }
            return Regex("\"transcript\"\\s*:\\s*\"((?:\\\\.|[^\"\\\\])*)\"")
                .find(body)?.groupValues?.get(1)
                ?.replace("\\\"", "\"")
                ?.replace("\\\\", "\\")
                ?: ""
        } finally {
            conn.disconnect()
        }
    }

    private fun humanizeError(code: Int): String = when (code) {
        SpeechRecognizer.ERROR_AUDIO -> "Audio recording error"
        SpeechRecognizer.ERROR_CLIENT -> "Client side error"
        SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "Microphone permission denied"
        SpeechRecognizer.ERROR_NETWORK -> "Network error (speech service)"
        SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "Speech network timeout"
        SpeechRecognizer.ERROR_NO_MATCH -> "No speech recognized"
        SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "Speech recognizer busy"
        SpeechRecognizer.ERROR_SERVER -> "Speech service error"
        SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "No speech input"
        else -> "Speech error $code"
    }
}
