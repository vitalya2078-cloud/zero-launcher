package com.vitalya.zero

import android.graphics.Color

/** Как рисуются панели (HUD-рамки). */
enum class FrameStyle {
    /** Тонкая рамка + акцентные уголки. */
    CORNERS,

    /** Только скобки по углам, рамка почти невидима. */
    BRACKETS,

    /** Срезанные углы, как у sci-fi интерфейсов. */
    CUT,

    /** Скруглённая панель с акцентным контуром. */
    ROUND
}

/** Узор статичных обоев. */
enum class Pattern { GRID_RINGS, SCANLINES, HEX, HORIZON, HAZARD, DOTS }

/** Шрифтовая пара темы: моно/технический текст и крупные часы. */
enum class FontSet { MONO, CONDENSED, TERMINAL }

/**
 * Полное описание темы. Все цвета — ARGB.
 * accent — акцент по умолчанию; пользователь может переопределить его отдельно.
 */
data class Theme(
    val id: String,
    val name: String,
    val tagline: String,
    val bgTop: Int,
    val bgBottom: Int,
    val surface: Int,
    val line: Int,
    val text: Int,
    val dim: Int,
    val accent: Int,
    val secondary: Int,
    val scrim: Int,
    val frame: FrameStyle,
    val pattern: Pattern,
    val font: FontSet,
    val segmentedBars: Boolean
) {
    val bg: Int get() = bgBottom
}

private fun c(hex: String): Int = Color.parseColor(hex)

object Themes {

    val all: List<Theme> = listOf(
        Theme(
            id = "zero",
            name = "ZERO",
            tagline = "тактический HUD",
            bgTop = c("#0C0F16"), bgBottom = c("#07080B"),
            surface = c("#0E1117"), line = c("#2A3240"),
            text = c("#E8ECF2"), dim = c("#6B7686"),
            accent = c("#00E5A8"), secondary = c("#00E5A8"),
            scrim = Color.BLACK,
            frame = FrameStyle.CORNERS, pattern = Pattern.GRID_RINGS,
            font = FontSet.MONO, segmentedBars = false
        ),
        Theme(
            id = "blood",
            name = "BLOODLINE",
            tagline = "агрессивный красный",
            bgTop = c("#1A0A0D"), bgBottom = c("#060203"),
            surface = c("#170A0D"), line = c("#43202A"),
            text = c("#F4E7E9"), dim = c("#8C6A70"),
            accent = c("#FF3B4E"), secondary = c("#FF8A3B"),
            scrim = c("#0A0002"),
            frame = FrameStyle.CUT, pattern = Pattern.HAZARD,
            font = FontSet.CONDENSED, segmentedBars = true
        ),
        Theme(
            id = "synth",
            name = "SYNTHWAVE",
            tagline = "неон 80-х",
            bgTop = c("#1A0B2E"), bgBottom = c("#07030F"),
            surface = c("#150B26"), line = c("#3E2A63"),
            text = c("#F3EAFF"), dim = c("#8A78AE"),
            accent = c("#FF4FD8"), secondary = c("#4FC3FF"),
            scrim = c("#05010B"),
            frame = FrameStyle.ROUND, pattern = Pattern.HORIZON,
            font = FontSet.CONDENSED, segmentedBars = false
        ),
        Theme(
            id = "terminal",
            name = "TERMINAL",
            tagline = "янтарный ЭЛТ-монитор",
            bgTop = c("#120C02"), bgBottom = c("#050300"),
            surface = c("#130D02"), line = c("#4A360C"),
            text = c("#FFD48A"), dim = c("#9C7B3C"),
            accent = c("#FFB020"), secondary = c("#FFB020"),
            scrim = Color.BLACK,
            frame = FrameStyle.BRACKETS, pattern = Pattern.SCANLINES,
            font = FontSet.TERMINAL, segmentedBars = true
        ),
        Theme(
            id = "cryo",
            name = "CRYO",
            tagline = "ледяной sci-fi",
            bgTop = c("#0A1622"), bgBottom = c("#03070C"),
            surface = c("#0B1622"), line = c("#21384E"),
            text = c("#E6F4FF"), dim = c("#6B879C"),
            accent = c("#4FC3FF"), secondary = c("#8BF0FF"),
            scrim = c("#00040A"),
            frame = FrameStyle.CUT, pattern = Pattern.HEX,
            font = FontSet.MONO, segmentedBars = false
        ),
        Theme(
            id = "toxic",
            name = "TOXIC",
            tagline = "радиоактивный лайм",
            bgTop = c("#0C1406"), bgBottom = c("#030502"),
            surface = c("#0D150A"), line = c("#2C3F1C"),
            text = c("#EEF8E2"), dim = c("#76885E"),
            accent = c("#A6FF00"), secondary = c("#FFE600"),
            scrim = Color.BLACK,
            frame = FrameStyle.CORNERS, pattern = Pattern.HEX,
            font = FontSet.CONDENSED, segmentedBars = true
        ),
        Theme(
            id = "stealth",
            name = "STEALTH",
            tagline = "чистый монохром",
            bgTop = c("#101010"), bgBottom = c("#040404"),
            surface = c("#111111"), line = c("#2A2A2A"),
            text = c("#E2E2E2"), dim = c("#6E6E6E"),
            accent = c("#E8E8E8"), secondary = c("#8A8A8A"),
            scrim = Color.BLACK,
            frame = FrameStyle.BRACKETS, pattern = Pattern.DOTS,
            font = FontSet.CONDENSED, segmentedBars = false
        )
    )

    val default: Theme get() = all[0]

    fun byId(id: String?): Theme = all.firstOrNull { it.id == id } ?: default

    /** Акценты, которые можно выбрать поверх любой темы. Ключ хранится в настройках. */
    val accents: List<Pair<String, Int>> = listOf(
        "MINT" to c("#00E5A8"),
        "RED" to c("#FF3B4E"),
        "VIOLET" to c("#8B6BFF"),
        "AMBER" to c("#FFB020"),
        "ICE" to c("#4FC3FF"),
        "MAGENTA" to c("#FF4FD8"),
        "LIME" to c("#A6FF00"),
        "WHITE" to c("#E8E8E8")
    )

    fun accentByKey(key: String?): Int? = accents.firstOrNull { it.first == key }?.second
}
