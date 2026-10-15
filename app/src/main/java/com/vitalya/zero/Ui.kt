package com.vitalya.zero

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.ColorFilter
import android.graphics.Paint
import android.graphics.PixelFormat
import android.graphics.RectF
import android.graphics.drawable.Drawable
import android.util.TypedValue
import android.view.View

fun Context.dp(v: Float): Int =
    TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, resources.displayMetrics).toInt()

fun Context.dp(v: Int): Int = dp(v.toFloat())

object Palette {
    val bg: Int = Color.parseColor("#07080B")
    val surface: Int = Color.parseColor("#0E1117")
    val line: Int = Color.parseColor("#2A3240")
    val text: Int = Color.parseColor("#E8ECF2")
    val dim: Int = Color.parseColor("#6B7686")

    val accents: List<Pair<String, String>> = listOf(
        "MINT" to "#00E5A8",
        "RED" to "#FF3B4E",
        "VIOLET" to "#8B6BFF",
        "AMBER" to "#FFB020",
        "ICE" to "#4FC3FF"
    )

    var accent: Int = Color.parseColor("#00E5A8")

    fun withAlpha(color: Int, alpha: Int): Int = (color and 0x00FFFFFF) or (alpha shl 24)
}

/** Тёмная панель с тонкой рамкой и акцентными уголками в стиле игрового HUD. */
class HudFrameDrawable(private val ctx: Context, private val fillAlpha: Int = 200) : Drawable() {

    private val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.FILL
        color = Palette.withAlpha(Palette.surface, fillAlpha)
    }
    private val border = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = ctx.dp(1).toFloat()
        color = Palette.line
    }
    private val tick = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = ctx.dp(2).toFloat()
        strokeCap = Paint.Cap.SQUARE
        color = Palette.accent
    }
    private val len = ctx.dp(10).toFloat()

    override fun draw(canvas: Canvas) {
        val r = RectF(bounds)
        r.inset(1f, 1f)
        canvas.drawRect(r, fill)
        canvas.drawRect(r, border)
        val l = r.left
        val t = r.top
        val rt = r.right
        val b = r.bottom
        canvas.drawLine(l, t, l + len, t, tick)
        canvas.drawLine(l, t, l, t + len, tick)
        canvas.drawLine(rt, t, rt - len, t, tick)
        canvas.drawLine(rt, t, rt, t + len, tick)
        canvas.drawLine(l, b, l + len, b, tick)
        canvas.drawLine(l, b, l, b - len, tick)
        canvas.drawLine(rt, b, rt - len, b, tick)
        canvas.drawLine(rt, b, rt, b - len, tick)
    }

    override fun setAlpha(alpha: Int) {}

    override fun setColorFilter(colorFilter: ColorFilter?) {}

    @Suppress("OVERRIDE_DEPRECATION")
    override fun getOpacity(): Int = PixelFormat.TRANSLUCENT
}

/** Тонкая полоска-индикатор с делениями (батарея, память, температура). */
class StatBar(ctx: Context) : View(ctx) {

    var value: Float = 0f
        set(v) {
            field = v.coerceIn(0f, 1f)
            invalidate()
        }

    private val track = Paint().apply { color = Palette.line }
    private val fill = Paint().apply { color = Palette.accent }
    private val tickPaint = Paint().apply { color = Palette.withAlpha(Palette.text, 70) }

    override fun onDraw(canvas: Canvas) {
        val w = width.toFloat()
        val mid = height / 2f
        val t = context.dp(3).toFloat()
        canvas.drawRect(0f, mid - t / 2f, w, mid + t / 2f, track)
        canvas.drawRect(0f, mid - t / 2f, w * value, mid + t / 2f, fill)
        for (i in 0..10) {
            val x = w * i / 10f
            canvas.drawRect(x - 0.5f, mid - t, x + 0.5f, mid + t, tickPaint)
        }
    }
}
