package com.vitalya.zero

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.ColorFilter
import android.graphics.ColorMatrix
import android.graphics.ColorMatrixColorFilter
import android.graphics.Paint
import android.graphics.Path
import android.graphics.PixelFormat
import android.graphics.RectF
import android.graphics.Typeface
import android.graphics.drawable.Drawable
import android.util.TypedValue
import android.view.View

fun Context.dp(v: Float): Int =
    TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, resources.displayMetrics).toInt()

fun Context.dp(v: Int): Int = dp(v.toFloat())

/**
 * Текущие цвета и шрифты. Заполняется из активной темы в [apply] до построения UI;
 * при смене темы активность пересоздаётся, поэтому значения читаются один раз при создании view.
 */
object Palette {
    var theme: Theme = Themes.default
        private set

    var bg: Int = theme.bg
        private set
    var surface: Int = theme.surface
        private set
    var line: Int = theme.line
        private set
    var text: Int = theme.text
        private set
    var dim: Int = theme.dim
        private set
    var accent: Int = theme.accent
        private set
    var secondary: Int = theme.secondary
        private set

    /** Технический текст: подписи, заголовки, значения. */
    var mono: Typeface = Typeface.MONOSPACE
        private set

    /** Крупные часы на главном экране. */
    var clock: Typeface = Typeface.create("sans-serif-thin", Typeface.NORMAL)
        private set

    /** Подписи под иконками. */
    var label: Typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
        private set

    var monoIcons: Boolean = false
        private set

    /** Фильтр для монохромных иконок (оттенок акцента), null — оригинальные цвета. */
    var iconFilter: ColorFilter? = null
        private set

    fun apply(t: Theme, accentOverride: Int?, monochromeIcons: Boolean) {
        theme = t
        bg = t.bg
        surface = t.surface
        line = t.line
        text = t.text
        dim = t.dim
        accent = accentOverride ?: t.accent
        // если акцент переопределён, второй цвет тоже следует за ним, иначе фон «спорит» с акцентом
        secondary = if (accentOverride != null) accent else t.secondary
        when (t.font) {
            FontSet.MONO -> {
                mono = Typeface.MONOSPACE
                clock = Typeface.create("sans-serif-thin", Typeface.NORMAL)
                label = Typeface.create("sans-serif-medium", Typeface.NORMAL)
            }
            FontSet.CONDENSED -> {
                mono = Typeface.create("sans-serif-condensed", Typeface.BOLD)
                clock = Typeface.create("sans-serif-condensed-light", Typeface.NORMAL)
                label = Typeface.create("sans-serif-condensed", Typeface.NORMAL)
            }
            FontSet.TERMINAL -> {
                mono = Typeface.MONOSPACE
                clock = Typeface.MONOSPACE
                label = Typeface.MONOSPACE
            }
        }
        monoIcons = monochromeIcons
        iconFilter = if (monochromeIcons) tintFilter(accent) else null
    }

    fun withAlpha(color: Int, alpha: Int): Int = (color and 0x00FFFFFF) or (alpha shl 24)

    /** Обесцвечивает иконку и окрашивает её яркость в заданный цвет. */
    private fun tintFilter(color: Int): ColorFilter {
        val m = ColorMatrix()
        m.setSaturation(0f)
        val k = 1.35f / 255f
        val tint = ColorMatrix()
        tint.setScale(Color.red(color) * k, Color.green(color) * k, Color.blue(color) * k, 1f)
        m.postConcat(tint)
        return ColorMatrixColorFilter(m)
    }
}

/** Панель интерфейса. Внешний вид зависит от [FrameStyle] активной темы. */
class HudFrameDrawable(private val ctx: Context, private val fillAlpha: Int = 200) : Drawable() {

    private val style = Palette.theme.frame

