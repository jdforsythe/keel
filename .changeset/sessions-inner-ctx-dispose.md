---
"@keel/std-sessions": patch
---

The `session` capability's real and shell sinks dispose their own ctx at once, so they hold no window `online` or `offline` listener.
