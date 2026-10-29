package com.voiceform.ui

import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Rect
import android.graphics.RectF
import android.view.View
import com.voiceform.R

/** Non-touchable accent outline for the currently selected field. */
internal class FieldHighlightView(
    context: Context,
    private val bounds: Rect,
) : View(context) {
    private val density = resources.displayMetrics.density
    private val outline = RectF(0f, 0f, bounds.width().toFloat(), bounds.height().toFloat())
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = context.getColor(R.color.vf_accent)
        style = Paint.Style.STROKE
        strokeWidth = 2.5f * density
    }

    init {
        isFocusable = false
        importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        canvas.drawRoundRect(outline, 7f * density, 7f * density, paint)
    }
}
