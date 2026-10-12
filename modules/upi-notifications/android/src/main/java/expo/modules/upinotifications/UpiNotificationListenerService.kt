package expo.modules.upinotifications

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

/**
 * Receives notifications only after the user grants notification access in
 * Android settings. Ignores everything except allowed payment apps, never
 * stores OTP/PIN content, and parses nothing itself: parsing happens in JS
 * so Android and tests share one implementation.
 */
class UpiNotificationListenerService : NotificationListenerService() {

  override fun onNotificationPosted(sbn: StatusBarNotification) {
    val context = applicationContext
    if (!UpiEventStore.isEnabled(context)) {
      return
    }
    if (sbn.packageName !in UpiEventStore.allowedPackages(context)) {
      return
    }
    val notification = sbn.notification
    if (notification.flags and Notification.FLAG_GROUP_SUMMARY != 0) {
      return
    }
    val extras = notification.extras
    val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString()
    val text = (extras.getCharSequence(Notification.EXTRA_BIG_TEXT)
      ?: extras.getCharSequence(Notification.EXTRA_TEXT))?.toString()
    val combined = listOfNotNull(title, text).joinToString(" ")
    if (combined.isBlank() || SENSITIVE.containsMatchIn(combined)) {
      return
    }

    val event = UpiEventStore.add(context, sbn.packageName, title, text, sbn.postTime) ?: return
    val listener = UpiEventStore.listener
    if (listener != null) {
      listener(event)
    }
    if (AMOUNT.containsMatchIn(combined) && !NOT_A_PAYMENT.containsMatchIn(combined)) {
      showReviewPrompt(context, sourceLabel(sbn.packageName), title ?: text)
    }
  }

  private fun sourceLabel(packageName: String): String = try {
    val info = packageManager.getApplicationInfo(packageName, 0)
    packageManager.getApplicationLabel(info).toString()
  } catch (_: PackageManager.NameNotFoundException) {
    packageName
  }

  private fun showReviewPrompt(context: Context, source: String, summary: String?) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
      context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
    ) {
      return
    }
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      manager.createNotificationChannel(
        NotificationChannel(CHANNEL_ID, "Payment review", NotificationManager.IMPORTANCE_DEFAULT).apply {
          description = "Prompts to categorise detected UPI payments"
        },
      )
    }
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(REVIEW_URI)).apply {
      setPackage(context.packageName)
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    }
    val pendingIntent = PendingIntent.getActivity(
      context,
      0,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(context, CHANNEL_ID)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(context)
    }
    val notification = builder
      .setSmallIcon(android.R.drawable.ic_menu_edit)
      .setContentTitle("Payment detected in $source")
      .setContentText(summary?.let { "$it · Tap to categorise" } ?: "Tap to categorise")
      .setContentIntent(pendingIntent)
      .setAutoCancel(true)
      .build()
    manager.notify(PROMPT_ID, notification)
  }

  companion object {
    private const val CHANNEL_ID = "upi_review"
    private const val PROMPT_ID = 4207
    private const val REVIEW_URI = "financetracker://upi-review"
    private val SENSITIVE = Regex("""\b(otp|one[\s-]?time\s+password|upi\s+pin|mpin|cvv)\b""", RegexOption.IGNORE_CASE)
    private val AMOUNT = Regex("""(₹|\bRs\.?|\bINR)\s*[\d,]+""", RegexOption.IGNORE_CASE)
    // Failed payments and requests never become expenses, so they don't get a prompt.
    private val NOT_A_PAYMENT = Regex(
      """\b(failed|declined|unsuccessful|could\s+not\s+be\s+completed|requested|requesting|collect\s+request)\b""",
      RegexOption.IGNORE_CASE,
    )
  }
}
