---
"@keel/std-capacitor": minor
---

Every `net.fetch` request goes through the package's own native plugin, `KeelHttp` (Android `HttpURLConnection`, iOS `URLSession`), on the cookie store `CapacitorHttp` uses. A response resolves on its headers and its body streams chunk by chunk, so server-sent events arrive in a Capacitor shell; aborting a request cancels the native request.
