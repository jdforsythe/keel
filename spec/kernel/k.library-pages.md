# k.library-pages: Library route components
status: implemented

**Route components.** A library's route component file is one a `manifest(` call of `@keel/router` in a file of the same library (k.library) binds as an entry's `component`: a name the binding file imports by a relative default import and uses nowhere else, the file's stem in no `public.exports`, the file no `exports` target, and no other file of the library importing it, `import()` and re-export included. The router renders it, once per page, and no caller passes it an `id`. An element there may take a literal `id` (a string, or a template with no substitution) `<id>.<rest>`, with no spread after it, `<id>` the library's manifest `id` and `<rest>` not empty; any other `id` there is judged by k.library Ids (E1161). E1166 keeps `<id>` the library's own: no app module and no other library holds it.

**Conformance.**
- In the project of k.library's first Conformance bullet, with `src/routes.ts` binding `component: Page` (`import Page from './Page.ts'`) in `manifest(`, `Box({ id: 'charts.page' })` in `src/Page.ts` is no E1161; `shop.page`, `charts`, `charts.` and `chartsx.page` there, and `charts.page` with no `src/routes.ts`, with `Page` in `public.exports` or with a spread after it, are each one E1161.
- In that project, with `src/routes.ts` binding `Page`, `charts.page` in `src/Page.ts` is one E1161 when `src/index.ts` re-exports it as `Status`, when `src/Both.ts` imports it, and when `src/routes.ts` exports `Page`.
