# Golden app 2 (recipe box, API-backed)

Build `apps/golden-2/`: a recipe box whose data lives behind an API. Use only kernel APIs from the spec slice; read a full section with `pnpm spec <id>`; skills `keel-api`, `keel-forms`, `keel-testing` are in `.claude/skills/<name>/SKILL.md`. Edit nothing outside `apps/golden-2/` (the root `pnpm install` lockfile change excepted). Scaffold with `keel scaffold project golden-2 --workspace` (keep its `index.html` and `vitest.config.ts`; replace its `app` module), then `pnpm install` at the root. If the slice leaves an API you need unspecified, stop and report `blocked: <section> <question>`; invent nothing.

## Topology
`topology.ts` default export: `web` (`adapter: 'client'`, module `recipes`) and `api` (`adapter: 'node'`, module `kitchen`, deps `recipes`). Schemas both modules use live in `recipes` and are public exports.

## Data
- `Recipe { id: s.id('Recipe'), title: string 1-80, minutes: int 1-600, favorite: boolean }`, `Box { recipes: Recipe[] }`, `RecipeDraft { title, minutes }` (same bounds), `RecipeParams { recipeId: s.id('Recipe') }`, `RecipeSearch { only: 'all' | 'favorites', optional }`.

## `kitchen` (api, node)
- A server-state factory `boxStores` returning store `kitchen.box` (`Box`, initially empty) with an `invariant` beside it (ids unique; titles unique ignoring case) and pure transactions `kitchen.addRecipe` (id arrives in the payload) and `kitchen.toggleFavorite` (unknown id leaves state unchanged).
- Routes (`modules/kitchen/routes.ts` exports `routes`), loaders and actions declare `stores: boxStores`:
  - `kitchen.recipes` `/api/recipes`: GET loader returns the `Box`; POST takes `RecipeDraft`, mints the id with `ctx.random.id('Recipe')`; a title already in the box (ignoring case) is `err` `keel.fields` `{ title: 'Already in the box' }`.
  - `kitchen.favorite` `/api/recipes/:recipeId/favorite`: POST toggles; unknown id is `keel.notFound`.

## `recipes` (client)
`modules/recipes/routes.ts` exports `routes`. Loaders and actions call the api through a `@keel/services` client (base `new URL(url).origin`), never a view store.
- Layout `recipes.shell` (`BoxShell`): a `main`, Link `recipes.home` to the index, Link `recipes.newLink` to `recipes.new`.
- `recipes.index` `/`, search `RecipeSearch`: every recipe (or only favorites) as Link `recipes.link.<id>` (text: title) with Text `recipes.minutes.<id>` (`<n> min`); filter Links `recipes.filter.all`, `recipes.filter.favorites`; Text `recipes.empty` when none.
- `recipes.show` `/recipes/:recipeId`: Text `recipes.title` (title), Text `recipes.favorite` (`Favorite` or `Not favorite`), and a Form posting to this route's POST action, whose submit Button `recipes.toggleFavorite` toggles through the api and revalidates (`ok(null)`). Unknown id: the loader returns `err` `keel.notFound`; errorElement `RecipeError` renders Text `recipes.error`.
- `recipes.new` `/recipes/new`, guard `cook` (`cook.guard.ts`): denies when `ctx.storage` key `recipes.guest` is `"1"`, redirecting to `recipes.index`. A Form with `form(RecipeDraft, { id: 'recipes.draft' })`: Input `title` (label `Title`), Input `minutes` (label `Minutes`), submit Button `recipes.save`. Success navigates to `recipes.index`; the api's 422 `keel.fields` passes on to the Form.
- UI: `@keel/ui` base elements, style props from `tokens.ts` tokens (fg/bg/accent/danger, light and dark), a11y-required props.

## Tests (`@keel/testing` only; ids only)
- `test/api.test.ts`: `properties()` on `addRecipe` and `toggleFavorite`; both endpoints through `createApp({ topology, routes, ctx, deployable: 'api' }).fetch` (runtime JSON), including 404 and 422.
- `test/routes.test.ts`: `renderRoute` with a sim ctx whose `net` routes `/api/*` to that app: filtering, toggling favorite, unknown id, guest redirect, invalid submit sends nothing and focuses `recipes.draft:title`, duplicate title shows `recipes.draft:title:error`.

## Acceptance (checked by `pass.ts`)
1. `pnpm --filter golden-2 check` and `keel check` in `apps/golden-2` clean.
2. `pnpm test --filter golden-2` green.
3. `invariant(` in `modules/kitchen`; a `stores:` declaration in a kitchen `*.server.ts`; `properties(addRecipe` and `properties(toggleFavorite` in tests.
4. `unsafe(` count 0; no `any`, casts, `!`, `@ts-ignore`.
5. A hidden `renderRoute` suite passes against your `topology`, both `routes`, and the ids above: index and favorites filter, favorite toggle, unknown id, guest redirect, form validation and duplicate title, create then listed.
