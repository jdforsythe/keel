---
"@keel/std-conflicts": patch
"@keel/std-sessions": patch
---

`races` fails an order whose transaction function raises a TypeError or RangeError; a defect or any other thrown value passes on to its caller. std-sessions encodes a recorded value after its schema parses it, and records `null` for one it refuses.
