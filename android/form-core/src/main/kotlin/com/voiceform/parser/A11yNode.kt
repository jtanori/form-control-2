package com.voiceform.parser

/**
 * Framework-agnostic accessibility node (AND-002).
 * The Android app adapts AccessibilityNodeInfo; tests use [FakeA11yNode].
 */
interface A11yNode {
    val text: String?
    val contentDescription: String?
    val viewIdResourceName: String?
    val className: String?
    val isEditable: Boolean
    val isClickable: Boolean
    val isCheckable: Boolean
    val isChecked: Boolean
    val isEnabled: Boolean
    val isVisibleToUser: Boolean
    val isLongClickable: Boolean
    /** Screen-space bounds. */
    val boundsLeft: Int
    val boundsTop: Int
    val boundsRight: Int
    val boundsBottom: Int
    val childCount: Int
    fun childAt(index: Int): A11yNode?

    /** Optional focus/act methods used by the executor adapter. */
    fun performSetText(value: String): Boolean = false
    fun performClick(): Boolean = false
    fun performCheck(): Boolean = false
    fun performUncheck(): Boolean = false
    fun performAccessibilityFocus(): Boolean = false
}

data class FakeA11yNode(
    override val text: String? = null,
    override val contentDescription: String? = null,
    override val viewIdResourceName: String? = null,
    override val className: String? = null,
    override val isEditable: Boolean = false,
    override val isClickable: Boolean = false,
    override val isCheckable: Boolean = false,
    override val isChecked: Boolean = false,
    override val isEnabled: Boolean = true,
    override val isVisibleToUser: Boolean = true,
    override val isLongClickable: Boolean = false,
    override val boundsLeft: Int = 0,
    override val boundsTop: Int = 0,
    override val boundsRight: Int = 0,
    override val boundsBottom: Int = 0,
    val children: List<FakeA11yNode> = emptyList(),
) : A11yNode {
    val performed: MutableList<String> = mutableListOf()

    override val childCount: Int get() = children.size
    override fun childAt(index: Int): A11yNode? = children.getOrNull(index)

    override fun performSetText(value: String): Boolean {
        performed.add("setText:$value")
        return true
    }

    override fun performClick(): Boolean {
        performed.add("click")
        return true
    }

    override fun performCheck(): Boolean {
        performed.add("check")
        return true
    }

    override fun performUncheck(): Boolean {
        performed.add("uncheck")
        return true
    }

    override fun performAccessibilityFocus(): Boolean {
        performed.add("a11yFocus")
        return true
    }
}
