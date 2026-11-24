// The iOS driver of tooling/smoke/shell-drive.mjs: a UI test that makes inputs in the web page of an installed app
// through the accessibility tree, which reaches WKWebView content where no WebDriver does. It builds no app: the app
// under test is named by its bundle id. The test asks the smoke for one command at a time and answers each:
// `POST <KEEL_DRIVE_URL>/next` carries the last command's answer `{ ok, value }` or `{ ok: false, error }` and is
// answered with the next command, `{ kind, role, label, within, value, seconds }`:
//   launch  starts the app (ending a running one first)
//   click   taps the element of `role` (link, button, checkbox, field) whose accessibility label is `label`; a
//           checkbox is tapped on its box
//   type    taps that field at its end, deletes its content, types `value` and puts the keyboard away (Done)
//   dump    answers the app's accessibility tree
//   end     ends the test
// `within` names the page landmark the element is under (`main`); `seconds` is how long it has to appear. WebKit on
// iOS gives a page element's role and label to the accessibility tree and not its DOM id, so the smoke names both.
// The environment comes from `xcodebuild` (`TEST_RUNNER_<NAME>`): `KEEL_DRIVE_URL`, and `KEEL_DRIVE_APP`, the bundle
// id. Without them the test is skipped.
import XCTest

final class ShellDrive: XCTestCase {
  func testDrive() throws {
    let env = ProcessInfo.processInfo.environment
    guard let base = env["KEEL_DRIVE_URL"], let url = URL(string: base + "/next"), let appId = env["KEEL_DRIVE_APP"]
    else { throw XCTSkip("KEEL_DRIVE_URL and KEEL_DRIVE_APP are not set: run tooling/smoke/shell-drive.mjs") }
    continueAfterFailure = true
    let app = XCUIApplication(bundleIdentifier: appId)
    var answer: [String: Any] = ["ok": true, "value": "ready"]
    while true {
      guard let command = try exchange(url, answer) else { return }
      let kind = command["kind"] as? String ?? ""
      let seconds = command["seconds"] as? Double ?? 15
      switch kind {
      case "end":
        return
      case "launch":
        app.launch()
        answer = ["ok": true, "value": ""]
      case "dump":
        answer = ["ok": true, "value": app.debugDescription]
      case "click":
        answer = act(app, command, seconds) { target in
          if command["role"] as? String == "checkbox" {
            // A checkbox's element spans its box and its label: tap the box, at its leading edge.
            let half = target.frame.height / 2
            target.coordinate(withNormalizedOffset: .zero).withOffset(CGVector(dx: half, dy: half)).tap()
          } else {
            target.tap()
          }
          return nil
        }
      case "type":
        let value = command["value"] as? String ?? ""
        answer = act(app, command, seconds) { field in
          field.coordinate(withNormalizedOffset: CGVector(dx: 0.95, dy: 0.5)).tap()
          let old = (field.value as? String) ?? ""
          let holds = old.isEmpty || old == field.placeholderValue ? 0 : old.count
          field.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: holds) + value)
          // The keyboard covers the lower half of the page: put it away, so the next tap lands on its element.
          let done = app.toolbars.buttons["Done"]
          if done.exists { done.tap() }
          if app.keyboards.firstMatch.exists { return "leaves the keyboard up (no Done button above it)" }
          let now = field.value as? String ?? ""
          return now == value ? nil : "holds \(now.count) characters after typing \(value.count)"
        }
      default:
        answer = ["ok": false, "error": "unknown command \(kind)"]
      }
    }
  }

  private static let roles: [String: XCUIElement.ElementType] = [
    "link": .link, "button": .button, "checkbox": .switch, "field": .textField,
  ]

  /// The element a command names: of `role` and labelled `label`, under the page element labelled `within`.
  private func act(
    _ app: XCUIApplication, _ command: [String: Any], _ seconds: Double, _ input: (XCUIElement) -> String?
  ) -> [String: Any] {
    let role = command["role"] as? String ?? ""
    let label = command["label"] as? String ?? ""
    guard let type = ShellDrive.roles[role] else { return ["ok": false, "error": "unknown role \(role)"] }
    var scope: XCUIElementQuery = app.webViews
    if let within = command["within"] as? String {
      let landmark = scope.otherElements.matching(NSPredicate(format: "label == %@", within)).firstMatch
      scope = landmark.descendants(matching: .any)
    } else {
      scope = scope.descendants(matching: .any)
    }
    let target = scope.matching(type, identifier: nil).matching(NSPredicate(format: "label == %@", label)).firstMatch
    guard target.waitForExistence(timeout: seconds) else {
      return ["ok": false, "error": "no \(role) labelled \(label) within \(Int(seconds))s; \(seen(app, type, scope))"]
    }
    if let refused = input(target) { return ["ok": false, "error": "the \(role) labelled \(label) \(refused)"] }
    return ["ok": true, "value": ""]
  }

  /// What the page shows when an element did not appear, on one line: whether the `within` landmark exists, the labels of
  /// the elements of the wanted type in scope, and the labels of those of that type anywhere in the web view.
  private func seen(_ app: XCUIApplication, _ type: XCUIElement.ElementType, _ scope: XCUIElementQuery) -> String {
    func labels(_ q: XCUIElementQuery) -> String {
      let all = q.matching(type, identifier: nil).allElementsBoundByIndex.prefix(12).map { $0.label }
      return "[" + all.joined(separator: " | ") + "]"
    }
    let page = app.webViews.descendants(matching: .any)
    let texts = app.webViews.descendants(matching: .staticText).allElementsBoundByIndex.prefix(12).map { $0.label }
    return "in scope \(labels(scope)); in page \(labels(page)); text [\(texts.joined(separator: " | "))]"
  }

  /// Send `answer`, wait for the next command. Nil when the smoke is gone.
  private func exchange(_ url: URL, _ answer: [String: Any]) throws -> [String: Any]? {
    var request = URLRequest(url: url, timeoutInterval: 900)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "content-type")
    request.httpBody = try JSONSerialization.data(withJSONObject: answer)
    let done = DispatchSemaphore(value: 0)
    var body: Data?
    URLSession.shared.dataTask(with: request) { data, _, _ in
      body = data
      done.signal()
    }.resume()
    done.wait()
    guard let body, let command = try JSONSerialization.jsonObject(with: body) as? [String: Any] else { return nil }
    return command
  }
}
