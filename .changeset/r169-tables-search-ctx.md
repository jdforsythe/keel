---
"@keel/std-tables": minor
---

`TableSearch` navigates through the public `navigate` inside its own scope and takes its clock from `ctx` only (its third argument, the route component's): rendered without one it never navigates.
