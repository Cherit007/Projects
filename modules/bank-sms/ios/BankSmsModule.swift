import ExpoModulesCore
import UserNotifications

// Keys shared with CaptureBankSmsIntent.swift (BankSmsQueue, QuickAddQueue) in the app target.
private let queueKey = "financetracker.bankSms.queue"
private let lastCapturedKey = "financetracker.bankSms.lastCapturedAt"
private let quickAddKey = "financetracker.quickAdd"

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

    /// The expense the "Add expense" action asked for, once; nil when there is none.
    Function("takeQuickAdd") { () -> [String: Any]? in
      let defaults = UserDefaults.standard
      let item = defaults.dictionary(forKey: quickAddKey)
      defaults.removeObject(forKey: quickAddKey)
      return item
    }

    AsyncFunction("requestNotificationPermission") { (promise: Promise) in
      UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { granted, _ in
        promise.resolve(granted)
      }
    }
  }
}
