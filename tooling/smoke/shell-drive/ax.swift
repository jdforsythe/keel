// The macOS driver of tooling/smoke/shell-drive.mjs: one input in the web page of a running app, made through the
// accessibility API (AXUIElement), which reaches WKWebView content where no WebDriver does. The page's elements are
// found by their DOM id (WebKit's `AXDOMIdentifier`), a link by the path of its `AXURL`.
// Usage: ax <pid> trusted | route | dump | click <id> | nav <href> | type <id> <text> | value <id>
//   trusted  prints `true` when this process may use the accessibility API (System Settings, Privacy & Security,
//            Accessibility: the terminal or the CI runner's shell), else `false`; it never asks.
//   route    prints the path of the page's URL.
//   dump     prints one line per element of the page: role, DOM id, title or value.
//   click    presses element <id> (`AXPress`: a button, a checkbox, a link).
//   nav      presses the link whose URL path is <href>.
//   type     focuses field <id> and sets its value to <text>, as typing over its whole content does; the page
//            hears an `input` event.
//   value    prints the value of field <id>.
// Exit 0 on success; 1 with one line on stderr when the element is not there or refuses the action; 2 on bad usage.
import ApplicationServices
import Foundation

func fail(_ message: String, _ code: Int32 = 1) -> Never {
  FileHandle.standardError.write(Data((message + "\n").utf8))
  exit(code)
}

func attribute(_ element: AXUIElement, _ name: String) -> CFTypeRef? {
  var value: CFTypeRef?
  return AXUIElementCopyAttributeValue(element, name as CFString, &value) == .success ? value : nil
}

func text(_ element: AXUIElement, _ name: String) -> String? {
  guard let value = attribute(element, name) else { return nil }
  if let s = value as? String { return s }
  if let u = value as? URL { return u.absoluteString }
  if let n = value as? NSNumber { return n.stringValue }
  return nil
}

func children(_ element: AXUIElement) -> [AXUIElement] {
  guard let value = attribute(element, kAXChildrenAttribute), CFGetTypeID(value) == CFArrayGetTypeID()
  else { return [] }
  return (value as? [AXUIElement]) ?? []
}

/// Every element under `root`, depth first, at most `limit` of them.
func walk(_ root: AXUIElement, limit: Int = 20_000, _ visit: (AXUIElement, Int) -> Bool) {
  var stack: [(AXUIElement, Int)] = [(root, 0)]
  var seen = 0
  while let (element, depth) = stack.popLast() {
    seen += 1
    if seen > limit || !visit(element, depth) { return }
    for child in children(element).reversed() { stack.append((child, depth + 1)) }
  }
}

func first(_ root: AXUIElement, where matches: (AXUIElement) -> Bool) -> AXUIElement? {
  var found: AXUIElement?
  walk(root) { element, _ in
    if matches(element) { found = element }
    return found == nil
  }
  return found
}

let args = Array(CommandLine.arguments.dropFirst())
guard args.count >= 2, let pid = Int32(args[0]) else { fail("usage: ax <pid> <command> [arguments]", 2) }
let command = args[1]
if command == "trusted" {
  print(AXIsProcessTrusted())
  exit(0)
}
if !AXIsProcessTrusted() { fail("this process may not use the accessibility API") }
let app = AXUIElementCreateApplication(pid)
AXUIElementSetMessagingTimeout(app, 5)

/// The page: the first `AXWebArea` under the app's windows.
func page() -> AXUIElement {
  guard let area = first(app, where: { text($0, kAXRoleAttribute) == "AXWebArea" })
  else { fail("no web page in app \(pid)") }
  return area
}

func byId(_ id: String) -> AXUIElement {
  guard let element = first(page(), where: { text($0, "AXDOMIdentifier") == id }) else { fail("no element \(id)") }
  return element
}

func path(_ url: String?) -> String? { url.flatMap { URLComponents(string: $0)?.path } }

func press(_ element: AXUIElement, _ name: String) {
  let result = AXUIElementPerformAction(element, kAXPressAction as CFString)
  if result != .success { fail("\(name) refuses AXPress (\(result.rawValue))") }
}

func need(_ n: Int) { if args.count != n { fail("usage: ax <pid> \(command) takes \(n - 2) arguments", 2) } }

switch command {
case "route":
  need(2)
  print(path(text(page(), kAXURLAttribute)) ?? "")
case "dump":
  need(2)
  walk(page()) { element, depth in
    let parts = [text(element, kAXRoleAttribute), text(element, "AXDOMIdentifier").map { "#\($0)" },
                 text(element, kAXTitleAttribute), text(element, kAXDescriptionAttribute),
                 text(element, kAXValueAttribute), path(text(element, kAXURLAttribute))]
    print(String(repeating: " ", count: depth) + parts.compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " "))
    return true
  }
case "click":
  need(3)
  press(byId(args[2]), args[2])
case "nav":
  need(3)
  let root = page()
  let leads = { (e: AXUIElement) in text(e, kAXRoleAttribute) == "AXLink" && path(text(e, kAXURLAttribute)) == args[2] }
  guard let link = first(root, where: leads)
  else { fail("no link to \(args[2])") }
  press(link, "the link to \(args[2])")
case "type":
  need(4)
  let field = byId(args[2])
  AXUIElementSetAttributeValue(field, kAXFocusedAttribute as CFString, kCFBooleanTrue)
  let result = AXUIElementSetAttributeValue(field, kAXValueAttribute as CFString, args[3] as CFString)
  if result != .success { fail("\(args[2]) refuses a value (\(result.rawValue))") }
  let now = text(byId(args[2]), kAXValueAttribute) ?? ""
  if now != args[3] { fail("\(args[2]) holds \(now.count) characters after a value of \(args[3].count)") }
case "value":
  need(3)
  print(text(byId(args[2]), kAXValueAttribute) ?? "")
default:
  fail("usage: ax <pid> trusted | route | dump | click <id> | nav <href> | type <id> <text> | value <id>", 2)
}
