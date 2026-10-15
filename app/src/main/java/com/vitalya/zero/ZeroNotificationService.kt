package com.vitalya.zero

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

/** Нужен, чтобы показывать уведомления в верхней шторке лаунчера. */
class ZeroNotificationService : NotificationListenerService() {

    companion object {
        @Volatile
        var instance: ZeroNotificationService? = null

        @Volatile
        var onChange: (() -> Unit)? = null
    }

    override fun onListenerConnected() {
        instance = this
        onChange?.invoke()
    }

    override fun onListenerDisconnected() {
        if (instance === this) instance = null
        onChange?.invoke()
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        onChange?.invoke()
    }

    override fun onNotificationRemoved(sbn: StatusBarNotification?) {
        onChange?.invoke()
    }
}
