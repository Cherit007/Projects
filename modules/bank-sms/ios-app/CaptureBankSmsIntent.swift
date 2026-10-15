import AppIntents
import Foundation
import UserNotifications

// Added to the app target by modules/bank-sms/app.plugin.js: App Intents must
// live in the app itself to appear in the Shortcuts app.

/// Run by the user's Shortcuts "Message" automation. Keeps only messages that
/// look like bank transaction alerts and drops everything else (including
/// OTPs) without storing it. The app parses the queue the next time it opens.
@available(iOS 16.0, *)
struct CaptureBankSmsIntent: AppIntent {
  static let title: LocalizedStringResource = "Capture bank SMS"
  static let description = IntentDescription(
    "Sends a bank transaction message to FinanceTracker for review. Other messages and OTPs are ignored."
  )
  static let openAppWhenRun = false

  @Parameter(title: "Message")
  var message: String

  func perform() async throws -> some IntentResult & ReturnsValue<Bool> {
    guard let amount = BankSmsFilter.transactionAmount(in: message) else {
      return .result(value: false)
    }
    BankSmsQueue.append(message)
    await BankSmsNotifier.notify(amount: amount)
    return .result(value: true)
  }
}

@available(iOS 16.0, *)
struct FinanceTrackerShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: CaptureBankSmsIntent(),
      phrases: ["Capture bank SMS in \(.applicationName)"],
      shortTitle: "Capture bank SMS",
      systemImageName: "indianrupeesign.circle"
    )
  }
}

enum BankSmsFilter {
  /// The transaction amount if the text looks like a bank debit or credit
  /// alert, otherwise nil. Detailed parsing happens in the app.
  static func transactionAmount(in text: String) -> String? {
    if matches(#"\b(otp|one[\s-]?time\s+password|upi\s+pin|mpin|cvv)\b"#, text) {
      return nil
    }
    guard matches(#"\b(debited|credited|sent|paid|spent|withdrawn|received|transferred|trf)\b"#, text) else {
      return nil
    }
    return firstCapture(#"(?:₹|\bRs\.?|\bINR)\s*([\d,]+(?:\.\d{1,2})?)"#, text)
      ?? firstCapture(#"\b(?:debited|credited)\s+(?:by|with|for)\s+([\d,]+(?:\.\d{1,2})?)"#, text)
  }

  private static func matches(_ pattern: String, _ text: String) -> Bool {
    guard let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive) else { return false }
    return regex.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)) != nil
  }

  private static func firstCapture(_ pattern: String, _ text: String) -> String? {
    guard
      let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive),
      let match = regex.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)),
      let range = Range(match.range(at: 1), in: text)
    else { return nil }
    return String(text[range])
  }
}

/// Shared with BankSmsModule through the app's UserDefaults; keep the keys in sync.
enum BankSmsQueue {
  static let queueKey = "financetracker.bankSms.queue"
  static let lastCapturedKey = "financetracker.bankSms.lastCapturedAt"
  private static let limit = 200

  static func append(_ text: String) {
    let defaults = UserDefaults.standard
    let now = Date().timeIntervalSince1970 * 1000
    var items = defaults.array(forKey: queueKey) as? [[String: Any]] ?? []
    items.append(["id": UUID().uuidString, "text": text, "receivedAt": now])
    defaults.set(Array(items.suffix(limit)), forKey: queueKey)
    defaults.set(now, forKey: lastCapturedKey)
  }
}

enum BankSmsNotifier {
  static func notify(amount: String) async {
    let center = UNUserNotificationCenter.current()
    let settings = await center.notificationSettings()
    guard settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional else {
      return
    }
    let content = UNMutableNotificationContent()
    content.title = "Payment detected"
    content.body = "₹\(amount) · Tap to add it to your expenses"
    content.sound = .default
    let request = UNNotificationRequest(identifier: UUID().uuidString, content: content, trigger: nil)
    try? await center.add(request)
  }
}
