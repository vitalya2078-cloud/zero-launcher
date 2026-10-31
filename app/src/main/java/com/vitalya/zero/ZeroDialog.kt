package com.vitalya.zero

import android.app.Dialog
import android.content.Context
import android.graphics.Color
import android.graphics.drawable.ColorDrawable
import android.graphics.drawable.GradientDrawable
import android.text.TextUtils
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.Window
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView

/** ScrollView, который не растёт выше заданной высоты. */
private class MaxHeightScroll(ctx: Context, private val maxH: Int) : ScrollView(ctx) {
    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        super.onMeasure(widthMeasureSpec, MeasureSpec.makeMeasureSpec(maxH, MeasureSpec.AT_MOST))
    }
}

/** Диалоги в стиле активной темы вместо системных AlertDialog. */
object ZeroDialog {

    private const val MATCH = ViewGroup.LayoutParams.MATCH_PARENT
    private const val WRAP = ViewGroup.LayoutParams.WRAP_CONTENT

    private fun text(ctx: Context, s: String, sp: Float, color: Int, spacing: Float = 0.1f): TextView {
        val t = TextView(ctx)
        t.text = s
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, sp)
        t.setTextColor(color)
        t.typeface = Palette.mono
        t.letterSpacing = spacing
        t.includeFontPadding = false
        return t
    }

    /**
     * Общая оболочка: заголовок, прокручиваемое содержимое и строка кнопок.
     * Кнопки закрывают диалог перед вызовом обработчика.
     */
    private fun show(
        ctx: Context,
        title: String,
        body: View,
        buttons: List<Pair<String, () -> Unit>> = emptyList()
    ): Dialog {
        val dlg = Dialog(ctx)
        dlg.requestWindowFeature(Window.FEATURE_NO_TITLE)

        val box = LinearLayout(ctx)
        box.orientation = LinearLayout.VERTICAL
        box.background = HudFrameDrawable(ctx, 250)
        box.setPadding(ctx.dp(18), ctx.dp(16), ctx.dp(18), ctx.dp(12))

        val head = text(ctx, "// " + title.uppercase(), 12f, Palette.accent, 0.22f)
        head.maxLines = 2
        head.ellipsize = TextUtils.TruncateAt.END
        box.addView(head, LinearLayout.LayoutParams(MATCH, WRAP).apply { bottomMargin = ctx.dp(10) })

        val dm = ctx.resources.displayMetrics
        val sv = MaxHeightScroll(ctx, (dm.heightPixels * 0.62f).toInt())
        sv.isVerticalScrollBarEnabled = false
        sv.overScrollMode = View.OVER_SCROLL_NEVER
        sv.addView(body)
        box.addView(sv, LinearLayout.LayoutParams(MATCH, WRAP))

        if (buttons.isNotEmpty()) {
            val row = LinearLayout(ctx)
            row.orientation = LinearLayout.HORIZONTAL
            row.gravity = Gravity.END
            buttons.forEachIndexed { i, (name, action) ->
                val b = text(ctx, "[ $name ]", 12f, if (i == buttons.lastIndex) Palette.accent else Palette.text)
                b.setPadding(ctx.dp(10), ctx.dp(12), ctx.dp(10), ctx.dp(8))
                b.setOnClickListener {
                    dlg.dismiss()
                    action()
                }
                row.addView(b, LinearLayout.LayoutParams(WRAP, WRAP))
            }
            box.addView(row, LinearLayout.LayoutParams(MATCH, WRAP).apply { topMargin = ctx.dp(6) })
        }

        dlg.setContentView(box)
        dlg.window?.let { w ->
            w.setBackgroundDrawable(ColorDrawable(Color.TRANSPARENT))
            w.setLayout((dm.widthPixels * 0.88f).toInt(), WRAP)
            w.setDimAmount(0.7f)
        }
        dlg.show()
        return dlg
    }

    /** Строка списка: опциональная плашка-образец слева, название, подпись и отметка справа. */
    private fun row(
        ctx: Context,
        name: String,
        sub: String? = null,
        mark: String? = null,
        markColor: Int = Palette.accent,
        swatch: View? = null
    ): LinearLayout {
        val r = LinearLayout(ctx)
        r.orientation = LinearLayout.HORIZONTAL
        r.gravity = Gravity.CENTER_VERTICAL
        r.setPadding(ctx.dp(4), ctx.dp(11), ctx.dp(4), ctx.dp(11))
        if (swatch != null) {
            val lp = swatch.layoutParams?.let { LinearLayout.LayoutParams(it) } ?: LinearLayout.LayoutParams(WRAP, WRAP)
            lp.rightMargin = ctx.dp(12)
            r.addView(swatch, lp)
        }
        val col = LinearLayout(ctx)
        col.orientation = LinearLayout.VERTICAL
        val n = text(ctx, name, 14f, Palette.text, 0.06f)
        n.maxLines = 1
        n.ellipsize = TextUtils.TruncateAt.END
        col.addView(n, LinearLayout.LayoutParams(MATCH, WRAP))
        if (sub != null) {
            col.addView(
                text(ctx, sub, 10f, Palette.dim, 0.12f),
                LinearLayout.LayoutParams(MATCH, WRAP).apply { topMargin = ctx.dp(4) }
            )
        }
        r.addView(col, LinearLayout.LayoutParams(0, WRAP, 1f))
        if (mark != null) {
            r.addView(text(ctx, mark, 13f, markColor), LinearLayout.LayoutParams(WRAP, WRAP))
        }
        return r
    }

    private fun column(ctx: Context): LinearLayout =
        LinearLayout(ctx).apply { orientation = LinearLayout.VERTICAL }

    private fun dot(ctx: Context, color: Int, sizeDp: Int, ring: Boolean = false): View {
        val v = View(ctx)
        val g = GradientDrawable()
        g.shape = GradientDrawable.OVAL
        g.setColor(color)
        if (ring) g.setStroke(ctx.dp(1), Palette.withAlpha(Palette.text, 90))
        v.background = g
        v.layoutParams = LinearLayout.LayoutParams(ctx.dp(sizeDp), ctx.dp(sizeDp))
        return v
    }

    fun list(ctx: Context, title: String, items: List<String>, onPick: (Int) -> Unit) {
        val col = column(ctx)
        lateinit var dlg: Dialog
        items.forEachIndexed { i, s ->
            val r = row(ctx, s, mark = "›", markColor = Palette.dim)
            r.setOnClickListener {
                dlg.dismiss()
                onPick(i)
            }
            col.addView(r, LinearLayout.LayoutParams(MATCH, WRAP))
        }
        dlg = show(ctx, title, col)
    }

    fun multi(
        ctx: Context,
        title: String,
        items: List<String>,
        checked: BooleanArray,
        onOk: (BooleanArray) -> Unit
    ) {
        val col = column(ctx)
        items.forEachIndexed { i, s ->
            val r = row(ctx, s, mark = if (checked[i]) "[x]" else "[ ]")
            val mark = r.getChildAt(r.childCount - 1) as TextView
            r.setOnClickListener {
                checked[i] = !checked[i]
                mark.text = if (checked[i]) "[x]" else "[ ]"
            }
            col.addView(r, LinearLayout.LayoutParams(MATCH, WRAP))
        }
        show(ctx, title, col, listOf("ОТМЕНА" to {}, "OK" to { onOk(checked) }))
    }

    /** Выбор темы: у каждой строки — мини-превью палитры. */
    fun themes(ctx: Context, current: Theme, onPick: (Theme) -> Unit) {
        val col = column(ctx)
        lateinit var dlg: Dialog
        Themes.all.forEach { t ->
            val preview = LinearLayout(ctx)
            preview.orientation = LinearLayout.HORIZONTAL
            preview.gravity = Gravity.CENTER_VERTICAL
            val bg = GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM, intArrayOf(t.bgTop, t.bgBottom))
            bg.setStroke(ctx.dp(1), t.line)
            bg.cornerRadius = ctx.dp(3).toFloat()
            preview.background = bg
            preview.setPadding(ctx.dp(8), ctx.dp(8), ctx.dp(8), ctx.dp(8))
            listOf(t.accent, t.secondary, t.text).forEachIndexed { i, color ->
                val d = dot(ctx, color, if (i == 0) 14 else 9)
                if (i > 0) (d.layoutParams as LinearLayout.LayoutParams).leftMargin = ctx.dp(5)
                preview.addView(d)
            }
            val isCur = t.id == current.id
            val r = row(
                ctx, t.name, sub = t.tagline.uppercase() + " · " + t.frame.name + " · " + t.pattern.name,
                mark = if (isCur) "●" else null, swatch = preview
            )
            r.setOnClickListener {
                dlg.dismiss()
                if (!isCur) onPick(t)
            }
            col.addView(r, LinearLayout.LayoutParams(MATCH, WRAP))
        }
        dlg = show(ctx, "Тема", col)
    }

    /** Выбор акцента. Пустой ключ — «как в теме». */
    fun accents(ctx: Context, currentKey: String, theme: Theme, onPick: (String) -> Unit) {
        val col = column(ctx)
        lateinit var dlg: Dialog
        val options = listOf("" to theme.accent) + Themes.accents
        options.forEach { (key, color) ->
            val isCur = key == currentKey
            val name = if (key.isEmpty()) "ПО ТЕМЕ" else key
            val sub = if (key.isEmpty()) theme.name else null
            val r = row(ctx, name, sub = sub, mark = if (isCur) "●" else null, swatch = dot(ctx, color, 18, ring = true))
            r.setOnClickListener {
                dlg.dismiss()
                if (!isCur) onPick(key)
            }
            col.addView(r, LinearLayout.LayoutParams(MATCH, WRAP))
        }
        dlg = show(ctx, "Акцентный цвет", col)
    }
}
