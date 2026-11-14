# kernel lane: record (orchestrator applies what follows before the root gates)

Commits: K1 f15d9bf, sourcesOf b404246, K2 97e9fef, K3 1aa8804, node entry fc65430, K4 48c8e6a + 6026a46 (`storeShapes`, `surface.json` `stores`, E1563/W1564), shell entry 19c72d3.
Types: `StorageWrite { key; expect: string|null; value?: string|undefined }`; `read(keys) -> (string|null)[]` (one value per position asked, a repeated key included); `commit(writes) -> boolean`, a repeated key rejects E1606; `Drivers { storage?, net? }`; any `drivers` on a sim ctx throws E1605; `commitStores<S,T,E>(ctx, factory, fn): Promise<Result<T, E|SaveConflict>>` (at most 3 runs); topology `storage?`, `shells?`; the entry opens the driver as `open: (url) => Promise<KeyValueStorage & { close?() }>`; shell build with `KEEL_SHELL` writes `dist/<name>/<shell>/www/` and calls `createCtx({ mode: "shell", drivers })`.
Decisions (confirm or reverse): `inOrder` removed; the E1572 fix uses the version spec of the app's first `@keel/` dependency, else `"*"`; W1564 points at the surface file; `restore` folds a log it cannot replay.

## To fix (rfc:0085 conformance edits)
- Fixture storages with only `get`/`set` need `read` and `commit`: std-sessions (7 failing tests in `monitor-abort`, `monitor-once`, `monitor-count`; 31 type errors incl. `e2009`, `monitor-command`), std-channels (`test/channelRouteRecheck.test.ts`, 3 failing), std-offline (`test/lifetime.test.ts:106`).
- `packages/compiler/conformance/shell-entry.test.ts`: `SHELL_CTX` must accept a backtick: the minifier writes mode:`shell`. Stays skipped (needs a native build) unless the regex fix lets its non-native part run.
- Root `keel check` flags the 5 `commitStores` calls in std-workflows the way it flags std-channels' loaders: look before the root gates.

## Over budget (measured)
check 50,784 of 49,408; compiler 31,347 of 31,232; server 20,515 of 20,480; cli 25,405 of 24,832; scaffold 18,914 of 17,152; ctx 3,575 of 3,584; store/internal 1,661 of 1,792.
Ride-alongs 0304 and 0313 not taken (0313 would put a `@keel/server` import into generated code client-only apps may not resolve).
