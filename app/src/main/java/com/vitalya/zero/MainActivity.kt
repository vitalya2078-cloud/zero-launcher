package com.vitalya.zero

import android.animation.ValueAnimator
import android.app.ActivityManager
import android.app.ActivityOptions
import android.app.Activity
import android.app.AlertDialog
import android.app.Notification
import android.app.PendingIntent
import android.appwidget.AppWidgetHost
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProviderInfo
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.content.res.ColorStateList
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.ColorDrawable
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager
import android.media.AudioManager
import android.net.Uri
import android.os.BatteryManager
import android.os.Bundle
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.os.StatFs
import android.provider.MediaStore
import android.provider.Settings
import android.service.notification.StatusBarNotification
import android.text.Editable
import android.text.TextUtils
import android.text.TextWatcher
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowInsets
import android.view.animation.DecelerateInterpolator
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputMethodManager
import android.widget.AdapterView
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.GridView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.SeekBar
import android.widget.TextClock
import android.widget.TextView
import android.widget.Toast
import kotlin.math.abs

class MainActivity : Activity(), GestureFrame.Controller {

    companion object {
        private const val HOST_ID = 1024
        private const val REQ_BIND = 41
        private const val REQ_CONFIG = 42
        private const val MATCH = ViewGroup.LayoutParams.MATCH_PARENT
        private const val WRAP = ViewGroup.LayoutParams.WRAP_CONTENT
    }

    private enum class Mode { NONE, PAGE, TOP_OPEN, TOP_CLOSE, BOTTOM_OPEN, BOTTOM_CLOSE, DRAWER_OPEN, DRAWER_CLOSE }

    private lateinit var store: Store
    private lateinit var repo: AppRepo
    private lateinit var root: GestureFrame

    private lateinit var homePage: FrameLayout
    private lateinit var widgetsPage: FrameLayout
    private lateinit var homeCol: LinearLayout
    private lateinit var widgetsCol: LinearLayout
    private lateinit var widgetsList: LinearLayout
    private lateinit var widgetsHint: TextView
    private lateinit var dockRow: LinearLayout
    private lateinit var scrim: View

    private lateinit var topSheet: Sheet
    private lateinit var bottomSheet: Sheet
    private lateinit var drawerSheet: Sheet
    private lateinit var topBox: LinearLayout
    private lateinit var bottomBox: LinearLayout
    private lateinit var drawerBox: LinearLayout

    private lateinit var drawerGrid: GridView
    private lateinit var drawerAdapter: AppAdapter
    private lateinit var arsenalGrid: GridView
    private lateinit var arsenalAdapter: AppAdapter
    private lateinit var arsenalEmpty: TextView
    private lateinit var searchField: EditText

    private lateinit var notifList: LinearLayout
    private lateinit var volSeek: SeekBar
    private lateinit var torchSub: TextView

    private lateinit var statBat: StatBar
    private lateinit var statRam: StatBar
    private lateinit var statRom: StatBar
    private lateinit var statTmp: StatBar
    private lateinit var batVal: TextView
    private lateinit var ramVal: TextView
    private lateinit var romVal: TextView
    private lateinit var tmpVal: TextView

    private lateinit var widgetHost: AppWidgetHost
    private lateinit var widgetMgr: AppWidgetManager
    private var pendingWidgetId = -1

    private val audio by lazy { getSystemService(AudioManager::class.java) }
    private val cam by lazy { getSystemService(CameraManager::class.java) }
    private var flashId: String? = null
    private var torchOn = false

    private val handler = Handler(Looper.getMainLooper())
    private var insetTop = 0
    private var insetBottom = 0
    private var pageT = 0f
    private var pageAnim: ValueAnimator? = null
    private var mode = Mode.NONE
    private var startPageT = 0f
    private var lastW = 0
    private var lastH = 0
    private var visible: List<AppItem> = emptyList()

    private val ticker = object : Runnable {
        override fun run() {
            updateStats()
            handler.postDelayed(this, 3000)
        }
    }

