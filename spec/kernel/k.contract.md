# k.contract: Module contract
status: conformance-covered

**Contract.** Each route a module serves is declared once in `modules/<id>/<id>.contract.ts` (a stdlib package's: its `./contract` export), whose one export `<id>` is `contract('<id>', entries)` from `@keel/router/contract`, an entry that imports `@keel/schema` only:
```ts
export const kitchen = contract('kitchen', {
  'kitchen.shell': { layout: true },
  'kitchen.home': { path: '/kitchen', search: HomeSearch },
  'kitchen.box': { method: 'GET', path: '/api/recipes', output: Box },
  'kitchen.add': { method: 'POST', path: '/api/recipes', body: RecipeDraft, output: Nothing },
})
```
It is client-safe (E1514); keys are route ids prefixed by the module id (E1155). An entry is one kind, told apart by required members:

| Kind | Requires | Optional |
| --- | --- | --- |
| page | `path` | `params`, `search` |
| layout | `layout: true` | |
| API | `method`, `path`, `output` | `params`, `query`, `body`, `errors`, `timeout`, `events` |

A kind refuses members outside its row. `method` is `GET`, `POST`, `PUT`, `PATCH` or `DELETE`; an API id is `<module>.<name>`, `name` one lowerCamel segment.

**Static reading.** Keys are literal; the entries and each entry are object literals in the call, `method`, `path`, `layout` and `events` literals, `params`, `search` and `query` schemas read through consts and imports, other members any expression. A spread, call or name there (a const object's too) is W1005 and E1111 at it; the entries beside it are read.

**Binding.** `routes.ts` exports `routes = manifest(contract, binding)`, binding every entry and nothing else: a page `{ component, loader?, guard?, layout?, errorElement?, title?, POST?, PUT?, PATCH?, DELETE? }` (verbs: page actions); a layout `{ component, loader?, guard?, layout?, errorElement? }`; an API GET `{ loader, guard? }`; an API write `{ action, guard? }`. `layout` names a layout of any module (k.routes); page and layout guards have a `redirect` (k.guards).

**Handlers.** A handler names its entry; `fn` is never annotated:
- `loader(contract, id, decl, fn)`: `fn` gets `{ params, search, url, caller, user, bearer, stores, signal }` and `ctx` (k.server). `params` is `Infer` of the entry's `params` (`{}` without), `search` of a page's `search` or an API entry's `query`; a layout's `params` are the matched route's, `unknown`. On an API GET `decl` is `{ stores? }` and `fn` returns `Result` of `output`, as an async generator when `events: true` (live, k.server), and only then: no page or layout loader is live. On a page or layout `decl` is `{ output, stores? }`.
- `action(contract, id, decl, fn)`: on an API write `decl` is `{ stores? }` and `fn` gets the decoded `body` (`{}` without one), `{ params, url, caller, user, bearer, stores }` and `ctx` and returns `Result` of `output` (k.api Output). On a page `decl` is `{ input, stores? }` and `fn` returns `Result<Href | null>` (k.router Form); its verb is its binding key.

**Derived.** `<contract>.href(id, params?, search?)` links to a page of it (k.router Links). `service({ contract, timeout? })` (k.services) has a method per API entry. `routes.json` and `surface.json` (k.compat) derive from both. Every entry is public to a module whose `deps` name this one; importing the contract needs `deps` only (E1152), never `public.exports`.

**Rules.** E1510 an entry of no kind or with a member its kind refuses, or a binding member its entry refuses; a type error, thrown by `contract` or `manifest`; fix removes the member, none for an entry missing one · E1513 a `contract()` call outside `modules/<id>/<id>.contract.ts` or a package's `./contract`, a second one, an `id` not the folder's module id, an export not named `<id>`, a `routes.ts` binding another module's contract, `contract` reached but by a direct call of its import (an alias, a re-export), or an API id with a dotted name; `contract` throws the last alone; no fix, the message names the expected path · E1514 a contract file importing anything but a `*.schema.ts` file or a package, at the import; no fix · E1515 a binding missing an entry or an entry's required member, with a key the contract lacks, with a handler declared for another id or contract, with a plain loader on an `events: true` entry, or with an async generator loader on any other; a type error, `manifest` throws it naming the id; fix removes an extra key. E1502, E1503, E1504 (k.router) and E1653 (k.services) read the contract. Where each code fires: k.routes.

**Conformance.**
- `contract('a', { 'a.home': { path: '/' } })` has `kind` `keel.contract` and `module` `a`; a key `b.home` does not compile; an API id `a.x.y` throws E1513.
- An entry with `method` and `search`, with `layout: true` and `path`, or a page with `output` does not compile, and `contract` throws E1510.
- `manifest(c, binding)` missing an entry of `c`, or with a key `c` lacks, does not compile and throws E1515 naming the id.
- A loader declared for `a.x` bound at `a.y` does not compile and `manifest` throws E1515.
- A page action in its entry returning `ok(c.href('a.home'))` compiles unannotated; its document POST answers 303 to `/`.
- `c.href` of a layout or API id does not compile; of a page with params it requires them.
- `service({ contract: c })` has a method per API entry named by the id after the module, none for a page.
- An `events: true` entry bound to a plain loader throws E1515; an async generator loader declared for a page, or an API GET without `events`, does not compile and `manifest` throws E1515.
- A contract file importing a `.tsx` component, a `*.server.ts` file or `routes.ts` is one E1514; importing `*.schema.ts` files and `@keel/std-*` packages is none.
- `contract` in `modules/a/routes.ts`, or `contract('b', ...)` in `modules/a/a.contract.ts`, is one E1513 naming `modules/a/a.contract.ts`; called, `contract('b', ...)` throws none.
- Module `b` importing `modules/a/a.contract.ts` without `a` in `deps` is one E1152; with it none, and no E1151.
