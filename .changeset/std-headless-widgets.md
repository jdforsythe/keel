---
"@keel/std-headless": minor
---

Headless widgets on `Part`: `Listbox`, `Combobox`, `Menu`, `Tabs`, `Dialog`, `Disclosure` and `Toaster`, with the charts `optionsChart`, `openChart` and `toastChart` and the types `Option` and `ToastItem`. Each part's id is `<id>.<part>`; an option, tab or toast key outside 1 to 64 of `[A-Za-z0-9_-]`, or repeated in its widget, throws E2801 at render.
