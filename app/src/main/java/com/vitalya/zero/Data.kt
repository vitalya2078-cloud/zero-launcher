package com.vitalya.zero

import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.graphics.drawable.Drawable
import android.os.Handler
import android.os.Looper
import android.text.TextUtils
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.BaseAdapter
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView

data class AppItem(
    val label: String,
    val pkg: String,
    val cls: String,
    val icon: Drawable,
    val isGame: Boolean
)

class Store(ctx: Context) {
    private val sp = ctx.getSharedPreferences("zero", Context.MODE_PRIVATE)

    fun list(key: String): MutableList<String> =
        (sp.getString(key, "") ?: "").split("\n").filter { it.isNotEmpty() }.toMutableList()

    fun setList(key: String, v: List<String>) {
        sp.edit().putString(key, v.joinToString("\n")).apply()
    }

    init {
        migrateAccent()
    }

    /** id активной темы, см. [Themes]. */
    var themeId: String
        get() = sp.getString("theme", Themes.default.id) ?: Themes.default.id
        set(v) {
            sp.edit().putString("theme", v).apply()
        }

    /** Ключ акцента из [Themes.accents]; пустая строка — акцент самой темы. */
    var accentKey: String
        get() = sp.getString("accentKey", "") ?: ""
        set(v) {
            sp.edit().putString("accentKey", v).apply()
        }

    var monoIcons: Boolean
        get() = sp.getBoolean("monoIcons", false)
        set(v) {
            sp.edit().putBoolean("monoIcons", v).apply()
        }

    /**
     * Раньше акцент хранился индексом ("accent": Int) в списке MINT, RED, VIOLET, AMBER, ICE.
     * Переносим выбор в новый формат; MINT (0) совпадает с акцентом темы ZERO, поэтому он становится «по теме».
     */
    private fun migrateAccent() {
        if (!sp.contains("accent")) return
        val old = listOf("MINT", "RED", "VIOLET", "AMBER", "ICE")
        val idx = sp.getInt("accent", 0)
        val e = sp.edit()
        if (!sp.contains("accentKey") && idx in 1 until old.size) e.putString("accentKey", old[idx])
        e.remove("accent").apply()
    }

    var dockInit: Boolean
        get() = sp.getBoolean("dockInit", false)
        set(v) {
            sp.edit().putBoolean("dockInit", v).apply()
        }
}

class AppRepo(private val ctx: Context) {

    @Volatile
    var apps: List<AppItem> = emptyList()

    private val main = Handler(Looper.getMainLooper())

    fun reload(done: () -> Unit) {
        Thread {
            val pm = ctx.packageManager
            val query = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
            val list = pm.queryIntentActivities(query, 0).mapNotNull { ri ->
                val ai = ri.activityInfo ?: return@mapNotNull null
                if (ai.packageName == ctx.packageName) return@mapNotNull null
                AppItem(
                    ri.loadLabel(pm).toString(),
                    ai.packageName,
                    ai.name,
                    ri.loadIcon(pm),
                    isGame(ai.applicationInfo)
                )
            }.sortedBy { it.label.lowercase() }
            apps = list
            main.post { done() }
        }.start()
    }

    @Suppress("DEPRECATION")
    private fun isGame(ai: ApplicationInfo?): Boolean {
        if (ai == null) return false
        return ai.category == ApplicationInfo.CATEGORY_GAME ||
            (ai.flags and ApplicationInfo.FLAG_IS_GAME) != 0
    }
}

class AppAdapter(private val ctx: Context, private val compact: Boolean) : BaseAdapter() {

    var items: List<AppItem> = emptyList()
        set(v) {
            field = v
            notifyDataSetChanged()
        }

    override fun getCount(): Int = items.size

    override fun getItem(position: Int): AppItem = items[position]

    override fun getItemId(position: Int): Long = position.toLong()

    override fun getView(position: Int, convertView: View?, parent: ViewGroup?): View {
        val cell = (convertView as? LinearLayout) ?: createCell()
        val app = items[position]
        val icon = cell.getChildAt(0) as ImageView
        icon.setImageDrawable(app.icon)
        icon.colorFilter = Palette.iconFilter
        (cell.getChildAt(1) as TextView).text = app.label
        return cell
    }

    private fun createCell(): LinearLayout {
        val size = ctx.dp(if (compact) 44 else 54)
        val cell = LinearLayout(ctx)
        cell.orientation = LinearLayout.VERTICAL
        cell.gravity = Gravity.CENTER_HORIZONTAL
        cell.setPadding(ctx.dp(4), ctx.dp(10), ctx.dp(4), ctx.dp(10))

        val icon = ImageView(ctx)
        cell.addView(icon, LinearLayout.LayoutParams(size, size))

        val name = TextView(ctx)
        name.setTextSize(TypedValue.COMPLEX_UNIT_SP, 10.5f)
        name.setTextColor(Palette.text)
        name.gravity = Gravity.CENTER
        name.maxLines = 1
        name.ellipsize = TextUtils.TruncateAt.END
        name.typeface = Palette.label
        val lp = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
        lp.topMargin = ctx.dp(6)
        cell.addView(name, lp)
        return cell
    }
}
