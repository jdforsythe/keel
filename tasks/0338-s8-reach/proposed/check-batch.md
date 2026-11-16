# check lane: 0623, 0624, 0650

## 0623 (b): E1551 scope needs a spec sentence

Today: k.server Rules "E1551 `loader`/`action` outside `*.server.ts`" and k.persist Rules "E1551 (k.server) also covers `commitStores` outside `*.server.ts`" name no scope. `loaderInServerFile` reads every `isAppPath` file (tests, tool configs, `unsafe/`, `.keel/`, `node_modules/` excluded), and a root check sees `packages/std-workflows/src/internal/*Job.ts` and std-channels' sources as app files. The rules that exempt kernel and stdlib code (E1207, E1576, E1822) each say so in their spec text, so this one needs the sentence too. Reproduced: `packages/check/test/loaderInPackage.test.ts` (`test.fails`).

Spec change (k.server is at 1,500 tokens, so the sentence goes in k.persist, which already extends E1551). k.persist **Rules**, replace
"E1551 (k.server) also covers `commitStores` outside `*.server.ts`."
with
"E1551 (k.server) also covers `commitStores` outside `*.server.ts`, and reads app files only: no test, tool config (`*.config.*`), or file under `unsafe/`, `.keel/`, `node_modules/` or the root's `packages/` (kernel and stdlib code)."
k.persist **Conformance**, add
"- A `commitStores` call and a `loader` call in `packages/p/src/run.ts` are no E1551; the same file at `modules/a/run.ts` is two."
k.persist after the change: 1,309 tokens (now 1,235).

Conformance wanted (`packages/check/conformance/E1551-scope.test.ts`, in-memory `check(files, { types: false })`): the case above; `node_modules/x/run.ts` and `.keel/run.ts` none; `modules/a/run.server.ts` none.

Code outline: `loaderInServerFile.ts` also returns `[]` for `/^(?:packages|node_modules|\.keel)\//` (the `LIBRARY` form `noInternalEntry` uses); un-skip the reproducing test.

Recommendation: take it. Kernel and stdlib runners cannot sit in `*.server.ts` app files, and the other rules that exempt them say so in the spec the same way.

## 0624 (a): fixed in code

k.compat says E1563's fix is "as E1562": make the one refused required field optional. The fix was built only for a field at the top of the state schema; `loosen` stopped at `[]` (array items), `*` (record values) and nullable unions. Golden's `Board.lists` is `TodoList[]`, so making `TodoList.hidden` required gave no fix. `loosen` now steps through all three. No spec change.

## 0650 (a): fixed in code

k.topology E1552 covers a `topology.ts` that is not statically readable. `keel check` (cli) reports it, since it passes the static read as `topology`. In-memory `check(files)` without `topology` ran `topologyDiags` only for a caller topology, so a root `topology(t)` had no finding. It now runs on the caller's topology, else the static read, as E1572/E1573 already did. E2202 and the std-jobs rule stay silent on an unreadable topology: E1552 is the finding, and its message names the form to write. Reading `const t` would be a second way to declare one.

Left: a `topology.ts` in a subfolder that does not parse is not a project root (`projectDirs`), so a workspace check folds that folder into the root project and gives no E1552 for it.

## Rule `project` from `opts.project` (a): fixed in code

k.check says a rule receives "every code file of its file's project and that project's `topology.ts`". `check()` built that array from the checked files only, adding just `topology.ts` from `opts.project`. It is now every code file of the project in `files` and `opts.project`, with the checked file's text taking precedence. `packages/std-workflows/test/edges.test.ts` "E2352 fires when the chart file is in the project but not among the checked files" now passes, so its `test.fails` mark can be removed.
