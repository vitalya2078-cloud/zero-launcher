package com.vitalya.zero

import android.animation.ValueAnimator
import android.view.View
import android.view.animation.DecelerateInterpolator

/** Шторка, которая выезжает сверху или снизу. progress: 0 = скрыта, 1 = открыта. */
class Sheet(val view: View, private val fromTop: Boolean) {

    var progress: Float = 0f
        private set

    var onProgress: ((Float) -> Unit)? = null

    private var anim: ValueAnimator? = null

    init {
        view.addOnLayoutChangeListener { _, _, _, _, _, _, _, _, _ -> applyTransform() }
        applyTransform()
    }

    fun size(): Float = view.height.toFloat().coerceAtLeast(1f)

    private fun applyTransform() {
        val h = view.height.toFloat()
        view.translationY = if (fromTop) -(1f - progress) * h else (1f - progress) * h
        view.visibility = if (progress <= 0f) View.INVISIBLE else View.VISIBLE
    }

    fun setProgress(p: Float) {
        progress = p.coerceIn(0f, 1f)
        applyTransform()
        onProgress?.invoke(progress)
    }

    fun cancel() {
        anim?.cancel()
    }

    fun animateTo(open: Boolean) {
        anim?.cancel()
        val a = ValueAnimator.ofFloat(progress, if (open) 1f else 0f)
        a.duration = 230
        a.interpolator = DecelerateInterpolator()
        a.addUpdateListener { setProgress(it.animatedValue as Float) }
        a.start()
        anim = a
    }
}