    private val pkgReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            repo.reload { onAppsChanged() }
        }
    }

    // ------------------------------------------------------------------ lifecycle

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        store = Store(this)
        val idx = store.accent.coerceIn(0, Palette.accents.size - 1)
        Palette.accent = Color.parseColor(Palette.accents[idx].second)

        window.setDecorFitsSystemWindows(false)
        window.statusBarColor = Color.TRANSPARENT
        window.navigationBarColor = Color.TRANSPARENT
        window.isNavigationBarContrastEnforced = false

        repo = AppRepo(this)
        widgetMgr = AppWidgetManager.getInstance(this)
        widgetHost = AppWidgetHost(this, HOST_ID)

        buildUi()
        setContentView(root)

        restoreWidgets()
        repo.reload { onAppsChanged() }
        ZeroNotificationService.onChange = { runOnUiThread { refreshNotifications() } }
        registerTorch()
    }

    override fun onStart() {
        super.onStart()
        try {
            widgetHost.startListening()
        } catch (e: Exception) {
        }
        val f = IntentFilter()
        f.addAction(Intent.ACTION_PACKAGE_ADDED)
        f.addAction(Intent.ACTION_PACKAGE_REMOVED)
        f.addAction(Intent.ACTION_PACKAGE_CHANGED)
        f.addDataScheme("package")
        registerReceiver(pkgReceiver, f)
    }

    override fun onStop() {
        super.onStop()
        try {
            widgetHost.stopListening()
        } catch (e: Exception) {
        }
        try {
            unregisterReceiver(pkgReceiver)
        } catch (e: Exception) {
        }
    }

    override fun onResume() {
        super.onResume()
        handler.post(ticker)
        if (repo.apps.isEmpty()) repo.reload { onAppsChanged() }
    }

    override fun onPause() {
        super.onPause()
        handler.removeCallbacks(ticker)
    }

    override fun onDestroy() {
        super.onDestroy()
        ZeroNotificationService.onChange = null
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        if (anyOpen() || pageT > 0f) {
            closeAll()
            animatePage(0f)
        }
    }

    @Suppress("OVERRIDE_DEPRECATION", "DEPRECATION")
    override fun onBackPressed() {
        if (anyOpen()) {
            closeAll()
        } else if (pageT > 0f) {
            animatePage(0f)
        }
        // на домашнем экране «назад» ничего не делает
    }

    // ------------------------------------------------------------------ UI building

    private fun lp(
        w: Int = MATCH,
        h: Int = WRAP,
        top: Int = 0,
        bottom: Int = 0,
        weight: Float = 0f
    ): LinearLayout.LayoutParams {
        val p = LinearLayout.LayoutParams(w, h, weight)
        p.topMargin = dp(top)
        p.bottomMargin = dp(bottom)
        return p
    }

    private fun label(
        text: String,
        sizeSp: Float,
        color: Int,
        mono: Boolean = true,
        spacing: Float = 0.12f
    ): TextView {
        val t = TextView(this)
        t.text = text
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, sizeSp)
        t.setTextColor(color)
        t.typeface = if (mono) Typeface.MONOSPACE else Typeface.create("sans-serif-light", Typeface.NORMAL)
        t.letterSpacing = spacing
        t.includeFontPadding = false
        return t
    }

    private fun toast(msg: String) {
        Toast.makeText(this, msg, Toast.LENGTH_SHORT).show()
    }

    private fun buildUi() {
        root = GestureFrame(this)
        root.setBackgroundColor(Palette.bg)
        root.controller = this

        root.addView(BackgroundView(this), FrameLayout.LayoutParams(MATCH, MATCH))

        widgetsPage = buildWidgetsPage()
        homePage = buildHomePage()
        root.addView(widgetsPage, FrameLayout.LayoutParams(MATCH, MATCH))
        root.addView(homePage, FrameLayout.LayoutParams(MATCH, MATCH))

        scrim = View(this)
        scrim.setBackgroundColor(Color.BLACK)
        scrim.alpha = 0f
        scrim.visibility = View.GONE
        scrim.setOnClickListener { closeAll() }
        root.addView(scrim, FrameLayout.LayoutParams(MATCH, MATCH))

        val topView = buildTopShade()
        val bottomView = buildBottomShade()
        val drawerView = buildDrawer()

        val topLp = FrameLayout.LayoutParams(MATCH, dp(400))
        topLp.gravity = Gravity.TOP
        root.addView(topView, topLp)

        val bottomLp = FrameLayout.LayoutParams(MATCH, dp(400))
        bottomLp.gravity = Gravity.BOTTOM
        root.addView(bottomView, bottomLp)

        root.addView(drawerView, FrameLayout.LayoutParams(MATCH, MATCH))

        topSheet = Sheet(topView, true)
        bottomSheet = Sheet(bottomView, false)
        drawerSheet = Sheet(drawerView, false)
        topSheet.onProgress = { updateScrim() }
        bottomSheet.onProgress = { updateScrim() }
        drawerSheet.onProgress = {
            updateScrim()
            if (it <= 0f) resetSearch()
        }

        setPage(0f)

        root.setOnApplyWindowInsetsListener { _, ins ->
            val b = ins.getInsets(WindowInsets.Type.systemBars() or WindowInsets.Type.displayCutout())
            insetTop = b.top
            insetBottom = b.bottom
            applyInsets()
            ins
        }

        root.addOnLayoutChangeListener { _, l, t, r, b, _, _, _, _ ->
            val w = r - l
            val h = b - t
            if (w > 0 && h > 0 && (w != lastW || h != lastH)) {
                lastW = w
                lastH = h
                sizeSheets(h)
                setPage(pageT)
            }
        }
    }

    private fun sizeSheets(h: Int) {
        val tp = topSheet.view.layoutParams
        tp.height = (h * 0.78f).toInt()
        topSheet.view.layoutParams = tp
        val bp = bottomSheet.view.layoutParams
        bp.height = (h * 0.52f).toInt()
        bottomSheet.view.layoutParams = bp
    }

    private fun applyInsets() {
        homeCol.setPadding(dp(20), insetTop + dp(12), dp(20), insetBottom + dp(16))
        widgetsCol.setPadding(dp(16), insetTop + dp(16), dp(16), insetBottom + dp(16))
        topBox.setPadding(dp(18), insetTop + dp(14), dp(18), dp(18))
        bottomBox.setPadding(dp(18), dp(18), dp(18), insetBottom + dp(14))
        drawerBox.setPadding(dp(14), insetTop + dp(8), dp(14), insetBottom)
    }

    private fun updateScrim() {
        val a = maxOf(topSheet.progress, bottomSheet.progress, drawerSheet.progress)
        scrim.alpha = a * 0.85f
        scrim.visibility = if (a > 0f) View.VISIBLE else View.GONE
    }

    // ---- home page

    private fun buildHomePage(): FrameLayout {
        val page = FrameLayout(this)
        page.isLongClickable = true
        page.setOnLongClickListener {
            showSettings()
            true
        }

        homeCol = LinearLayout(this)
        homeCol.orientation = LinearLayout.VERTICAL
        page.addView(homeCol, FrameLayout.LayoutParams(MATCH, MATCH))

        val hintTop = label("▼  CONTROL", 9f, Palette.dim, spacing = 0.3f)
        hintTop.gravity = Gravity.CENTER
        homeCol.addView(hintTop, lp())

        homeCol.addView(label("// ZERO · ONLINE", 11f, Palette.accent, spacing = 0.25f), lp(top = 44))

        val clock = TextClock(this)
        clock.format24Hour = "HH:mm"
        clock.format12Hour = "HH:mm"
        clock.setTextSize(TypedValue.COMPLEX_UNIT_SP, 96f)
        clock.setTextColor(Palette.text)
        clock.typeface = Typeface.create("sans-serif-thin", Typeface.NORMAL)
        clock.includeFontPadding = false
        clock.letterSpacing = -0.02f
        homeCol.addView(clock, lp(top = 4))

        val date = TextClock(this)
        date.format24Hour = "EEEE, d MMMM"
        date.format12Hour = "EEEE, d MMMM"
        date.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
        date.setTextColor(Palette.dim)
        date.typeface = Typeface.MONOSPACE
        date.letterSpacing = 0.2f
        date.setAllCaps(true)
        homeCol.addView(date, lp(top = 6))

        homeCol.addView(View(this), lp(h = 0, weight = 1f))

        statBat = StatBar(this)
        statRam = StatBar(this)
        statRom = StatBar(this)
        statTmp = StatBar(this)
        batVal = label("--", 11f, Palette.text)
        ramVal = label("--", 11f, Palette.text)
        romVal = label("--", 11f, Palette.text)
        tmpVal = label("--", 11f, Palette.text)

        val stats = LinearLayout(this)
        stats.orientation = LinearLayout.VERTICAL
        stats.background = HudFrameDrawable(this, 150)
        stats.setPadding(dp(16), dp(14), dp(16), dp(14))
        stats.addView(statRow("BAT", statBat, batVal), lp())
        stats.addView(statRow("RAM", statRam, ramVal), lp())
        stats.addView(statRow("ROM", statRom, romVal), lp())
        stats.addView(statRow("TMP", statTmp, tmpVal), lp())
        homeCol.addView(stats, lp())

        val hintBottom = label("▲  ARSENAL", 9f, Palette.dim, spacing = 0.3f)
        hintBottom.gravity = Gravity.CENTER
        homeCol.addView(hintBottom, lp(top = 14, bottom = 6))

        dockRow = LinearLayout(this)
        dockRow.orientation = LinearLayout.HORIZONTAL
        dockRow.gravity = Gravity.CENTER
        dockRow.background = HudFrameDrawable(this, 150)
        dockRow.setPadding(dp(8), dp(8), dp(8), dp(8))
        homeCol.addView(dockRow, lp(h = dp(76)))

        return page
    }

    private fun statRow(name: String, bar: StatBar, value: TextView): LinearLayout {
        val row = LinearLayout(this)
        row.orientation = LinearLayout.HORIZONTAL
        row.gravity = Gravity.CENTER_VERTICAL
        row.addView(label(name, 11f, Palette.dim), LinearLayout.LayoutParams(dp(44), WRAP))
        row.addView(bar, LinearLayout.LayoutParams(0, dp(22), 1f))
        value.gravity = Gravity.END
        row.addView(value, LinearLayout.LayoutParams(dp(64), WRAP))
        return row
    }

    private fun renderDock() {
        dockRow.removeAllViews()
        val byPkg = visible.associateBy { it.pkg }
        store.list("dock").mapNotNull { byPkg[it] }.take(5).forEach { app ->
            val icon = android.widget.ImageView(this)
            icon.setImageDrawable(app.icon)
            icon.setPadding(dp(8), dp(8), dp(8), dp(8))
            icon.setOnClickListener { launch(app, it) }
            icon.setOnLongClickListener {
                showAppMenu(app)
                true
            }
            dockRow.addView(icon, LinearLayout.LayoutParams(0, dp(60), 1f))
        }
    }

    private fun defaultDock(): List<String> {
        val pm = packageManager
        val intents = listOf(
            Intent(Intent.ACTION_DIAL),
            Intent(Intent.ACTION_SENDTO, Uri.parse("smsto:")),
            Intent(Intent.ACTION_VIEW, Uri.parse("https://example.com")),
            Intent(MediaStore.INTENT_ACTION_STILL_IMAGE_CAMERA)
        )
        val known = repo.apps.map { it.pkg }.toSet()
        val found = intents
            .mapNotNull { pm.resolveActivity(it, PackageManager.MATCH_DEFAULT_ONLY)?.activityInfo?.packageName }
            .filter { it in known }
            .distinct()
        return if (found.isNotEmpty()) found else repo.apps.take(4).map { it.pkg }
    }

    // ---- widgets page

    private fun buildWidgetsPage(): FrameLayout {
        val page = FrameLayout(this)

        widgetsCol = LinearLayout(this)
        widgetsCol.orientation = LinearLayout.VERTICAL
        page.addView(widgetsCol, FrameLayout.LayoutParams(MATCH, MATCH))

        val header = LinearLayout(this)
        header.orientation = LinearLayout.HORIZONTAL
        header.gravity = Gravity.CENTER_VERTICAL
        header.addView(label("// WIDGETS", 12f, Palette.accent, spacing = 0.25f), LinearLayout.LayoutParams(0, WRAP, 1f))
        val add = label("[ + ДОБАВИТЬ ]", 12f, Palette.text)
        add.setPadding(dp(12), dp(10), dp(12), dp(10))
        add.setOnClickListener { pickWidget() }
        header.addView(add, LinearLayout.LayoutParams(WRAP, WRAP))
        widgetsCol.addView(header, lp(bottom = 8))

        widgetsHint = label("ПУСТО. НАЖМИ [ + ДОБАВИТЬ ], ЧТОБЫ ПОСТАВИТЬ ВИДЖЕТ", 11f, Palette.dim)
        widgetsCol.addView(widgetsHint, lp(top = 8, bottom = 8))

        widgetsList = LinearLayout(this)
        widgetsList.orientation = LinearLayout.VERTICAL
        val sv = ScrollView(this)
        sv.isVerticalScrollBarEnabled = false
        sv.overScrollMode = View.OVER_SCROLL_NEVER
        sv.addView(widgetsList)
        widgetsCol.addView(sv, lp(h = 0, weight = 1f))

        return page
    }

    private fun restoreWidgets() {
        store.list("widgets").mapNotNull { it.toIntOrNull() }.forEach { addWidgetView(it) }
        updateWidgetsHint()
    }

    private fun updateWidgetsHint() {
        widgetsHint.visibility = if (widgetsList.childCount == 0) View.VISIBLE else View.GONE
    }

    private fun saveWidgetId(id: Int, add: Boolean) {
        val l = store.list("widgets")
        l.remove(id.toString())
        if (add) l.add(id.toString())
        store.setList("widgets", l)
    }

    private fun pickWidget() {
        val pm = packageManager
        val providers = widgetMgr.installedProviders.sortedBy { it.loadLabel(pm).lowercase() }
        if (providers.isEmpty()) {
            toast("Нет доступных виджетов")
            return
        }
        val names = providers.map { it.loadLabel(pm) + "  ·  " + it.provider.packageName.substringAfterLast('.') }
            .toTypedArray()
        AlertDialog.Builder(this, android.R.style.Theme_DeviceDefault_Dialog_Alert)
            .setTitle("Виджет")
            .setItems(names) { _, which -> startAddWidget(providers[which]) }
            .show()
    }

    private fun startAddWidget(info: AppWidgetProviderInfo) {
        val id = widgetHost.allocateAppWidgetId()
        pendingWidgetId = id
        if (widgetMgr.bindAppWidgetIdIfAllowed(id, info.provider)) {
            afterBind(id, info)
        } else {
            val i = Intent(AppWidgetManager.ACTION_APPWIDGET_BIND)
            i.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id)
            i.putExtra(AppWidgetManager.EXTRA_APPWIDGET_PROVIDER, info.provider)
            try {
                startActivityForResult(i, REQ_BIND)
            } catch (e: Exception) {
                dropPending()
                toast("Не удалось добавить виджет")
            }
        }
    }

    private fun afterBind(id: Int, info: AppWidgetProviderInfo) {
        if (info.configure != null) {
            try {
                widgetHost.startAppWidgetConfigureActivityForResult(this, id, 0, REQ_CONFIG, null)
            } catch (e: Exception) {
                dropPending()
                toast("Виджет требует настройки, которую не удалось открыть")
            }
        } else {
            commitWidget(id)
        }
    }

    private fun commitWidget(id: Int) {
        pendingWidgetId = -1
        saveWidgetId(id, true)
        addWidgetView(id)
        updateWidgetsHint()
    }

    private fun dropPending() {
        if (pendingWidgetId >= 0) {
            widgetHost.deleteAppWidgetId(pendingWidgetId)
            pendingWidgetId = -1
        }
    }

    @Suppress("OVERRIDE_DEPRECATION", "DEPRECATION")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        val id = pendingWidgetId
        if (id < 0) return
        if (requestCode == REQ_BIND) {
            if (resultCode == RESULT_OK) {
                val info = widgetMgr.getAppWidgetInfo(id)
                if (info != null) afterBind(id, info) else dropPending()
            } else {
                dropPending()
            }
        } else if (requestCode == REQ_CONFIG) {
            if (resultCode == RESULT_OK) commitWidget(id) else dropPending()
        }
    }

    private fun addWidgetView(id: Int) {
        val info = widgetMgr.getAppWidgetInfo(id)
        if (info == null) {
            widgetHost.deleteAppWidgetId(id)
            saveWidgetId(id, false)
            return
        }
        val hv = widgetHost.createView(this, id, info)
        hv.setAppWidget(id, info)

        val wrap = FrameLayout(this)
        wrap.background = HudFrameDrawable(this, 110)
        wrap.setPadding(dp(6), dp(6), dp(6), dp(6))
        wrap.addView(hv, FrameLayout.LayoutParams(MATCH, maxOf(info.minHeight, dp(72))))

        val close = label("✕", 14f, Palette.dim)
        close.setPadding(dp(10), dp(6), dp(10), dp(6))
        close.setOnClickListener {
            widgetHost.deleteAppWidgetId(id)
            saveWidgetId(id, false)
            widgetsList.removeView(wrap)
            updateWidgetsHint()
        }
        wrap.addView(close, FrameLayout.LayoutParams(WRAP, WRAP, Gravity.END or Gravity.TOP))

        widgetsList.addView(wrap, lp(bottom = 12))

        hv.post {
            val d = resources.displayMetrics.density
            val w = (hv.width / d).toInt()
            val h = (hv.height / d).toInt()
            hv.updateAppWidgetSize(null, w, h, w, h)
        }
    }

    // ---- top shade (CONTROL)

    private fun tile(name: String, sub: String, onClick: () -> Unit): LinearLayout {
        val t = LinearLayout(this)
        t.orientation = LinearLayout.VERTICAL
        t.gravity = Gravity.CENTER
        t.background = HudFrameDrawable(this, 120)
        t.addView(label(name, 12f, Palette.text, spacing = 0.15f), LinearLayout.LayoutParams(WRAP, WRAP))
        t.addView(label(sub, 9f, Palette.dim, spacing = 0.2f), lp(w = WRAP, top = 4))
        t.setOnClickListener { onClick() }
        return t
    }

    private fun tileRow(vararg tiles: View): LinearLayout {
        val row = LinearLayout(this)
        row.orientation = LinearLayout.HORIZONTAL
        tiles.forEachIndexed { i, t ->
            val p = LinearLayout.LayoutParams(0, MATCH, 1f)
            if (i > 0) p.leftMargin = dp(8)
            row.addView(t, p)
        }
        return row
    }

    private fun buildTopShade(): View {
        topBox = LinearLayout(this)
        topBox.orientation = LinearLayout.VERTICAL
        topBox.background = HudFrameDrawable(this, 248)

        topBox.addView(label("// CONTROL", 12f, Palette.accent, spacing = 0.25f), lp(bottom = 12))

        val wifi = tile("WI-FI", "NET") { startSettings(Intent(Settings.Panel.ACTION_INTERNET_CONNECTIVITY)) }
        val bt = tile("BLUETOOTH", "BT") { startSettings(Intent(Settings.ACTION_BLUETOOTH_SETTINGS)) }
        val torch = tile("ФОНАРИК", "OFF") { toggleTorch() }
        torchSub = torch.getChildAt(1) as TextView
        val air = tile("АВИАРЕЖИМ", "AIR") { startSettings(Intent(Settings.ACTION_AIRPLANE_MODE_SETTINGS)) }
        val disp = tile("ЭКРАН", "DISP") { startSettings(Intent(Settings.ACTION_DISPLAY_SETTINGS)) }
        val snd = tile("ЗВУК", "AUDIO") { startSettings(Intent(Settings.Panel.ACTION_VOLUME)) }
        topBox.addView(tileRow(wifi, bt, torch), lp(h = dp(72), bottom = 8))
        topBox.addView(tileRow(air, disp, snd), lp(h = dp(72), bottom = 14))

        val volRow = LinearLayout(this)
        volRow.orientation = LinearLayout.HORIZONTAL
        volRow.gravity = Gravity.CENTER_VERTICAL
        volRow.addView(label("VOL", 11f, Palette.dim), LinearLayout.LayoutParams(dp(44), WRAP))
        volSeek = SeekBar(this)
        volSeek.max = audio.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
        volSeek.progress = audio.getStreamVolume(AudioManager.STREAM_MUSIC)
        volSeek.progressTintList = ColorStateList.valueOf(Palette.accent)
        volSeek.thumbTintList = ColorStateList.valueOf(Palette.accent)
        volSeek.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(seekBar: SeekBar?, progress: Int, fromUser: Boolean) {
                if (fromUser) {
                    try {
                        audio.setStreamVolume(AudioManager.STREAM_MUSIC, progress, 0)
                    } catch (e: Exception) {
                    }
                }
            }

            override fun onStartTrackingTouch(seekBar: SeekBar?) {}
            override fun onStopTrackingTouch(seekBar: SeekBar?) {}
        })
        volRow.addView(volSeek, LinearLayout.LayoutParams(0, WRAP, 1f))
        topBox.addView(volRow, lp(bottom = 14))

        val nh = LinearLayout(this)
        nh.orientation = LinearLayout.HORIZONTAL
        nh.gravity = Gravity.CENTER_VERTICAL
        nh.addView(label("// NOTIFICATIONS", 11f, Palette.dim, spacing = 0.2f), LinearLayout.LayoutParams(0, WRAP, 1f))
        val clear = label("[ ОЧИСТИТЬ ]", 11f, Palette.text)
        clear.setPadding(dp(8), dp(6), dp(8), dp(6))
        clear.setOnClickListener {
            ZeroNotificationService.instance?.cancelAllNotifications()
            handler.postDelayed({ refreshNotifications() }, 250)
        }
        nh.addView(clear, LinearLayout.LayoutParams(WRAP, WRAP))
        topBox.addView(nh, lp(bottom = 8))

        notifList = LinearLayout(this)
        notifList.orientation = LinearLayout.VERTICAL
        val sv = ScrollView(this)
        sv.isVerticalScrollBarEnabled = false
        sv.overScrollMode = View.OVER_SCROLL_NEVER
        sv.addView(notifList)
        topBox.addView(sv, lp(h = 0, weight = 1f))

        return topBox
    }

    private fun syncVolume() {
        try {
            volSeek.progress = audio.getStreamVolume(AudioManager.STREAM_MUSIC)
        } catch (e: Exception) {
        }
    }

    private fun refreshNotifications() {
        notifList.removeAllViews()
        val svc = ZeroNotificationService.instance
        if (svc == null) {
            notifList.addView(label("ДОСТУП К УВЕДОМЛЕНИЯМ ВЫКЛЮЧЕН", 11f, Palette.dim), lp(bottom = 10))
            val btn = label("[ ВКЛЮЧИТЬ ДОСТУП ]", 12f, Palette.accent)
            btn.setPadding(0, dp(8), dp(8), dp(8))
            btn.setOnClickListener { startSettings(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)) }
            notifList.addView(btn, lp(w = WRAP))
            return
        }
        val list: List<StatusBarNotification> = try {
            svc.activeNotifications.toList()
        } catch (e: Exception) {
            emptyList()
        }
        val shown = list
            .filter { (it.notification.flags and Notification.FLAG_GROUP_SUMMARY) == 0 }
            .filter { it.packageName != packageName }
            .sortedByDescending { it.postTime }
        if (shown.isEmpty()) {
            notifList.addView(label("НЕТ УВЕДОМЛЕНИЙ", 11f, Palette.dim), lp(top = 4))
            return
        }
        shown.forEach { notifList.addView(notifRow(it), lp(bottom = 8)) }
    }

    private fun notifRow(sbn: StatusBarNotification): View {
        val n = sbn.notification
        val title = n.extras.getCharSequence(Notification.EXTRA_TITLE)?.toString() ?: ""
        val text = n.extras.getCharSequence(Notification.EXTRA_TEXT)?.toString() ?: ""
        val app = repo.apps.firstOrNull { it.pkg == sbn.packageName }?.label ?: sbn.packageName

        val row = LinearLayout(this)
        row.orientation = LinearLayout.VERTICAL
        row.background = HudFrameDrawable(this, 90)
        row.setPadding(dp(12), dp(10), dp(12), dp(10))
        row.addView(label(app.uppercase(), 9f, Palette.accent, spacing = 0.2f), lp())

        if (title.isNotEmpty()) {
            val tv = TextView(this)
            tv.text = title
            tv.setTextColor(Palette.text)
            tv.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
            tv.typeface = Typeface.DEFAULT_BOLD
            tv.maxLines = 1
            tv.ellipsize = TextUtils.TruncateAt.END
            row.addView(tv, lp(top = 3))
        }
        if (text.isNotEmpty()) {
            val tv = TextView(this)
            tv.text = text
            tv.setTextColor(Palette.dim)
            tv.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f)
            tv.maxLines = 2
            tv.ellipsize = TextUtils.TruncateAt.END
            row.addView(tv, lp(top = 2))
        }
        row.setOnClickListener {
            try {
                n.contentIntent?.send()
            } catch (e: PendingIntent.CanceledException) {
            }
            if (sbn.isClearable) ZeroNotificationService.instance?.cancelNotification(sbn.key)
            closeAll()
        }
        return row
    }

    // ---- bottom shade (ARSENAL)

    private fun buildBottomShade(): View {
        bottomBox = LinearLayout(this)
        bottomBox.orientation = LinearLayout.VERTICAL
        bottomBox.background = HudFrameDrawable(this, 248)

        bottomBox.addView(label("// ARSENAL", 12f, Palette.accent, spacing = 0.25f), lp(bottom = 6))

        arsenalAdapter = AppAdapter(this, true)
        arsenalGrid = makeGrid(arsenalAdapter)
        arsenalEmpty = label("ИГР НЕ НАЙДЕНО. ДОЛГОЕ НАЖАТИЕ НА ПРИЛОЖЕНИЕ → «В АРСЕНАЛ»", 10f, Palette.dim)
        arsenalEmpty.visibility = View.GONE
        bottomBox.addView(arsenalEmpty, lp(top = 8, bottom = 8))
        bottomBox.addView(arsenalGrid, lp(h = 0, weight = 1f))

        val t1 = tile("ЗВУК", "SND") { startSettings(Intent(Settings.ACTION_SOUND_SETTINGS)) }
        val t2 = tile("БАТАРЕЯ", "PWR") { startSettings(Intent(Settings.ACTION_BATTERY_SAVER_SETTINGS)) }
        val t3 = tile("ПАМЯТЬ", "ROM") { startSettings(Intent(Settings.ACTION_INTERNAL_STORAGE_SETTINGS)) }
        val t4 = tile("ПРИЛОЖ.", "APPS") { startSettings(Intent(Settings.ACTION_APPLICATION_SETTINGS)) }
        bottomBox.addView(tileRow(t1, t2, t3, t4), lp(h = dp(60), top = 10))

        return bottomBox
    }

    // ---- app drawer

    private fun buildDrawer(): View {
        drawerBox = LinearLayout(this)
        drawerBox.orientation = LinearLayout.VERTICAL
        drawerBox.background = ColorDrawable(Palette.withAlpha(Palette.bg, 245))

        val handle = View(this)
        handle.setBackgroundColor(Palette.accent)
        val hp = lp(w = dp(36), h = dp(3), top = 4, bottom = 12)
        hp.gravity = Gravity.CENTER_HORIZONTAL
        drawerBox.addView(handle, hp)

        searchField = EditText(this)
        searchField.hint = "SEARCH //"
        searchField.setHintTextColor(Palette.dim)
        searchField.setTextColor(Palette.text)
        searchField.typeface = Typeface.MONOSPACE
        searchField.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
        searchField.setSingleLine(true)
        searchField.imeOptions = EditorInfo.IME_ACTION_GO
        searchField.background = HudFrameDrawable(this, 120)
        searchField.setPadding(dp(14), dp(12), dp(14), dp(12))
        searchField.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
            override fun afterTextChanged(s: Editable?) {
                refreshLists()
            }
        })
        searchField.setOnEditorActionListener { _, _, _ ->
            drawerAdapter.items.firstOrNull()?.let { launch(it, null) }
            true
        }
        drawerBox.addView(searchField, lp(bottom = 8))

        drawerAdapter = AppAdapter(this, false)
        drawerGrid = makeGrid(drawerAdapter)
        drawerBox.addView(drawerGrid, lp(h = 0, weight = 1f))

        return drawerBox
    }

    private fun makeGrid(adapter: AppAdapter): GridView {
        val g = GridView(this)
        g.numColumns = 4
        g.adapter = adapter
        g.selector = ColorDrawable(Color.TRANSPARENT)
        g.isVerticalScrollBarEnabled = false
        g.overScrollMode = View.OVER_SCROLL_NEVER
        g.onItemClickListener = AdapterView.OnItemClickListener { _, view, pos, _ ->
            launch(adapter.getItem(pos), view)
        }
        g.onItemLongClickListener = AdapterView.OnItemLongClickListener { _, _, pos, _ ->
            showAppMenu(adapter.getItem(pos))
            true
        }
        return g
    }

    private fun resetSearch() {
        if (searchField.text.isNotEmpty()) searchField.setText("")
        searchField.clearFocus()
        hideKeyboard()
        drawerGrid.setSelection(0)
    }

    private fun hideKeyboard() {
        val imm = getSystemService(InputMethodManager::class.java)
        imm.hideSoftInputFromWindow(searchField.windowToken, 0)
    }

    // ------------------------------------------------------------------ apps

    private fun onAppsChanged() {
        if (!store.dockInit && repo.apps.isNotEmpty()) {
            store.setList("dock", defaultDock())
            store.dockInit = true
        }
        refreshLists()
    }

    private fun refreshLists() {
        val hidden = store.list("hidden").toSet()
        visible = repo.apps.filter { it.pkg !in hidden }
        val q = searchField.text.toString().trim().lowercase()
        drawerAdapter.items = if (q.isEmpty()) visible else visible.filter { it.label.lowercase().contains(q) }

        val pinnedKeys = store.list("arsenal")
        val byPkg = visible.associateBy { it.pkg }
        val pinned = pinnedKeys.mapNotNull { byPkg[it] }
        val games = visible.filter { it.isGame && it.pkg !in pinnedKeys }
        arsenalAdapter.items = pinned + games
        arsenalEmpty.visibility = if (arsenalAdapter.items.isEmpty()) View.VISIBLE else View.GONE

        renderDock()
    }

    private fun launch(app: AppItem, from: View?) {
        val i = Intent(Intent.ACTION_MAIN)
            .addCategory(Intent.CATEGORY_LAUNCHER)
            .setClassName(app.pkg, app.cls)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED)
        try {
            val opts = if (from != null) {
                ActivityOptions.makeScaleUpAnimation(from, 0, 0, from.width, from.height).toBundle()
            } else {
                null
            }
            startActivity(i, opts)
        } catch (e: Exception) {
            toast("Не удалось открыть приложение")
        }
        handler.postDelayed({ closeAll() }, 300)
    }

    private fun toggleList(key: String, pkg: String, max: Int) {
        val l = store.list(key)
        if (pkg in l) {
            l.remove(pkg)
        } else {
            if (max > 0 && l.size >= max) {
                toast("Док заполнен (максимум $max)")
                return
            }
            l.add(pkg)
        }
        store.setList(key, l)
        refreshLists()
    }

    private fun showAppMenu(app: AppItem) {
        val dock = store.list("dock")
        val arsenal = store.list("arsenal")
        val items = arrayOf(
            if (app.pkg in dock) "Убрать из дока" else "В док",
            if (app.pkg in arsenal) "Убрать из арсенала" else "В арсенал",
            "Скрыть",
            "О приложении",
            "Удалить"
        )
        AlertDialog.Builder(this, android.R.style.Theme_DeviceDefault_Dialog_Alert)
            .setTitle(app.label)
            .setItems(items) { _, which ->
                when (which) {
                    0 -> toggleList("dock", app.pkg, 5)
                    1 -> toggleList("arsenal", app.pkg, 0)
                    2 -> {
                        val h = store.list("hidden")
                        h.add(app.pkg)
                        store.setList("hidden", h)
                        refreshLists()
                    }
                    3 -> startSettings(
                        Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + app.pkg))
                    )
                    4 -> startSettings(Intent(Intent.ACTION_DELETE, Uri.parse("package:" + app.pkg)))
                    else -> {}
                }
            }
            .show()
    }

    private fun showSettings() {
        val items = arrayOf("Акцентный цвет", "Скрытые приложения", "Сменить лаунчер по умолчанию")
        AlertDialog.Builder(this, android.R.style.Theme_DeviceDefault_Dialog_Alert)
            .setTitle("ZERO")
            .setItems(items) { _, which ->
                when (which) {
                    0 -> pickAccent()
                    1 -> showHidden()
                    2 -> startSettings(Intent(Settings.ACTION_HOME_SETTINGS))
                    else -> {}
                }
            }
            .show()
    }

    private fun pickAccent() {
        val names = Palette.accents.map { it.first }.toTypedArray()
        AlertDialog.Builder(this, android.R.style.Theme_DeviceDefault_Dialog_Alert)
            .setTitle("Акцентный цвет")
            .setItems(names) { _, which ->
                store.accent = which
                recreate()
            }
            .show()
    }

    private fun showHidden() {
        val hiddenPkgs = store.list("hidden")
        if (hiddenPkgs.isEmpty()) {
            toast("Скрытых приложений нет")
            return
        }
        val apps = repo.apps.filter { it.pkg in hiddenPkgs }
        if (apps.isEmpty()) {
            toast("Скрытых приложений нет")
            return
        }
        val names = apps.map { it.label }.toTypedArray()
        val checked = BooleanArray(apps.size) { true }
        AlertDialog.Builder(this, android.R.style.Theme_DeviceDefault_Dialog_Alert)
            .setTitle("Скрытые (сними галочку, чтобы вернуть)")
            .setMultiChoiceItems(names, checked) { _, which, isChecked -> checked[which] = isChecked }
            .setPositiveButton("OK") { _, _ ->
                val keep = hiddenPkgs.toMutableList()
                apps.forEachIndexed { i, a -> if (!checked[i]) keep.remove(a.pkg) }
                store.setList("hidden", keep)
                refreshLists()
            }
            .setNegativeButton("Отмена", null)
            .show()
    }

    private fun startSettings(i: Intent) {
        try {
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            startActivity(i)
            handler.postDelayed({ closeAll() }, 300)
        } catch (e: Exception) {
            toast("Недоступно на этом устройстве")
        }
    }

    // ------------------------------------------------------------------ torch

    private fun registerTorch() {
        try {
            flashId = cam.cameraIdList.firstOrNull {
                cam.getCameraCharacteristics(it).get(CameraCharacteristics.FLASH_INFO_AVAILABLE) == true
            }
            cam.registerTorchCallback(object : CameraManager.TorchCallback() {
                override fun onTorchModeChanged(cameraId: String, enabled: Boolean) {
                    if (cameraId == flashId) {
                        torchOn = enabled
                        torchSub.text = if (enabled) "ON" else "OFF"
                    }
                }
            }, handler)
        } catch (e: Exception) {
        }
    }

    private fun toggleTorch() {
        val id = flashId
        if (id == null) {
            toast("Вспышка недоступна")
            return
        }
        try {
            cam.setTorchMode(id, !torchOn)
        } catch (e: Exception) {
            toast("Фонарик недоступен")
        }
    }

    // ------------------------------------------------------------------ stats

    private fun updateStats() {
        val bi = registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        if (bi != null) {
            val level = bi.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
            val scale = bi.getIntExtra(BatteryManager.EXTRA_SCALE, 100)
            val pct = if (level >= 0 && scale > 0) level * 100f / scale else 0f
            statBat.value = pct / 100f
            batVal.text = "${pct.toInt()}%"
            val temp = bi.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, 0) / 10f
            statTmp.value = (temp - 20f) / 30f
            tmpVal.text = String.format("%.1f°C", temp)
        }

        val am = getSystemService(ActivityManager::class.java)
        val mi = ActivityManager.MemoryInfo()
        am.getMemoryInfo(mi)
        if (mi.totalMem > 0) {
            val used = 1f - mi.availMem.toFloat() / mi.totalMem.toFloat()
            statRam.value = used
            ramVal.text = "${(used * 100).toInt()}%"
        }

        try {
            val sf = StatFs(Environment.getDataDirectory().path)
            if (sf.totalBytes > 0) {
                val used = 1f - sf.availableBytes.toFloat() / sf.totalBytes.toFloat()
                statRom.value = used
                romVal.text = "${(used * 100).toInt()}%"
            }
        } catch (e: Exception) {
        }
    }

    // ------------------------------------------------------------------ gestures

    private fun anyOpen(): Boolean =
        topSheet.progress > 0f || bottomSheet.progress > 0f || drawerSheet.progress > 0f

    private fun closeAll() {
        topSheet.animateTo(false)
        bottomSheet.animateTo(false)
        drawerSheet.animateTo(false)
    }

    private fun setPage(t: Float) {
        pageT = t.coerceIn(0f, 1f)
        val w = root.width.toFloat()
        homePage.translationX = pageT * w
        homePage.alpha = 1f - pageT * 0.5f
        widgetsPage.translationX = (pageT - 1f) * w
        widgetsPage.visibility = if (pageT <= 0f) View.INVISIBLE else View.VISIBLE
    }

    private fun animatePage(target: Float) {
        pageAnim?.cancel()
        val a = ValueAnimator.ofFloat(pageT, target)
        a.duration = 220
        a.interpolator = DecelerateInterpolator()
        a.addUpdateListener { setPage(it.animatedValue as Float) }
        a.start()
        pageAnim = a
    }

    override fun beginDrag(downX: Float, downY: Float, dx: Float, dy: Float): Boolean {
        val horizontal = abs(dx) > abs(dy)
        val h = root.height.toFloat()
        var m = Mode.NONE

        if (drawerSheet.progress > 0.01f) {
            if (!horizontal && dy > 0 && !drawerGrid.canScrollVertically(-1)) m = Mode.DRAWER_CLOSE
        } else if (topSheet.progress > 0.01f) {
            if (!horizontal && dy < 0) m = Mode.TOP_CLOSE
        } else if (bottomSheet.progress > 0.01f) {
            if (!horizontal && dy > 0 && !arsenalGrid.canScrollVertically(-1)) m = Mode.BOTTOM_CLOSE
        } else if (horizontal) {
            if ((dx > 0 && pageT < 1f) || (dx < 0 && pageT > 0f)) m = Mode.PAGE
        } else if (dy > 0) {
            if (pageT < 0.01f || downY < insetTop + h * 0.2f) m = Mode.TOP_OPEN
        } else {
            if (downY > h * 0.86f) {
                m = Mode.BOTTOM_OPEN
            } else if (pageT < 0.01f) {
                m = Mode.DRAWER_OPEN
            }
        }

        if (m == Mode.NONE) return false

        mode = m
        startPageT = pageT
        pageAnim?.cancel()
        topSheet.cancel()
        bottomSheet.cancel()
        drawerSheet.cancel()
        if (m == Mode.TOP_OPEN) {
            refreshNotifications()
            syncVolume()
        }
        return true
    }

    override fun drag(dx: Float, dy: Float) {
        val h = root.height.toFloat()
        val w = root.width.toFloat().coerceAtLeast(1f)
        when (mode) {
            Mode.PAGE -> setPage(startPageT + dx / w)
            Mode.TOP_OPEN -> topSheet.setProgress(dy / topSheet.size())
            Mode.TOP_CLOSE -> topSheet.setProgress(1f + dy / topSheet.size())
            Mode.BOTTOM_OPEN -> bottomSheet.setProgress(-dy / bottomSheet.size())
            Mode.BOTTOM_CLOSE -> bottomSheet.setProgress(1f - dy / bottomSheet.size())
            Mode.DRAWER_OPEN -> drawerSheet.setProgress(-dy / h)
            Mode.DRAWER_CLOSE -> drawerSheet.setProgress(1f - dy / h)
            Mode.NONE -> {}
        }
    }

    override fun endDrag(vx: Float, vy: Float) {
        val fling = 900f
        when (mode) {
            Mode.PAGE -> {
                val target = if (vx > fling) 1f else if (vx < -fling) 0f else if (pageT > 0.5f) 1f else 0f
                animatePage(target)
            }
            Mode.TOP_OPEN, Mode.TOP_CLOSE ->
                topSheet.animateTo(if (abs(vy) > fling) vy > 0 else topSheet.progress > 0.5f)
            Mode.BOTTOM_OPEN, Mode.BOTTOM_CLOSE ->
                bottomSheet.animateTo(if (abs(vy) > fling) vy < 0 else bottomSheet.progress > 0.5f)
            Mode.DRAWER_OPEN, Mode.DRAWER_CLOSE ->
                drawerSheet.animateTo(if (abs(vy) > fling) vy < 0 else drawerSheet.progress > 0.5f)
            Mode.NONE -> {}
        }
        mode = Mode.NONE
    }
}
