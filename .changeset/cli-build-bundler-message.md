---
"@keel/cli": patch
---

A failed `keel build` prints the bundler's message lines (`<file>:<line>:<col>: ERROR: Could not resolve "<specifier>"`) without the stack under them: the last 12, under a count of the lines before.
