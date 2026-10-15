package com.vitalya.zero

import android.content.Context
import android.view.MotionEvent
import android.view.VelocityTracker
import android.view.ViewConfiguration
import android.widget.FrameLayout
import kotlin.math.abs

/**
 * Корневой контейнер. Перехватывает свайпы и отдаёт их контроллеру,
 * обычные нажатия и прокрутка списков проходят к дочерним view.
 */
class GestureFrame(ctx: Context) : FrameLayout(ctx) {

    interface Controller {
        /** true, если контроллер берёт жест на себя. */
        fun beginDrag(downX: Float, downY: Float, dx: Float, dy: Float): Boolean
        fun drag(dx: Float, dy: Float)
        fun endDrag(vx: Float, vy: Float)
    }

    var controller: Controller? = null

    private val slop = ViewConfiguration.get(ctx).scaledTouchSlop
    private var downX = 0f
    private var downY = 0f
    private var dragging = false
    private var tracker: VelocityTracker? = null

    override fun onInterceptTouchEvent(e: MotionEvent): Boolean {
        when (e.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                downX = e.rawX
                downY = e.rawY
                dragging = false
                tracker?.recycle()
                tracker = VelocityTracker.obtain()
                tracker?.addMovement(e)
            }
            MotionEvent.ACTION_MOVE -> {
                tracker?.addMovement(e)
                if (!dragging) {
                    val dx = e.rawX - downX
                    val dy = e.rawY - downY
                    if (abs(dx) > slop || abs(dy) > slop) {
                        if (controller?.beginDrag(downX, downY, dx, dy) == true) {
                            dragging = true
                            parent?.requestDisallowInterceptTouchEvent(true)
                            controller?.drag(dx, dy)
                            return true
                        }
                    }
                }
            }
            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                tracker?.recycle()
                tracker = null
            }
        }
        return false
    }

    override fun onTouchEvent(e: MotionEvent): Boolean {
        if (!dragging) return false
        tracker?.addMovement(e)
        when (e.actionMasked) {
            MotionEvent.ACTION_MOVE -> controller?.drag(e.rawX - downX, e.rawY - downY)
            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                tracker?.computeCurrentVelocity(1000)
                controller?.endDrag(tracker?.xVelocity ?: 0f, tracker?.yVelocity ?: 0f)
                dragging = false
                tracker?.recycle()
                tracker = null
            }
        }
        return true
    }
}
