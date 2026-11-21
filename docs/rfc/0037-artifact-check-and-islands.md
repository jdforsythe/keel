# RFC 0037: `keel check` reads `.keel/` artifacts; documents load runtime JS only for islands

Status: implemented (ADR-0026)

## Problem
RFC 0033 left k.compiler at 13/14 and k.runtime at 9/10 (backlog 0105, 0106).
- k.compiler: "Changing any byte of a file under `.keel/` makes `keel check` report E1005 on that file." The k.check pipeline reports E1005 for a `.keel/*.json` it is given (`generatedEdits`). But cli `checkCommand` passed only code files (`CODE_FILE`) to `check()`. The host had already loaded `.keel/*.json` (`readProject` query scope), so a tampered `ids.json` gave `ok check N files`.
- k.runtime: "A page with no islands loads no runtime JS." had no test, and nothing built island pages. The compiler marked no islands. The server put `data-k-island` on every route level that returned an element, and no document had a module script. Compiled components could not render on the server at all: `text`, `on` and the other ops throw outside a mount or resume render.

## Proposal
1. **cli.** `keel check [paths]` checks the code files and the `.keel/*.json` artifacts under `paths` (`codeFiles(io, paths, true)`). `keel check src` does not read `.keel/`.
2. **compiler (island marking).** One static, best-effort definition, by name within a file like `deps.json`. An element is *bound* when it has an `on` binding, or a binding whose expression reads a `signal`/`computed`/`resource` declared in the file or calls `.get`/`.select` (a store or signal read). Each root element of a component that calls `effect` is also bound. The compiler writes `data-k="<elementId>"` into the template of every bound element. A binding that reads only props or loader data is not bound.
3. **server.**
   - A route level is an island when the element it returns has a `data-k` element outside nested levels' islands (`islandIn`). Only island levels get `data-k-island="<routeId>"` and an `islands` entry.
   - The document carries `<script type="module" src="/@keel/entry.ts">` only when an island was rendered.
   - Each route component runs as a render unit, inside a `mount` on a detached host (`renderUnit`), so compiled ops work on the server. The mount's scope is a child of the request scope, so request stores survive until `#k-state` and are disposed with the request.
   - Child levels render before their layout, so units never nest. A throw from a component or a binding is rethrown as `keel.unexpected`, which keeps the errorElement and 500 behavior unchanged.

## Alternatives
- A runtime `island()` op the compiler calls: needs a runtime-dom change, and a page would know it is an island only after it runs.
- A static property on the compiled function: does not propagate through child components, which `data-k` in the DOM does.
- Reading `deps.json` in the server: artifacts exist only in dev.
- Counting every binding: loader-data pages would ship JS.

## Spec diff
- k.runtime: the Islands paragraph defines bound elements and the compiler-written `data-k`, makes route levels the k.server island roots, and adds the entry-script bullet. The clause "A page with no islands loads no runtime JS" is extended: its document has no `<script type="module">`, `data-k` or `data-k-island`; a page with an event handler has all three, and `resume` attaches it.
- k.server: a one-sentence **Document** paragraph citing k.runtime.
- k.cli: the `check` row names the artifacts.
- Status lines: k.compiler and k.runtime are now `conformance-covered`.

## Conformance diff
Added:
- `packages/cli/conformance/artifact-tamper-e1005.test.ts` (k.compiler#7). It runs the real `bin.ts` over a temp project whose `.keel/` the Vite plugin built: clean, then `ids.json` tampered, then a property over file, byte and replacement (seed 1337), then `paths` restriction.
- `packages/server/conformance/document-islands.test.ts` (k.runtime#4, D2). It renders compiled TSX through `createApp` and covers four cases: static and layout pages carry no markers or script; a counter page carries all three; a static layout around an island child marks only the child; `resume` keeps node identity and a click updates the server span. It ends with a property over generated trees (seed 1337).

None removed.

## Migration
Hand-built route components that return elements are no longer islands unless they carry `data-k`. Templates of bound elements gain one attribute.

## Token impact
k.server +40 tokens (under 1,500 after moving the definition to k.runtime). k.runtime +130.
