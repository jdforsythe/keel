---
"@keel/server": patch
---

When the log sink throws on the last resort's record, the one stderr record follows the log's format: a json `diag` object under `format: 'json'`. A failed peer forward's `diag` names the thrown error only by a runtime error name (`Error`, `TypeError`, `RangeError`, `AbortError`, `TimeoutError` or `DOMException`), else `Error`.
