---
"@keel/testing": patch
---

`prove` rejects E1710 for an `rlimit` above 4,294,967,295, the largest resource limit Z3 takes. Such a value used to reach the solver and come back as an error with no code.
