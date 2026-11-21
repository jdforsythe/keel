# Golden app 2 (recipe box, API-backed, three locales)

Build `apps/golden-2/`: a recipe box whose data lives behind an API, shown in `en-US`, `de-DE` and `ja-JP`. Use only kernel and stdlib APIs from the spec slice; read a full section with `pnpm spec <id>`; skills `keel-server`, `keel-client`, `keel-testing` are in `.claude/skills/<name>/SKILL.md`. Edit nothing outside `apps/golden-2/` (the root `pnpm install` lockfile change excepted). Scaffold from `apps/` with `keel scaffold project golden-2 --workspace`, which writes `apps/golden-2/` (keep its `index.html` and `vitest.config.ts`; replace its `app` module), then `pnpm install` at the root. `package.json` depends on `@keel/std-i18n`, `@keel/std-money`, `@keel/std-temporal`, `@keel/std-text` and `@keel/std-messages`. Its `check` script runs `tsc --noEmit`, biome and `keel check`. If the slice leaves an API you need unspecified, stop and report `blocked: <section> <question>`; invent nothing.

## Topology
`topology.ts` default export: `web` (`adapter: 'client'`, `servedBy: 'api'`, module `recipes`) and `api` (`adapter: 'node'`, module `kitchen`). Schemas both modules use (`Recipe`, `Box`, `RecipeDraft`, `RecipeRef`, `Nothing`) live in `kitchen` and are public exports; Each module has one contract (`kitchen.contract.ts` and `recipes.contract.ts`, k.contract): every route is an entry of it, and `recipes` calls `kitchen`'s entries through that contract, which `deps` allows. `recipes` lists `kitchen` and the five stdlib packages in `deps`; `kitchen` lists the value packages it uses and `@keel/std-postgres`, and capabilities `clock` and `kitchen.db`.

