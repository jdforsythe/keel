# ADR-0011: Capacitor for mobile, Tauri for desktop

**Status:** accepted
**Context.** Both wrap static builds in system WebViews; Capacitor leads on mobile push, OTA, and ecosystem; Tauri leads on desktop size and security model. Tauri lacks official push.
**Decision.** `mobile` deployables target Capacitor; `desktop` deployables target Tauri; both generated from topology and declared capabilities. Revisit if Tauri closes push and OTA gaps.
**Consequences.** Engine matrix adds WebView2, WKWebView, WebKitGTK to `bench`.
