---
"@keel/std-tokens": patch
---

`tokens(ctx).check` answers `credentials.mismatch` for a presented value that is not a `Secret` string instead of throwing, and treats an expiry the clock does not read as later than now (a `NaN` clock) as passed.