## Data
- `AppLocale = s.enum(['en-US', 'de-DE', 'ja-JP'], { pathDefault: 'en-US' })` (`AppLocale.schema.ts`); `LocaleParams { locale: AppLocale }`.
- `Recipe { id: s.id('Recipe'), title: line({ max: 80 }), minutes: int 1-600, favorite: boolean, price: Money, addedOn: PlainDate }`, `Box { recipes: Recipe[] }`, `RecipeDraft { title, minutes, price }` (same types), `RecipeParams { locale: AppLocale, recipeId: s.id('Recipe') }`, `RecipeRef { recipeId: s.id('Recipe') }` (the api's params), `RecipeSearch { only: 'all' | 'favorites', optional }`.
- Message set `RecipesText` (`RecipesText.schema.ts`, `messages(AppLocale, keys, load)`) with `RecipesText/en-US.ts`, `de-DE.ts`, `ja-JP.ts`. It holds every string the screens show, the `Keel` mark text and the tagline included. Loaders return it as `text`; components read `props.data.text`.

## `kitchen` (api, node)
- The recipes live in Postgres through `@keel/std-postgres`: `modules/kitchen/kitchenDb.server.ts` exports `kitchenDb = database('kitchen.db')` (`@keel/std-postgres/server`), and `modules/kitchen/migrations/0001-recipes.sql` makes the `recipes` table, with a unique index on `lower(title)` named `recipes_title_key`; the capability reads the migration at its first query. Loaders and actions declare `{}` and query with `sql(Schema)` templates through `kitchenDb(ctx)`.
- Contract `kitchen` (`modules/kitchen/kitchen.contract.ts`) and its binding (`modules/kitchen/routes.ts` exports `routes = manifest(kitchen, {...})`); loaders and actions name their entry and declare `{}`:
  - `kitchen.box` GET `/api/recipes`: loader returns the `Box` (`query`, oldest first).
  - `kitchen.add` POST `/api/recipes`: action takes `RecipeDraft`, mints the id with `ctx.random.id('Recipe')` and `addedOn` as `plainDateOf` of `instantOf(ctx.clock.now())` in `UTC`, and inserts with `run(sql(NoRows)...)`; the unique index's `postgres.constraint` error (constraint `recipes_title_key`) is `err` `keel.fields` naming `title`.
  - `kitchen.favorite` POST `/api/recipes/:recipeId/favorite` (params `RecipeRef`): toggles in one `update ... returning id as "recipeId"` through `one(sql(RecipeRef)...)`; unknown id is `keel.notFound`.

## `recipes` (client)
`modules/recipes/recipes.contract.ts` holds its pages and layout; `modules/recipes/routes.ts` exports `routes = manifest(recipes, {...})`. Loaders and actions call the api through a `@keel/services` client (`service({ contract: kitchen })`, no origin), never a view store. Links come from `recipes.href`. Every value is formatted with the route's `props.params.locale`: `formatMoney(price, locale)`, `formatDate(addedOn, locale, 'long')`, `formatDuration(durationOf(minutes * 60000), locale, 'short')`, `formatMessage(message, params, locale)`. No literal copy in components or `routes.ts` (E2406).
- Layout `recipes.shell` (`BoxShell`, loader returns `{ text }`): root Box `recipes.shell` with `lang` the locale, a `main`, Link `recipes.home` to the index, Link `recipes.newLink` to `recipes.new`, and the locale switcher: Links `recipes.locale.<tag>` for each served locale to that locale's index, text `localeName(tag)`, `lang` the tag.
- `recipes.index` `/:locale`, search `RecipeSearch`, title `indexTitle`: Heading `recipes.list.title`; Text `recipes.count` (plural of the recipes shown); every recipe (or only favorites) as Link `recipes.link.<id>` (text: title), Text `recipes.price.<id>`, `recipes.minutes.<id>`, `recipes.added.<id>`; filter Links `recipes.filter.all`, `recipes.filter.favorites`; Text `recipes.empty` when none.
- `recipes.show` `/:locale/recipes/:recipeId`, title `showTitle` (`{ title }`): Text `recipes.title`, `recipes.price`, `recipes.addedOn` (`addedOn` message with the long date), `recipes.favorite` (`favorite` or `notFavorite`), and a Form posting to this route's POST action, whose submit Button `recipes.toggleFavorite` toggles through the api and revalidates (`ok(null)`). Unknown id: the loader returns `err` `keel.notFound` with the entry's message; errorElement `RecipeError` shows it as Heading `recipes.error`.
- `recipes.new` `/:locale/recipes/new`, title `newTitle`, guard `cook` (`cook.guard.ts`): denies when `ctx.storage` key `recipes.guest` is `"1"`, redirecting to `recipes.index` in the same locale. A Form with `form(RecipeDraft, { id: 'recipes.draft', issueText })`: Input `title`, Input `minutes`, number Input `price.amount` (minor units), Select `price.currency`, submit Button `recipes.save`; labels from the entry. Success navigates to `recipes.index` in the locale; the api's 422 `keel.fields` passes on to the Form with `title` replaced by the entry's `titleTaken`.
- URLs: `en-US` has no prefix (`/`, `/recipes/new`, `/recipes/<id>`); `/de-DE/...` and `/ja-JP/...` carry it; `/en-US/...` answers 308 to the unprefixed URL.
- UI: `@keel/ui` base elements, style props from `tokens.ts` tokens (fg/bg/accent/danger, light and dark), a11y-required props.

## Copy (U+00A0 is written `␣`)
| Element | en-US | de-DE | ja-JP |
| --- | --- | --- | --- |
| title, index | `Recipes · Keel` | `Rezepte · Keel` | `レシピ · Keel` |
| title, a recipe | `<title> · Recipes` | `<title> · Rezepte` | `<title> · レシピ` |
| title, new recipe | `New recipe · Keel` | `Neues Rezept · Keel` | `新しいレシピ · Keel` |
| `recipes.home`, `recipes.list.title` | `Recipes` | `Rezepte` | `レシピ` |
| `recipes.newLink` | `New recipe` | `Neues Rezept` | `新しいレシピ` |
| `recipes.filter.favorites` | `Favorites` | `Favoriten` | `お気に入り` |
| `recipes.count`, 2 and 1 | `2 recipes`, `1 recipe` | `2 Rezepte`, `1 Rezept` | `2 件のレシピ`, `1 件のレシピ` |
| price EUR 1250, JPY 1800 | `€12.50`, `¥1,800` | `12,50␣€`, `1.800␣¥` | `€12.50`, `￥1,800` |
| `recipes.added.<id>` | `November 10, 2026` | `10. November 2026` | `2026年11月10日` |
| minutes 30, 90 | `30 min`, `1 hr, 30 min` | `30 Min.`, `1 Std., 30 Min.` | `30 分`, `1 時間 30 分` |
| `recipes.favorite` | `Favorite` / `Not favorite` | `Favorit` / `Kein Favorit` | `お気に入り` / `お気に入りではありません` |
| `recipes.toggleFavorite` | `Toggle favorite` | `Favorit umschalten` | `お気に入りを切り替え` |
| `recipes.addedOn` | `Added November 10, 2026` | `Hinzugefügt am 10. November 2026` | `2026年11月10日に追加` |
| title error, empty | `1 to 80 characters on one line` | `1 bis 80 Zeichen in einer Zeile` | `1〜80文字で、1行で入力してください` |
| title error, duplicate | `Already in the box` | `Schon in der Sammlung` | `すでに登録されています` |

## Tests (`@keel/testing` only; ids only)
- `test/setup.ts` (vitest `setupFiles`): `await ready()` from `@keel/std-postgres/testing`; each sim ctx gets migrated, empty tables.
- `test/api.test.ts`: `kitchenDb(ctx)` queries on a sim ctx; both entries through `createApp({ topology, routes, ctx, deployable: 'api' }).fetch` (runtime JSON), including 404 and 422, on a sim ctx whose clock was advanced to 2026-11-10.
- `test/routes.test.ts`: `renderRoute` with `params.locale` and a sim ctx whose `net` routes `/api/*` to that app: filtering, toggling favorite, unknown id, guest redirect in the same locale, invalid submit sends nothing and focuses `recipes.draft:title`, duplicate title shows `recipes.draft:title:error`, each in a locale.

## Acceptance (checked by `pass.ts`)
1. `pnpm --filter golden-2 check` and `keel check` in `apps/golden-2` clean.
2. `pnpm test --filter golden-2` green.
3. `database(` in a `modules/kitchen/*.server.ts` file; a `modules/kitchen/migrations/0001-*.sql` file; `@keel/testing` in tests.
4. `unsafe(` count 0; no `any`, casts, `!`, `@ts-ignore`.
5. Ledger scope `golden-2:`: every item at rung example or better; `pnpm ledger --diff --scope golden-2:` clean. Verify with `node packages/cli/src/bin.ts ledger --scope golden-2:`: no item may be at rung `none`. Every export under `modules/` (schemas, message files, pages, the guard, loaders, actions, the contracts and the client) is used in a test body; a page or error component reached only through `renderRoute` is not evidence, so `render` it (or call the loader or schema) in a test too.
6. A hidden suite passes against your `topology`, both `routes` and the ids above. With the api's clock at 2026-11-10T09:30:00.000Z, "Pasta bake" (30 min, EUR 1250, favorite) and "Miso soup" (90 min, JPY 1800) posted, it renders `recipes.index`, `recipes.show` and `recipes.new` in each locale and checks the Copy table, `document.title` and `document.documentElement.lang`; a client navigation and the switcher; `recipes.href` without the `en-US` prefix; 20 generated prices against `formatMoney`; the guest redirect keeping the locale; and the `recipes` module served by a `node` test topology: the documents for `/`, `/de-DE` and `/ja-JP/recipes/<id>` (copy, `<title>`, `<html lang>`, the shell's `lang`, the switcher's `href` and `lang`), 308 from `/en-US` and `/en-US/recipes/<id>`, 404 for `/fr-FR`, and the `#k-state` of `/de-DE/recipes/<id>` holding the de-DE toggle text and no other locale's.
