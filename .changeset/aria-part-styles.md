---
"@keel/compiler": minor
"@keel/ui": minor
---

Part styles (k.aria): the compiler collects the style props of `Part` and of each part in the `styles` prop of a component imported from a `@keel/std-*` package, and `StyleUsage.state` also takes `selected`, `checked`, `expanded` and `highlighted`; `compileStyles` writes them under `[aria-selected="true"]`, `[aria-checked="true"]` and `:checked`, `[aria-expanded="true"]` and `[data-k-highlighted]`.
