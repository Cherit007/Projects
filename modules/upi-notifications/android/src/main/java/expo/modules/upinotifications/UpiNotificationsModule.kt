package expo.modules.upinotifications

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class UpiNotificationsModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("UpiNotifications")

    Events("onNotification")

    OnStartObserving {
      UpiEventStore.listener = { event -> sendEvent("onNotification", event.toMap()) }
    }

    OnStopObserving {
      UpiEventStore.listener = null
    }

    Function("isAccessGranted") {
      val component = ComponentName(context, UpiNotificationListenerService::class.java)
      val enabled = Settings.Secure.getString(context.contentResolver, "enabled_notification_listeners")
      enabled?.split(":")?.any { ComponentName.unflattenFromString(it) == component } ?: false
    }

    Function("openAccessSettings") {
      val component = ComponentName(context, UpiNotificationListenerService::class.java)
      val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        Intent(Settings.ACTION_NOTIFICATION_LISTENER_DETAIL_SETTINGS)
          .putExtra(Settings.EXTRA_NOTIFICATION_LISTENER_COMPONENT_NAME, component.flattenToString())
      } else {
        Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
      }
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      try {
        context.startActivity(intent)
      } catch (_: Exception) {
        context.startActivity(
          Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
        )
      }
    }

    Function("setConfig") { enabled: Boolean, packages: List<String> ->
      UpiEventStore.setConfig(context, enabled, packages)
    }

    Function("getConfig") {
      mapOf(
        "enabled" to UpiEventStore.isEnabled(context),
        "packages" to UpiEventStore.allowedPackages(context).toList(),
      )
    }

    Function("getPendingEvents") {
      UpiEventStore.list(context).map { it.toMap() }
    }

    Function("removeEvents") { ids: List<String> ->
      UpiEventStore.remove(context, ids)
    }
  }
}
