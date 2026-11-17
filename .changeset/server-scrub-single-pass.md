---
"@keel/server": minor
---

The log scrub reads each text once with one automaton over every written form of the request's secret and pii values, in steps linear in the text however many values there are. Past 2,000,000 characters of distinct written forms, the `diag` message and each frame are written as one mark (`[secret]` if the request made a secret, else `[pii]`). Matching ignores letter case in the Basic Multilingual Plane, base64 included, so a near copy may be over-marked and is never missed; a padded base64 copy goes with its `=` padding in either alphabet.
