import Capacitor
import Foundation

/// Keel's HTTP client for a Capacitor shell. Each request is a `URLSession` data task with the default configuration,
/// whose cookies `HTTPCookieStorage.shared` keeps (the store `CapacitorHttp` uses). `request` resolves with the status
/// and headers, `set-cookie` left out; the body follows as `chunk` events of at most 16 KiB (base64), then `end`, or
/// `fail` on an error. A URL is sent only when its origin is in the plugin's `allow` configuration
/// (`plugins.KeelHttp.allow` of `capacitor.config.json`, exact `http:` or `https:` origins); any other, and every URL
/// when there is no list, is rejected before a task starts. No redirect is followed: a 3xx resolves as it came, its
/// cookies kept. A response that sets a cookie resolves after `URLSession.flush` has written the cookie store to disk, so the
/// cookie outlives a force-stop that follows at once. `cancel` cancels the task.
@objc(KeelHttpPlugin)
public class KeelHttpPlugin: CAPPlugin, CAPBridgedPlugin, URLSessionDataDelegate {
    public let identifier = "KeelHttpPlugin"
    public let jsName = "KeelHttp"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "request", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancel", returnType: CAPPluginReturnPromise)
    ]

    private struct Entry {
        let id: String
        let task: URLSessionDataTask
        var call: CAPPluginCall?
        var cancelled = false
    }

    private let chunk = 16 * 1024
    private let lock = NSLock()
    /// The requests in flight, by task identifier.
    private var table: [Int: Entry] = [:]
    private lazy var session = URLSession(configuration: .default, delegate: self, delegateQueue: nil)

    /// The origin of `url` as the page writes one: scheme, host and a port that is not the scheme's own; nil when it
    /// is not http(s).
    static func origin(of url: URL) -> String? {
        guard let scheme = url.scheme?.lowercased(), scheme == "http" || scheme == "https",
              let host = url.host?.lowercased(), !host.isEmpty else { return nil }
        let named = host.contains(":") ? "[\(host)]" : host
        guard let port = url.port, port != (scheme == "https" ? 443 : 80) else { return "\(scheme)://\(named)" }
        return "\(scheme)://\(named):\(port)"
    }

    /// Whether the `allow` configuration lists the origin of `url`.
    private func allowed(_ url: URL) -> Bool {
        guard let origin = KeelHttpPlugin.origin(of: url) else { return false }
        let allow = (getConfig().getArray("allow") ?? []).compactMap { $0 as? String }
        return allow.contains(origin)
    }

    @objc func request(_ call: CAPPluginCall) {
        guard let id = call.getString("id"), let url = URL(string: call.getString("url") ?? ""), allowed(url) else {
            call.reject("network request failed")
            return
        }
        var req = URLRequest(url: url)
        req.httpMethod = call.getString("method") ?? "GET"
        req.timeoutInterval = 600
        for (k, v) in call.getObject("headers") ?? [:] {
            if let v = v as? String { req.setValue(v, forHTTPHeaderField: k) }
        }
        if let data = call.getString("data") { req.httpBody = Data(data.utf8) }
        let task = session.dataTask(with: req)
        lock.withLock { table[task.taskIdentifier] = Entry(id: id, task: task, call: call) }
        task.resume()
    }

    @objc func cancel(_ call: CAPPluginCall) {
        let id = call.getString("id") ?? ""
        lock.withLock {
            for (key, entry) in table where entry.id == id {
                table[key]?.cancelled = true
                entry.task.cancel()
            }
        }
        call.resolve()
    }

    public func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive response: URLResponse,
                           completionHandler: @escaping (URLSession.ResponseDisposition) -> Void) {
        let call = lock.withLock { () -> CAPPluginCall? in
            let call = table[dataTask.taskIdentifier]?.call
            table[dataTask.taskIdentifier]?.call = nil
            return call
        }
        let http = response as? HTTPURLResponse
        var headers: [String: String] = [:]
        for (k, v) in http?.allHeaderFields ?? [:] {
            if let k = k as? String, k.lowercased() != "set-cookie" { headers[k] = "\(v)" }
        }
        let answer: [String: Any] = ["status": http?.statusCode ?? 200, "headers": headers]
        if http?.value(forHTTPHeaderField: "Set-Cookie") == nil {
            call?.resolve(answer)
        } else {
            // The shared cookie store writes to disk a moment after it takes a cookie: the session flushes it, and
            // the page hears of the response once the cookie outlives a force-stop.
            session.flush { call?.resolve(answer) }
        }
        completionHandler(.allow)
    }

    public func urlSession(_ session: URLSession, task: URLSessionTask,
                           willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest,
                           completionHandler: @escaping (URLRequest?) -> Void) {
        // No new request: the task completes with the redirect response itself.
        completionHandler(nil)
    }

    public func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
        guard let entry = lock.withLock({ table[dataTask.taskIdentifier] }), !entry.cancelled else { return }
        var at = data.startIndex
        while at < data.endIndex {
            let end = data.index(at, offsetBy: chunk, limitedBy: data.endIndex) ?? data.endIndex
            notifyListeners("chunk", data: ["id": entry.id, "data": data[at..<end].base64EncodedString()])
            at = end
        }
    }

    public func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        guard let entry = lock.withLock({ table.removeValue(forKey: task.taskIdentifier) }) else { return }
        if let call = entry.call {
            call.reject("network request failed")
        } else if entry.cancelled {
            return
        } else if let error = error {
            notifyListeners("fail", data: ["id": entry.id, "message": error.localizedDescription])
        } else {
            notifyListeners("end", data: ["id": entry.id])
        }
    }
}
