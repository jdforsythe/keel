---
"@keel/std-sessions": patch
---

A group's project host keeps its process alive only while it starts or a module request waits on it, so a process that has recorded or replayed a group ends once its own work is done.
