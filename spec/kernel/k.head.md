# k.head: Document head
status: implemented

**Purpose.** Every document names its page and its language. The server writes both, and the client router keeps them current on navigation without re-rendering text.

**Title.** A path route may declare `title: (props) => string`, given the route component's props `{ params, search, data }` (k.router), `params` and `search` typed from the route's schemas and `data`, its loader's `ok` value, from the loader's `output`. A layout with `title` does not compile.
```ts
'recipes.show': { path: '/:locale/recipes/:recipeId', params: RecipeParams, loader: loadRecipe,
  component: RecipePage, title: (p) => formatMessage(p.data.text.showTitle, { title: p.data.recipe.title }, p.params.locale) },
```
The document's title is the matched route's `title`. Without one, when a loader in the chain returns `err`, and for a 404, it is the fallback: the served deployable's name: a server's, and a `client` deployable's `index.html` title (read once at `mount`).

**Language.** `<html lang>` is the matched route's value of its prefix param (k.prefix), read from the matched params; a route without a prefix param, and a 404, give `en`.

**Server.** The head holds, in order: charset, viewport, `<title>`, a `<link rel="stylesheet">` for each `.css` file under `/assets/` that the build manifest's entry chunk names, and `<link rel="icon" href="/keel-mark.svg">` when the build has the mark. In dev the stylesheet link is `/@keel/styles.css?d=<deployable>`, which `keel dev` answers with the deployable's `styles` and the atomic CSS, so the first paint is styled before any script runs; without a build in production the head holds the title only. Each value is escaped and nothing is inline, so a strict CSP allows it. The default alert for `keel.notFound` is `<h1>Not found</h1>`.

**Document source.** Keel writes every document: k.head's on a server, and a `client` deployable's `index.html` in dev and build (charset, viewport, `<title>` its name, the icon, a stylesheet link per entry `.css` file, in dev the one to `/@keel/styles.css?d=<name>`, `#app`, the entry). A project's own `index.html` is never read. A deployable's `styles` (k.topology) is how CSS such as fonts reaches its documents.

**Client.** Scroll: a push or replace to another path goes to the top (or the hash target); back or forward restores each entry's; one that changes only the search, and revalidation, keep it. At `mount`, at `resume` and after each navigation's chain has rendered, the router sets `document.title` and `document.documentElement.lang` by the rules above where they differ. After a navigation to another route it moves focus to the page's first `h1`, setting `tabindex="-1"`, else to `main`; a navigation within one route keeps focus: a kept page (k.router) keeps the focused element, a page rendered anew focuses the element with the same id. Revalidation (an action's `ok(null)`) moves neither focus nor scroll. Neither it nor a kept page rebuilds an element or text node. On a kept page, a focused element the navigation removed hands focus to the element with its id, else, when no widget took it, to the page's first `role="status"` region, else `main` (`tabindex="-1"`).

**Rules.** W1012 a project root holding `index.html`, once per `keel check`, `keel dev` and `keel build`, naming it (fix: move markup into a layout, stylesheets into `styles`). A string literal with a letter returned by `title` in a module that lists `@keel/std-messages` is E2406 (std.messages).

**Conformance.**
- A node document for a route with `title` has `<title>` its return value, escaped; for a route without one, after a loader `err`, and for a 404, the deployable's name.
- With a prefix param whose `pathDefault` is `en-US`, the document at `/de-DE/...` has `<html lang="de-DE">` and at the unprefixed URL `<html lang="en-US">`; a route with no prefix param has `lang="en"`.
- After a client navigation from a titled `en-US` route to a titled `de-DE` route, `document.title` and `document.documentElement.lang` are the second route's.
- After `resume` of a served document, `document.title` and `lang` equal the served document's.
- A built document has the head this section names; an unmatched path is 404 with an `h1`.
- After a client navigation to another route, the focused element is the new page's first `h1`, with `tabindex="-1"`, or `main` when it has none; after a navigation that changes only the search, focus is where it was.
- After a push or replace to another route scroll is 0, after a search-only one it is unchanged; back and forward restore each entry's position, also for two entries with one URL.
- After a search-only navigation, `document.title` is the route's `title` for the new search and data, and the focused element and every `role="status"` node are the same nodes as before.
- With a project `index.html` holding `<header>Only here</header>`, neither `keel dev`'s nor the built `dist/web/index.html` of `client` deployable `web` holds that text, the built one's `<title>` is `web`, and `keel check` prints one W1012 naming `index.html`; without the file, none.
- Under `keel dev`, a `node` deployable's document and a `client` deployable's `index.html` each link a stylesheet that answers 200 as `text/css` and holds the atomic rules of every `k-*` class the served page uses and the `@font-face` rules of its `styles`.
