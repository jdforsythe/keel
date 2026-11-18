---
"@keel/check": minor
"@keel/std-messages": minor
---

E1758 finds a date by its TypeScript type through the type pass, so a `Date` parameter, member, call result or import is read; with the type pass off it reads a `new Date(...)` or a `const` bound to one. New rule E1759 reports a Node-only global or built-in import in a browser file, and `require`, `__dirname` or `__filename` in any app file, with a fix to `import.meta.dirname` and `import.meta.filename` outside the browser. E2406 reads `placeholder`, `title`, the `aria-*` text attributes and `children`, an uppercase call's object properties, every `.tsx` file of the module and every return of a route `title`, through templates, `+`, thunks and `const`s. A kernel rule's `explain` is optional: `keel explain` reads its row in the explanation table.
