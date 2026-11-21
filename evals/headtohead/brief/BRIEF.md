# Recipe box

Build a web app called Recipe box, in English (United States), German (Germany) and Japanese. Recipes are kept on the server and shared by every visitor. Use whatever stack you judge best. When you finish, the app must build with one command, start for production with one command, read its port from the `PORT` environment variable, and serve every page below from that one origin. Make it secure and accessible to people who use a keyboard or a screen reader. Do not build sign-in.

An automated check will open the running app in a browser and operate it, so every element named below must carry the stated `id` attribute exactly (ids contain dots and colons) and must show exactly the stated text. Anything else about the layout, style and code is yours.

## Recipes

A recipe has a title (1 to 80 characters, one line), a duration in minutes (a whole number, 1 to 600), a price (an amount in minor units, a whole number of at least 0, and a currency, one of EUR, GBP, JPY, USD), a favorite flag (false at first) and the date it was added (the server's current date in UTC). The server mints each recipe's id. Titles are unique ignoring case. The box starts empty and keeps its recipes while the server runs.

## Locales and URLs

English pages have no prefix: `/`, `/recipes/new`, `/recipes/<id>`, `/catalog`. German pages start with `/de-DE`, Japanese pages with `/ja-JP` (`/de-DE`, `/de-DE/recipes/new`, `/ja-JP/recipes/<id>`). `/en-US/...` redirects to the same page without the prefix. Any other first segment that names a locale, such as `/fr-FR`, shows a not-found page that lists no recipes (a 404 status is welcome). Every page sets `<html lang>` to its locale tag (`en-US`, `de-DE`, `ja-JP`) and has a `<title>` as in the copy table.

Every page has this shell: an element `recipes.shell`, a `main` landmark `recipes.main`, a link `recipes.home` to the recipe list and a link `recipes.newLink` to the new-recipe page, a link `recipes.catalogLink` to the catalog, and a language switcher: links `recipes.locale.en-US`, `recipes.locale.de-DE`, `recipes.locale.ja-JP`, each to the same kind of page's list in that locale (`/`, `/de-DE`, `/ja-JP`), each with its `lang` attribute set to its tag, each showing its own language's name. Links keep the visitor's current locale. Moving between pages with a link must not reload the whole document when the stack makes that easy, but a reload of any URL must show the same page.

## Pages

**List** (`/`, `/de-DE`, `/ja-JP`). Heading `recipes.list.title`. Text `recipes.count` (plural: "2 recipes", "1 recipe"). Each recipe is a list item `recipes.item.<id>` holding a link `recipes.link.<id>` (the title) to its page, text `recipes.price.<id>`, `recipes.minutes.<id>` and `recipes.added.<id>`. Filter links `recipes.filter.all` and `recipes.filter.favorites`; the favorites link shows only favorite recipes (query `?only=favorites`). Text `recipes.empty` when none are shown.

**Recipe** (`/recipes/<id>`). Text `recipes.title`, `recipes.price`, `recipes.minutes`, `recipes.addedOn`, `recipes.favorite`, and a button `recipes.toggleFavorite` that flips the favorite flag, updates the page and persists on the server. An unknown id shows an element `recipes.error` (heading) and none of the recipe's elements.

**New recipe** (`/recipes/new`). A form: text input `recipes.draft:title`, input `recipes.draft:minutes`, number input `recipes.draft:price.amount`, select `recipes.draft:price.currency` with the four currencies, submit button `recipes.save`. Next to each field an element `recipes.draft:<field>:error` (`title`, `minutes`, `price.amount`, `price.currency`) that is empty until the field has an error. Every field has a visible label. An invalid submit sends nothing to the server, focuses the first invalid field and fills its error element. A title already in the box (ignoring case) shows `Already in the box` (see the table) in the title's error element. Success goes to the list in the visitor's locale and the new recipe is on it.

**Catalog** (`/catalog`, English only). A table of every recipe: heading `recipes.catalog.title`; table `recipes.table.table`; row `recipes.table.row.<id>`; the title in cell `recipes.table.cell.<id>.title`; text `recipes.table.price.<id>`, `recipes.table.minutes.<id>`, `recipes.table.added.<id>`, `recipes.table.favorite.<id>` (`Yes` or `No`). Five rows a page, in the order chosen. Sort links in the header: `recipes.table.sort.title`, `.price`, `.minutes`, `.addedOn`; the first click on a column sorts ascending, the next descending (price sorts by the amount; ties by title, ascending). Search box `recipes.search.input` filters by title (case-insensitive substring). Links `recipes.catalog.all` and `recipes.catalog.favorites` filter to favorites. A status text `recipes.table.status` reads `Page <n> of <m>` (at least `Page 1 of 1`), and links `recipes.table.previous` and `recipes.table.next` appear when there is a previous or next page. The state lives in the URL, so a reload or a shared link shows the same rows: `sort` (`title`, `price`, `minutes`, `addedOn`), `dir` (`asc`, `desc`), `page`, `q`, `favorite=true`. Each row has a checkbox `recipes.table.select.<id>`; a button `recipes.addSelected` adds the checked recipes to a shopping list that lasts for the browser tab. Two tabs, `recipes.views.tab.recipes` and `recipes.views.tab.list`; the list tab shows `recipes.shopping.items` (one list item per recipe, its title as text) or `recipes.shopping.empty` when empty, and a button `recipes.clear.trigger` that opens a modal dialog `recipes.clear.dialog` asking whether to clear, with buttons `recipes.clear.cancel` (keeps the list) and `recipes.clear.confirm` (empties it). The dialog traps focus and Escape closes it.

## Copy

Prices: amount 1250 EUR and 1800 JPY. A space may be a no-break space.

| Element | en-US | de-DE | ja-JP |
| --- | --- | --- | --- |
| title, list | `Recipes · Keel` | `Rezepte · Keel` | `レシピ · Keel` |
| title, recipe page | `<title> · Recipes` | `<title> · Rezepte` | `<title> · レシピ` |
| title, new recipe | `New recipe · Keel` | `Neues Rezept · Keel` | `新しいレシピ · Keel` |
| title, catalog (English only) | `Catalog · Keel` | | |
| `recipes.home`, `recipes.list.title` | `Recipes` | `Rezepte` | `レシピ` |
| `recipes.newLink` | `New recipe` | `Neues Rezept` | `新しいレシピ` |
| `recipes.filter.favorites` | `Favorites` | `Favoriten` | `お気に入り` |
| `recipes.count`, 2 and 1 | `2 recipes`, `1 recipe` | `2 Rezepte`, `1 Rezept` | `2 件のレシピ`, `1 件のレシピ` |
| price EUR 1250, JPY 1800 | `€12.50`, `¥1,800` | `12,50 €`, `1.800 ¥` | `€12.50`, `￥1,800` |
| added | `November 10, 2026` | `10. November 2026` | `2026年11月10日` |
| minutes 30, 90 | `30 min`, `1 hr, 30 min` | `30 Min.`, `1 Std., 30 Min.` | `30 分`, `1 時間 30 分` |
| `recipes.favorite` | `Favorite` / `Not favorite` | `Favorit` / `Kein Favorit` | `お気に入り` / `お気に入りではありません` |
| `recipes.toggleFavorite` | `Toggle favorite` | `Favorit umschalten` | `お気に入りを切り替え` |
| `recipes.addedOn` | `Added November 10, 2026` | `Hinzugefügt am 10. November 2026` | `2026年11月10日に追加` |
| title error, empty or too long | `1 to 80 characters on one line` | `1 bis 80 Zeichen in einer Zeile` | `1〜80文字で、1行で入力してください` |
| title error, duplicate | `Already in the box` | `Schon in der Sammlung` | `すでに登録されています` |

The date in the table is an example; show the recipe's own added date in the locale's long form. The new-recipe form is checked in English and German.

## Done

When the app builds, starts and you have run it yourself in a browser, stop and say `done`. If something in this brief cannot be done, say `blocked: <what>`.