    private val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        this.style = Paint.Style.FILL
        color = Palette.withAlpha(Palette.surface, fillAlpha)
    }
    private val border = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        this.style = Paint.Style.STROKE
        strokeWidth = ctx.dp(1).toFloat()
        color = when (style) {
            FrameStyle.BRACKETS -> Palette.withAlpha(Palette.line, 110)
            FrameStyle.ROUND -> Palette.withAlpha(Palette.accent, 90)
            else -> Palette.line
        }
    }
    private val tick = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        this.style = Paint.Style.STROKE
        strokeWidth = ctx.dp(2).toFloat()
        strokeCap = Paint.Cap.SQUARE
        color = Palette.accent
    }
    private val glow = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        this.style = Paint.Style.STROKE
        strokeWidth = ctx.dp(4).toFloat()
        color = Palette.withAlpha(Palette.accent, 28)
    }
    private val len = ctx.dp(if (style == FrameStyle.BRACKETS) 14 else 10).toFloat()
    private val cut = ctx.dp(12).toFloat()
    private val radius = ctx.dp(14).toFloat()
    private val path = Path()

    override fun draw(canvas: Canvas) {
        val r = RectF(bounds)
        r.inset(1f, 1f)
        when (style) {
            FrameStyle.CORNERS -> {
                canvas.drawRect(r, fill)
                canvas.drawRect(r, border)
                corners(canvas, r)
            }
            FrameStyle.BRACKETS -> {
                canvas.drawRect(r, fill)
                canvas.drawRect(r, border)
                corners(canvas, r)
            }
            FrameStyle.CUT -> {
                val c = minOf(cut, r.width() / 4f, r.height() / 4f)
                path.reset()
                path.moveTo(r.left + c, r.top)
                path.lineTo(r.right, r.top)
                path.lineTo(r.right, r.bottom - c)
                path.lineTo(r.right - c, r.bottom)
                path.lineTo(r.left, r.bottom)
                path.lineTo(r.left, r.top + c)
                path.close()
                canvas.drawPath(path, fill)
                canvas.drawPath(path, border)
                canvas.drawLine(r.left, r.top + c, r.left + c, r.top, tick)
                canvas.drawLine(r.right, r.bottom - c, r.right - c, r.bottom, tick)
                canvas.drawLine(r.right - len, r.top, r.right, r.top, tick)
                canvas.drawLine(r.left, r.bottom, r.left + len, r.bottom, tick)
            }
            FrameStyle.ROUND -> {
                val rr = minOf(radius, r.height() / 2f)
                canvas.drawRoundRect(r, rr, rr, fill)
                val g = RectF(r)
                g.inset(glow.strokeWidth / 2f, glow.strokeWidth / 2f)
                canvas.drawRoundRect(g, rr, rr, glow)
                canvas.drawRoundRect(r, rr, rr, border)
            }
        }
    }

    private fun corners(canvas: Canvas, r: RectF) {
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

/** Индикатор (батарея, память, температура): сплошная полоска с делениями или сегменты. */
class StatBar(ctx: Context) : View(ctx) {

    var value: Float = 0f
        set(v) {
            field = v.coerceIn(0f, 1f)
            invalidate()
        }

    private val segmented = Palette.theme.segmentedBars
    private val track = Paint().apply { color = Palette.line }
    private val fill = Paint().apply { color = Palette.accent }
    private val tickPaint = Paint().apply { color = Palette.withAlpha(Palette.text, 70) }

    override fun onDraw(canvas: Canvas) {
        val w = width.toFloat()
        val mid = height / 2f
        if (segmented) {
            val n = 20
            val gap = context.dp(2).toFloat()
            val seg = (w - gap * (n - 1)) / n
            val h = context.dp(8).toFloat()
            val lit = Math.round(value * n)
            for (i in 0 until n) {
                val x = i * (seg + gap)
                canvas.drawRect(x, mid - h / 2f, x + seg, mid + h / 2f, if (i < lit) fill else track)
            }
            return
        }
        val t = context.dp(3).toFloat()
        canvas.drawRect(0f, mid - t / 2f, w, mid + t / 2f, track)
        canvas.drawRect(0f, mid - t / 2f, w * value, mid + t / 2f, fill)
        for (i in 0..10) {
            val x = w * i / 10f
            canvas.drawRect(x - 0.5f, mid - t, x + 0.5f, mid + t, tickPaint)
        }
    }
}
