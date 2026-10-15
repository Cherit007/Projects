import ExpoModulesCore
import UserNotifications

// Keys shared with CaptureBankSmsIntent.swift (BankSmsQueue) in the app target.
private let queueKey = "financetracker.bankSms.queue"
private let lastCapturedKey = "financetracker.bankSms.lastCapturedAt"

public class BankSmsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("BankSms")

    Function("getPending") { () -> [[String: Any]] in
      UserDefaults.standard.array(forKey: queueKey) as? [[String: Any]] ?? []
    }

    Function("remove") { (ids: [String]) in
      let defaults = UserDefaults.standard
      let removed = Set(ids)
      let items = defaults.array(forKey: queueKey) as? [[String: Any]] ?? []
      defaults.set(items.filter { !removed.contains($0["id"] as? String ?? "") }, forKey: queueKey)
    }

    Function("lastCapturedAt") { () -> Double? in
      UserDefaults.standard.object(forKey: lastCapturedKey) as? Double
    }

    AsyncFunction("requestNotificationPermission") { (promise: Promise) in
      UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { granted, _ in
        promise.resolve(granted)
      }
    }
  }
}
