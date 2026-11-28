---
"@keel/store": patch
---

`openHeld` (`@keel/store/internal`) given arguments of the wrong kind raises a defect at the call, before any work starts, and leaves no promise to reject unread.
