package expo.modules.upinotifications

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

data class UpiEvent(
  val id: String,
  val packageName: String,
  val title: String?,
  val text: String?,
  val postedAt: Long,
) {
  fun toMap(): Map<String, Any?> = mapOf(
    "id" to id,
    "packageName" to packageName,
    "title" to title,
    "text" to text,
    "postedAt" to postedAt.toDouble(),
  )

  fun toJson(): JSONObject = JSONObject()
    .put("id", id)
    .put("packageName", packageName)
    .put("title", title ?: JSONObject.NULL)
    .put("text", text ?: JSONObject.NULL)
    .put("postedAt", postedAt)

  companion object {
    fun fromJson(json: JSONObject) = UpiEvent(
      id = json.getString("id"),
      packageName = json.getString("packageName"),
      title = json.optString("title").takeUnless { json.isNull("title") },
      text = json.optString("text").takeUnless { json.isNull("text") },
      postedAt = json.getLong("postedAt"),
    )
  }
}

/**
 * Persists captured notifications until the JS app reads them, so payments
 * detected while the app is closed are not lost. Only the title and text of
 * notifications from allowed payment apps are stored, and they stay on device.
 */
object UpiEventStore {
  private const val PREFS = "upi_notifications"
  private const val KEY_EVENTS = "events"
  private const val KEY_ENABLED = "enabled"
  private const val KEY_PACKAGES = "packages"
  private const val MAX_EVENTS = 200

  /** Set by the module while the JS app is running. */
  @Volatile
  var listener: ((UpiEvent) -> Unit)? = null

  private fun prefs(context: Context): SharedPreferences =
    context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun isEnabled(context: Context) = prefs(context).getBoolean(KEY_ENABLED, false)

  fun allowedPackages(context: Context): Set<String> =
    prefs(context).getStringSet(KEY_PACKAGES, emptySet()) ?: emptySet()

  fun setConfig(context: Context, enabled: Boolean, packages: List<String>) {
    prefs(context).edit()
      .putBoolean(KEY_ENABLED, enabled)
      .putStringSet(KEY_PACKAGES, packages.toSet())
      .apply()
  }

  @Synchronized
  fun list(context: Context): List<UpiEvent> {
    val raw = prefs(context).getString(KEY_EVENTS, null) ?: return emptyList()
    val array = JSONArray(raw)
    return (0 until array.length()).map { UpiEvent.fromJson(array.getJSONObject(it)) }
  }

  /** Returns null when the same notification content was stored moments ago. */
  @Synchronized
  fun add(context: Context, packageName: String, title: String?, text: String?, postedAt: Long): UpiEvent? {
    val events = list(context).toMutableList()
    val isRepeat = events.takeLast(10).any {
      it.packageName == packageName && it.title == title && it.text == text &&
        kotlin.math.abs(it.postedAt - postedAt) < 60_000
    }
    if (isRepeat) {
      return null
    }
    val event = UpiEvent(UUID.randomUUID().toString(), packageName, title, text, postedAt)
    events.add(event)
    save(context, events.takeLast(MAX_EVENTS))
    return event
  }

  @Synchronized
  fun remove(context: Context, ids: Collection<String>) {
    val idSet = ids.toSet()
    save(context, list(context).filterNot { it.id in idSet })
  }

  private fun save(context: Context, events: List<UpiEvent>) {
    val array = JSONArray()
    events.forEach { array.put(it.toJson()) }
    prefs(context).edit().putString(KEY_EVENTS, array.toString()).apply()
  }
}
