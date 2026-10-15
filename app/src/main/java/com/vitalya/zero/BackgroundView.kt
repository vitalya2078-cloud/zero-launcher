package com.vitalya.zero

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.RadialGradient
import android.graphics.Shader
import android.view.View

/** Статичные обои: рисуются один раз в bitmap, дальше только выводятся на экран. */
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

    private fun render(w: Int, h: Int): Bitmap {
        val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
        val c = Canvas(bmp)
        val wf = w.toFloat()
        val hf = h.toFloat()
        val p = Paint(Paint.ANTI_ALIAS_FLAG)

        // основа
        p.shader = LinearGradient(
            0f, 0f, 0f, hf,
            Color.parseColor("#0C0F16"), Color.parseColor("#040508"),
            Shader.TileMode.CLAMP
        )
        c.drawRect(0f, 0f, wf, hf, p)

        // акцентное свечение снизу слева и слабое сверху справа
        p.shader = RadialGradient(
            wf * 0.1f, hf * 0.95f, wf * 1.1f,
            Palette.withAlpha(Palette.accent, 52), Color.TRANSPARENT,
            Shader.TileMode.CLAMP
        )
        c.drawRect(0f, 0f, wf, hf, p)
        p.shader = RadialGradient(
            wf * 0.95f, hf * 0.05f, wf * 0.9f,
            Palette.withAlpha(Palette.accent, 22), Color.TRANSPARENT,
            Shader.TileMode.CLAMP
        )
        c.drawRect(0f, 0f, wf, hf, p)

        p.shader = null
        p.style = Paint.Style.STROKE

        // сетка
        p.strokeWidth = 1f
        p.color = Color.argb(12, 255, 255, 255)
        val step = context.dp(36).toFloat()
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

        // кольца прицела
        val cx = wf * 0.5f
        val cy = hf * 0.42f
        p.color = Palette.withAlpha(Palette.accent, 34)
        p.strokeWidth = context.dp(1).toFloat()
        for (i in 1..4) {
            c.drawCircle(cx, cy, wf * 0.16f * i, p)
        }

        // засечки на третьем кольце
        p.color = Palette.withAlpha(Palette.accent, 90)
        p.strokeWidth = context.dp(2).toFloat()
        val r = wf * 0.48f
        val t = context.dp(10).toFloat()
        c.drawLine(cx - r, cy, cx - r + t, cy, p)
        c.drawLine(cx + r, cy, cx + r - t, cy, p)
        c.drawLine(cx, cy - r, cx, cy - r + t, p)
        c.drawLine(cx, cy + r, cx, cy + r - t, p)

        // диагональные полосы снизу справа
        p.color = Palette.withAlpha(Palette.accent, 70)
        p.strokeWidth = context.dp(2).toFloat()
        c.drawLine(wf * 0.55f, hf, wf, hf * 0.86f, p)
        c.drawLine(wf * 0.64f, hf, wf, hf * 0.89f, p)

        // уголки экрана
        val m = context.dp(14).toFloat()
        val len = context.dp(22).toFloat()
        p.color = Color.argb(70, 255, 255, 255)
        p.strokeWidth = context.dp(1).toFloat()
        c.drawLine(m, m, m + len, m, p)
        c.drawLine(m, m, m, m + len, p)
        c.drawLine(wf - m, m, wf - m - len, m, p)
        c.drawLine(wf - m, m, wf - m, m + len, p)
        c.drawLine(m, hf - m, m + len, hf - m, p)
        c.drawLine(m, hf - m, m, hf - m - len, p)
        c.drawLine(wf - m, hf - m, wf - m - len, hf - m, p)
        c.drawLine(wf - m, hf - m, wf - m, hf - m - len, p)

        // виньетка
        p.style = Paint.Style.FILL
        p.shader = RadialGradient(
            wf / 2f, hf / 2f, hf * 0.8f,
            Color.TRANSPARENT, Color.argb(160, 0, 0, 0),
            Shader.TileMode.CLAMP
        )
        c.drawRect(0f, 0f, wf, hf, p)

        return bmp
    }
}
