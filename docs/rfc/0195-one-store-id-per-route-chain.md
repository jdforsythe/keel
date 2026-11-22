# RFC 0195: k.server: two factories of one route chain that create one store id are E1550

Status: implemented (ADR-0217). Amends k.server (Server state, Rules, Conformance). From `apps/household` (walkthrough finding L9-1).

## Problem
The household's setup page named `setupStores = (ctx) => ({ ...householdStores(), ...restockStores(ctx) })` to read the household's name and the weekly runs in one loader. Its frame layout `app.frame` names `householdStores`. `tsc`, Biome and `keel check` passed; every GET of `/setup` answered 500, and the dev log read `keel.unexpected loader setup.form threw: Error: store setup.household: id already in use by a live store`. Under `renderRoute` the page rendered nothing and the test failed with E1705.

The run time does what the spec says. k.store Registries: "a duplicate live id throws only within one registry (the server isolates each request scope)". k.server Server state: "Per request each named factory runs once". The factory is what a request shares: two loaders naming `householdStores` get one instance; `setupStores` is a second factory whose body creates `setup.household` again, a second live store for one id in one request, and `openHeld` (`packages/store/src/internal/openHeld.ts:39`) refuses it so no save drops a change made through the other instance. What the spec lacks is a rule that says so before a request: the error is an author's, and only a request finds it. `packages/server/test/layoutPageStoreId.test.ts` reproduces it with one layout and one page.

## Proposal
### What the author writes
Unchanged. Loaders of one route chain that read one store name one factory; a loader that needs more than that factory's stores reads the rest another way (its module's API in process, as the household does). Two factories that create one id are now E1550 at `keel check`, at the deeper loader:
```
E1550 modules/setup/setup.server.ts:12:40 stores: setupStores and householdStores (app.frame) both create store setup.household; name one factory
```

### k.server, Server state
After "`fn` gets `S`.": "A request holds one live store per id (k.store Registries), so the loaders of one route chain share a store by naming one factory; two factories they name that create one id are E1550."

### k.server, Rules
"E1550 two `stores` factories the loaders of one route chain (its layouts' and its page's) name create one store id: `keel check` at the deeper loader's `stores` value, naming both factories, the id and the other route id, reading a factory as E1558 reads a loader `fn` (a top-level function or `const`, or an import of one; its ids the literal `id` of each `store` call in its body and in each factory it calls); one it cannot read is not judged there; `keel build` and `createApp` run each factory once on a sim ctx (k.compat Surface) and refuse it (`createApp` throws)."

The check stays static (k.check Pipeline): what it cannot read, the build's evaluation and `createApp` catch, so the error reaches the author before a request in every path.

### What does not change
`openHeld`'s throw stays the run-time backstop (a factory whose ids depend on `ctx`). Actions: a request's action opens one factory and the loaders that render after it open on a fresh read, so an action and a loader of one chain naming different factories over one id is not E1550. Live loaders open in their own scope and are not judged.

## Alternatives
- **Share by id: the second factory gets the request's existing store.** Rejected: the factory's body calls `store()` and declares its transactions on what it gets back. Handing it the live store would make `store()` return an existing instance (k.store: a duplicate live id throws) and declare transaction names a second time on one store (unique per store). It is a second way to share a store beside naming one factory.
- **Two instances, one per factory, read at one cut.** Rejected: a request would hold two live stores for one id, k.store's registry rule would no longer hold for the request, and a save would have to choose between two snapshots of one key.
- **A loader names several factories (`stores: [a, b]`).** Not proposed: it changes what an author writes, and the household's in-process API read covers its page. A later RFC can add it if an app needs it.
- **Document it only.** Rejected: the failure is a 500 on every request of the page, and `keel check` passes the app.

## Spec diff
Applied in this commit: k.server Server state, Rules and Conformance as above. Conformance gains: "A layout whose loader names factory `a` and a page under it whose loader names `b`, where `b` spreads `a()` and both create store id `x.s`, is one E1550 in `keel check` at the page loader's `stores` value naming `a`, `b`, `x.s` and the layout's id, and `createApp` throws E1550; with both loaders naming `a`, neither, and a GET of the page answers 200 with `a` run once." Ledger: the new k.server clause at `none`; k.server's status is `implemented` until that clause's conformance and build land, when it returns to `conformance-covered`.

## Conformance diff
One clause above, by the `conformance-writer` from k.server: a `keel check` fixture (packages/check) and a `createApp` one (packages/server).

## Migration
None.

## Token impact
k.server grows by about 170 tokens, within the section budget.

## Build order
1. Conformance (`conformance-writer`). 2. `@keel/check`: the E1550 rule over each deployable's route table, with its explanation. 3. `@keel/server`: `createApp` runs each chain's factories once on a detached sim ctx and throws E1550. 4. `keel build`: the surface run reports E1550. 5. The keel-server skill names E1550.
