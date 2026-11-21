---
"@keel/testing": minor
---

The render checks of k.a11y: axe-core runs synchronously at every render check with the WCAG 2.0, 2.1 and 2.2 A and AA rules and `landmark-unique` (E1703), the document rules (`document-title`, `html-has-lang`, `landmark-one-main`, `region`, `bypass`) on `renderRoute` only, and `color-contrast` replaced by render contrast from atomic classes and `artifacts.tokens` (E1804); a `data-k-pii` control without `autocomplete` is E1821. `renderRoute` renders a document: the router's `<title>` and `<html lang>`, the route id as the title when there is none, the chain the `main` landmark unless it renders one. Handles have `focusOrder()`. Each check is kept in the vitest test's `meta.a11y`; `@keel/testing/a11y` exports `A11yRun`, `A11yCase`, `writeA11yReport` (writes `reports/a11y.json`), `criteriaOf`, `a11yRules` and `WCAG_CRITERIA`.
