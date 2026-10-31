package com.vitalya.zero

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RadialGradient
import android.graphics.Shader
import android.view.View
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt

/** Статичные обои: рисуются один раз в bitmap по активной теме, дальше только выводятся на экран. */
class BackgroundView(ctx: Context) : View(ctx) {

    private var cache: Bitmap? = null

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        super.onSizeChanged(w, h, oldw, oldh)
        cache?.recycle()
        cache = if (w > 0 && h > 0) render(w, h) else null
    }

    override fun onDraw(canvas: Canvas) {
        cache?.let { canvas.drawBitmap(it, 0f, 0f, null) }
    }

    private fun d(v: Int): Float = context.dp(v).toFloat()

    private fun render(w: Int, h: Int): Bitmap {
        val t = Palette.theme
        val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
        val c = Canvas(bmp)
        val wf = w.toFloat()
        val hf = h.toFloat()
        val p = Paint(Paint.ANTI_ALIAS_FLAG)

        // основа
        p.shader = LinearGradient(0f, 0f, 0f, hf, t.bgTop, t.bgBottom, Shader.TileMode.CLAMP)
        c.drawRect(0f, 0f, wf, hf, p)

        // свечение акцента снизу слева и второго цвета сверху справа
        p.shader = RadialGradient(
            wf * 0.1f, hf * 0.95f, wf * 1.1f,
            Palette.withAlpha(Palette.accent, 52), Color.TRANSPARENT,
            Shader.TileMode.CLAMP
        )
        c.drawRect(0f, 0f, wf, hf, p)
        p.shader = RadialGradient(
            wf * 0.95f, hf * 0.05f, wf * 0.9f,
            Palette.withAlpha(Palette.secondary, 26), Color.TRANSPARENT,
            Shader.TileMode.CLAMP
        )
        c.drawRect(0f, 0f, wf, hf, p)
        p.shader = null

        when (t.pattern) {
            Pattern.GRID_RINGS -> gridRings(c, p, wf, hf)
            Pattern.SCANLINES -> scanlines(c, p, wf, hf)
            Pattern.HEX -> hex(c, p, wf, hf)
            Pattern.HORIZON -> horizon(c, p, wf, hf)
            Pattern.HAZARD -> hazard(c, p, wf, hf)
            Pattern.DOTS -> dots(c, p, wf, hf)
        }

        screenCorners(c, p, wf, hf)

        // виньетка
        p.style = Paint.Style.FILL
        p.shader = RadialGradient(
            wf / 2f, hf / 2f, hf * 0.8f,
            Color.TRANSPARENT, Color.argb(160, 0, 0, 0),
            Shader.TileMode.CLAMP
        )
        c.drawRect(0f, 0f, wf, hf, p)
        p.shader = null

        return bmp
    }

    private fun grid(c: Canvas, p: Paint, wf: Float, hf: Float, step: Float, alpha: Int) {
        p.style = Paint.Style.STROKE
        p.strokeWidth = 1f
        p.color = Color.argb(alpha, 255, 255, 255)
        var x = 0f
        while (x <= wf) {
            c.drawLine(x, 0f, x, hf, p)
            x += step
        }
        var y = 0f
        while (y <= hf) {
            c.drawLine(0f, y, wf, y, p)
            y += step
        }
    }

    private fun gridRings(c: Canvas, p: Paint, wf: Float, hf: Float) {
        grid(c, p, wf, hf, d(36), 12)

        // кольца прицела
        val cx = wf * 0.5f
        val cy = hf * 0.42f
        p.color = Palette.withAlpha(Palette.accent, 34)
        p.strokeWidth = d(1)
        for (i in 1..4) c.drawCircle(cx, cy, wf * 0.16f * i, p)

        // засечки на третьем кольце
        p.color = Palette.withAlpha(Palette.accent, 90)
        p.strokeWidth = d(2)
        val r = wf * 0.48f
        val t = d(10)
        c.drawLine(cx - r, cy, cx - r + t, cy, p)
        c.drawLine(cx + r, cy, cx + r - t, cy, p)
        c.drawLine(cx, cy - r, cx, cy - r + t, p)
        c.drawLine(cx, cy + r, cx, cy + r - t, p)

        diagonalStripes(c, p, wf, hf)
    }

    private fun diagonalStripes(c: Canvas, p: Paint, wf: Float, hf: Float) {
        p.style = Paint.Style.STROKE
        p.color = Palette.withAlpha(Palette.accent, 70)
        p.strokeWidth = d(2)
        c.drawLine(wf * 0.55f, hf, wf, hf * 0.86f, p)
        c.drawLine(wf * 0.64f, hf, wf, hf * 0.89f, p)
    }

    private fun scanlines(c: Canvas, p: Paint, wf: Float, hf: Float) {
        // полосы развёртки
        p.style = Paint.Style.FILL
        p.color = Color.argb(46, 0, 0, 0)
        val step = d(3)
        var y = 0f
        while (y < hf) {
            c.drawRect(0f, y, wf, y + step / 2f, p)
            y += step
        }
        // светящаяся полоса «развёртки»
        val by = hf * 0.36f
        p.shader = LinearGradient(
            0f, by - d(60), 0f, by + d(60),
            intArrayOf(Color.TRANSPARENT, Palette.withAlpha(Palette.accent, 24), Color.TRANSPARENT),
            null, Shader.TileMode.CLAMP
        )
        c.drawRect(0f, by - d(60), wf, by + d(60), p)
        p.shader = null

        // рамка «экрана» терминала
        p.style = Paint.Style.STROKE
        p.strokeWidth = d(1)
        p.color = Palette.withAlpha(Palette.accent, 40)
        val m = d(26)
        c.drawRoundRect(m, m * 1.6f, wf - m, hf - m * 1.6f, d(18), d(18), p)
    }

    private fun hex(c: Canvas, p: Paint, wf: Float, hf: Float) {
        val r = d(22)
        val hw = sqrt(3f) * r
        val path = Path()
        p.style = Paint.Style.STROKE
        p.strokeWidth = d(1)
        var row = 0
        var cy = 0f
        while (cy < hf + r) {
            var cx = if (row % 2 == 0) 0f else hw / 2f
            // соты гаснут к центру экрана, ярче у верхнего и нижнего краёв
            val edge = kotlin.math.abs(cy / hf - 0.5f) * 2f
            p.color = Palette.withAlpha(Palette.accent, (8 + 30 * edge * edge).toInt())
            while (cx < wf + hw) {
                path.reset()
                for (i in 0 until 6) {
                    val a = Math.toRadians((60 * i - 30).toDouble())
                    val x = cx + r * cos(a).toFloat()
                    val y = cy + r * sin(a).toFloat()
                    if (i == 0) path.moveTo(x, y) else path.lineTo(x, y)
                }
                path.close()
                c.drawPath(path, p)
                cx += hw
            }
            cy += r * 1.5f
            row++
        }
        diagonalStripes(c, p, wf, hf)
    }

    private fun horizon(c: Canvas, p: Paint, wf: Float, hf: Float) {
        val hy = hf * 0.62f
        val cx = wf / 2f

        // солнце с горизонтальными прорезями
        val sr = wf * 0.30f
        val sy = hy - sr * 0.35f
        p.style = Paint.Style.FILL
        p.shader = LinearGradient(
            0f, sy - sr, 0f, sy + sr,
            Palette.withAlpha(Palette.secondary, 120), Palette.withAlpha(Palette.accent, 110),
            Shader.TileMode.CLAMP
        )
        c.save()
        c.clipRect(0f, 0f, wf, hy)
        c.drawCircle(cx, sy, sr, p)
        p.shader = null
        p.color = Palette.theme.bgBottom
        var k = 0
        var y = sy + sr * 0.05f
        while (y < hy) {
            // прорези расширяются книзу
            val gap = d(2) + k * d(1)
            c.drawRect(cx - sr, y, cx + sr, y + gap, p)
            y += d(12)
            k++
        }
        c.restore()

        // земля
        p.shader = LinearGradient(
            0f, hy, 0f, hf,
            Palette.withAlpha(Palette.accent, 30), Color.TRANSPARENT,
            Shader.TileMode.CLAMP
        )
        c.drawRect(0f, hy, wf, hf, p)
        p.shader = null

        // перспективная сетка
        p.style = Paint.Style.STROKE
        p.strokeWidth = d(1)
        p.color = Palette.withAlpha(Palette.accent, 110)
        c.drawLine(0f, hy, wf, hy, p)
        p.color = Palette.withAlpha(Palette.accent, 60)
        val n = 14
        for (i in -n..n) {
            val bx = cx + i * wf / 6f
            c.drawLine(cx + i * d(6), hy, bx, hf, p)
        }
        var gy = 0f
        var step = d(4)
        while (hy + gy < hf) {
            c.drawLine(0f, hy + gy, wf, hy + gy, p)
            gy += step
            step *= 1.32f
        }
    }

    private fun hazard(c: Canvas, p: Paint, wf: Float, hf: Float) {
        grid(c, p, wf, hf, d(48), 8)

        // предупреждающие полосы по диагонали в верхнем правом и нижнем левом углах
        p.style = Paint.Style.FILL
        p.color = Palette.withAlpha(Palette.accent, 34)
        val band = d(14)
        val path = Path()
        for (i in 0 until 6) {
            val o = i * band * 2f
            path.reset()
            path.moveTo(wf - d(150) + o, 0f)
            path.lineTo(wf - d(150) + o + band, 0f)
            path.lineTo(wf, d(150) - o - band)
            path.lineTo(wf, d(150) - o)
            path.close()
            c.drawPath(path, p)
        }
        p.color = Palette.withAlpha(Palette.accent, 22)
        for (i in 0 until 5) {
            val o = i * band * 2f
            path.reset()
            path.moveTo(0f, hf - d(130) + o)
            path.lineTo(0f, hf - d(130) + o + band)
            path.lineTo(d(130) - o - band, hf)
            path.lineTo(d(130) - o, hf)
            path.close()
            c.drawPath(path, p)
        }

        // вертикальная шкала слева
        p.style = Paint.Style.STROKE
        p.strokeWidth = d(1)
        p.color = Palette.withAlpha(Palette.accent, 60)
        val x = d(8)
        var y = hf * 0.25f
        var i = 0
        while (y < hf * 0.6f) {
            c.drawLine(x, y, x + if (i % 5 == 0) d(12) else d(6), y, p)
            y += d(8)
            i++
        }
    }

    private fun dots(c: Canvas, p: Paint, wf: Float, hf: Float) {
        p.style = Paint.Style.FILL
        p.color = Color.argb(26, 255, 255, 255)
        val step = d(18)
        val r = d(1).coerceAtLeast(1.5f) * 0.9f
        var y = step / 2f
        while (y < hf) {
            var x = step / 2f
            while (x < wf) {
                c.drawCircle(x, y, r, p)
                x += step
            }
            y += step
        }
        // одна тонкая линия-горизонт
        p.color = Palette.withAlpha(Palette.accent, 40)
        c.drawRect(0f, hf * 0.42f, wf, hf * 0.42f + d(1), p)
    }

    private fun screenCorners(c: Canvas, p: Paint, wf: Float, hf: Float) {
        val m = d(14)
        val len = d(22)
        p.style = Paint.Style.STROKE
        p.shader = null
        p.color = Color.argb(70, 255, 255, 255)
        p.strokeWidth = d(1)
        c.drawLine(m, m, m + len, m, p)
        c.drawLine(m, m, m, m + len, p)
        c.drawLine(wf - m, m, wf - m - len, m, p)
        c.drawLine(wf - m, m, wf - m, m + len, p)
        c.drawLine(m, hf - m, m + len, hf - m, p)
        c.drawLine(m, hf - m, m, hf - m - len, p)
        c.drawLine(wf - m, hf - m, wf - m - len, hf - m, p)
        c.drawLine(wf - m, hf - m, wf - m, hf - m - len, p)
    }
}
