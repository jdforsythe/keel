# k.head: Document head
status: conformance-covered

**Purpose.** Every document names its page and its language. The server writes both, and the client router keeps them current on navigation without re-rendering text.

**Title.** A path route may declare `title: (props) => string`, given the route component's props `{ params, search, data }` (k.router), `data` being its loader's `ok` value, typed from the loader's `output`. A layout with `title` does not compile.
```ts
'recipes.show': { path: '/:locale/recipes/:recipeId', params: RecipeParams, loader: loadRecipe,
  component: RecipePage, title: (p) => formatMessage(p.data.text.showTitle, { title: p.data.recipe.title }, p.params.locale) },
```
The document's title is the matched route's `title`. Without one, when a loader in the chain returns `err`, and for a 404, it is the fallback: the served deployable's name on a server, the `index.html` title in a `client` deployable (read once at `mount`).

**Language.** `<html lang>` is the matched route's value of its prefix param (k.prefix), read from the matched params; a route without a prefix param, and a 404, give `en`.

**Server.** The head holds, in order: charset, viewport, `<title>`, a `<link rel="stylesheet">` for each `.css` file under `/assets/` that the build manifest's entry chunk names, and `<link rel="icon" href="/keel-mark.svg">` when the build has the mark. In dev, or without a build, it holds the title only. Each value is escaped and nothing is inline, so a strict CSP allows it. The default alert for `keel.notFound` is `<h1>Not found</h1>`.

**Client.** At `mount`, at `resume` and after each navigation's chain has rendered, the router sets `document.title` and `document.documentElement.lang` by the rules above where they differ. It writes nothing else: no element or text node is rebuilt.

**Rules.** None of its own. A string literal with a letter returned by `title` in a module that lists `@keel/std-messages` is E2406 (std.messages).

**Conformance.**
- A node document for a route with `title` has `<title>` its return value, escaped; for a route without one, after a loader `err`, and for a 404, the deployable's name.
- With a prefix param whose `pathDefault` is `en-US`, the document at `/de-DE/...` has `<html lang="de-DE">` and at the unprefixed URL `<html lang="en-US">`; a route with no prefix param has `lang="en"`.
- After a client navigation from a titled `en-US` route to a titled `de-DE` route, `document.title` and `document.documentElement.lang` are the second route's.
- After `resume` of a served document, `document.title` and `lang` equal the served document's.
- A built document has the head this section names; an unmatched path is 404 with an `h1`.
