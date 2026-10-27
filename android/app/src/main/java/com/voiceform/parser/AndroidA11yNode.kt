package com.voiceform.parser

import android.graphics.Rect
import android.os.Build
import android.view.accessibility.AccessibilityNodeInfo
import com.voiceform.Log

/**
 * Android adapter: AccessibilityNodeInfo → framework-agnostic [A11yNode].
 * Keeps form-core free of android.* so unit tests run on the JVM (AND-002).
 */
class AndroidA11yNode(private val node: AccessibilityNodeInfo) : A11yNode {

    override val text: String? get() = node.text?.toString()
    override val contentDescription: String? get() = node.contentDescription?.toString()
    override val viewIdResourceName: String? get() = node.viewIdResourceName
    override val className: String? get() = node.className?.toString()
    override val isEditable: Boolean get() = node.isEditable
    override val isClickable: Boolean get() = node.isClickable
    override val isCheckable: Boolean get() = node.isCheckable
    override val isChecked: Boolean get() = node.isChecked
    override val isEnabled: Boolean get() = node.isEnabled
    override val isVisibleToUser: Boolean get() = node.isVisibleToUser
    override val isLongClickable: Boolean get() = node.isLongClickable

    private val screenBounds: Rect
        get() {
            val r = Rect()
            node.getBoundsInScreen(r)
            return r
        }

    override val boundsLeft: Int get() = screenBounds.left
    override val boundsTop: Int get() = screenBounds.top
    override val boundsRight: Int get() = screenBounds.right
    override val boundsBottom: Int get() = screenBounds.bottom

    override val childCount: Int get() = node.childCount

    override fun childAt(index: Int): A11yNode? =
        node.getChild(index)?.let { AndroidA11yNode(it) }

    override fun performSetText(value: String): Boolean {
        val args = android.os.Bundle().apply {
            // Public SDK does not export the ACTION_ARGUMENT_* constant on all
            // compileSdk levels; value matches AccessibilityNodeInfo docs.
            putCharSequence(
                "android.view.accessibility.ACTION_ARGUMENT_SET_TEXT_CHAR_SEQUENCE",
                value,
            )
        }
        return node.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args)
    }

    override fun performClick(): Boolean =
        node.performAction(AccessibilityNodeInfo.ACTION_CLICK)

    // ACTION_CHECK / ACTION_UNCHECK are @hide in the public android.jar;
    // ACTION_CLICK toggles isCheckable nodes (Android semantics).
    override fun performCheck(): Boolean {
        if (node.isChecked) return true
        return node.performAction(AccessibilityNodeInfo.ACTION_CLICK)
    }

    override fun performUncheck(): Boolean {
        if (!node.isChecked) return true
        return node.performAction(AccessibilityNodeInfo.ACTION_CLICK)
    }

    override fun performAccessibilityFocus(): Boolean =
        node.performAction(AccessibilityNodeInfo.ACTION_ACCESSIBILITY_FOCUS)

    companion object {
        fun fromRoot(root: AccessibilityNodeInfo?): AndroidA11yNode? =
            root?.let {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    try {
                        it.refresh()
                    } catch (e: Exception) {
                        Log.w("parser", "node refresh failed", mapOf("error" to (e.message ?: "")))
                    }
                }
                AndroidA11yNode(it)
            }
    }
}
