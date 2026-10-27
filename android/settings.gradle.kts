rootProject.name = "voiceform-android"

pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
    plugins {
        id("org.jetbrains.kotlin.jvm") version "1.9.24"
        id("org.jetbrains.kotlin.android") version "1.9.24"
        id("com.android.application") version "8.5.2"
    }
}

dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
    }
}

include(":form-core")

// The :app module needs the Android SDK. Include it only when available so
// `:form-core:test` (pure JVM) runs on machines without an SDK.
val sdkAvailable = System.getenv("ANDROID_HOME") != null ||
    System.getenv("ANDROID_SDK_ROOT") != null ||
    file("local.properties").exists()
if (sdkAvailable) {
    include(":app")
} else {
    logger.lifecycle("Android SDK not found — including :form-core only")
}
