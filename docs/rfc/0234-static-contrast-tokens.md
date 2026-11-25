# RFC 0234: k.a11y-static: `keel check` judges contrast from the project's `tokens.ts`

Status: accepted (ADR-0256), accepted by the orchestrator on 2026-11-25, to be confirmed by the operator. Adds k.a11y-static (Static contrast); one pointer sentence in k.a11y Contrast; one map row. From the task 0963 lane that found static E1804 silent.

## Decisions
- D1: every command that runs the k.check pipeline over a project gives `check()` the `tokens` export of the project's `tokens.ts`, the source `keel test` gives a render. It is evaluated on every run (bundled with what it imports, then imported once), never cached.
- D2: the message is `fg "<fg>" on bg "<bg>" is <ratio>:1 in <scheme>, needs <need>:1`, a set's prefixed `<set>: `, at most 89 UTF-16 code units.
- D3: a `tokens.ts` that throws, exports no `tokens` or fails `TokenSchema` is E1807 at `tokens.ts` 1:1 from `keel check`, the code a render throws. No `tokens.ts`: nothing to judge, and no other rule makes a token-using project an error; its 1.4.3 items stay `none` because no render runs E1804 either.
- D4: `fg`, `bg`, `fontSize` and `weight` resolve as at render: own literal, literal look, role set, then the parent, through base elements, `Part` and the markup-free intrinsics. A value check cannot read (an expression, a responsive object, a computed look, a spread) is unread; an element with an unread or unfound `fg` or `bg` is not judged statically and is judged at render. The claim rule already needs that render for every 1.4.3 item.
- D5: E1802, E1804, E1807 and E1820 are errors, so `keel build` refuses them (k.boundary Build gate).

## Problem
k.a11y says contrast is judged statically and the ledger's 1.4.3 items count static E1804 from `keel check`. `runCheck` (`packages/cli/src/internal/runCheck.ts`) passed `check()` no `artifacts.tokens`, and `lowContrast` returns nothing without them, so no `keel` command ever reported a static E1804, E1809 or token-set E1801. `a11yFindings`, which the ledger and evidence use, passed none either. The rule itself judged only an element's own `fg`: `<Box fg="divider" bg="card"><Text>x</Text></Box>` failed at render (the `Text` inherits `color`) and was judged at the `Box`, which holds no text; a `fg` set two levels up was not judged at all; `fontSize` and `weight` set on an ancestor were not read. An element that wrote `fg` and held no text was judged, which the render check never does.

## Proposal
### Tokens
`projectTokens(root)` (`@keel/compiler/hosting/projectTokens`) bundles an entry that imports `tokens.ts` and `TokenSchema` from the project's `@keel/ui` with esbuild (the settings `evaluateProject` uses), imports the bundle from a temporary file, and returns the parsed `tokens` or the E1807 reason in the words the render harness uses. About 25 ms per project; a fresh bundle each run means a long-lived `keel mcp` or `keel lsp` sees the change to `tokens.ts` or any file it imports. The cli's `checkTokens(cwd, project)` calls it for each project directory holding `tokens.ts` and gives `check()` the result as `projectArtifacts`, keyed by project directory. `runCheck` (`keel check`, `keel build`, `keel evidence`, MCP, `keel lsp`) and `a11yFindings` (`keel ledger`, `keel evidence`) both call it. `keel test` and `keel dev` run no check; `keel review` reads no diagnostics.

### The rule
The static rule follows `contrastViolations` (render): a judged element is one holding text; each of the four values comes from the element, its literal look, its role, then its parent. The chain ends at the component's edge and below an app component, whose markup is in another file. There `bg` is not found (k.a11y: "with neither, render checks it") and the other three are `base.page`'s, as k.a11y's "text without a `fontSize` token is normal size" already says. An unread `fontSize` or `weight` judges at 3:1, which holds at any size; an unread `fg` or `bg` is not judged. Exempt as at render: `hidden`, a literal `disabled`, `aria-disabled="true"`.

### Why not an error for an unread value
RFC 0231 made what check cannot read an error where a claim rests on check alone. A 1.4.3 item rests on the render: `example` needs E1804 in a passing `renderRoute` run's `rules`, and that run judges every element holding text in the chain. A computed `fg` is ordinary app code (a tone by status); an error would push apps to literal-only colors for no gain the render does not already give.

## Alternatives
- **Read `tokens.ts` statically (parse the object literal).** Every app spreads `brandTokens`; a parser that follows imports is a second evaluator. Rejected: one source, one way.
- **Node's `import()` of `tokens.ts`.** Cached by URL for the life of the process, so `keel lsp` and `keel mcp` would judge stale tokens (k.check-cache: an earlier call never changes a later answer).
- **Judge an unread value against every token.** Reports pairs the app never renders.
- **Treat every JSX parent as transparent.** An app component's markup may set `bg`; judging through it reports what render does not.

## Spec diff
Applied in this commit: k.a11y-static (new, `implemented`), the pointer sentence in k.a11y Contrast (no clause reworded), the map row. k.a11y-static's bullets are new clauses; the k.a11y conformance clauses are unchanged.

## Conformance diff
By the `conformance-writer`, from k.a11y-static: `packages/cli/conformance/a11y-static-tokens-cli.test.ts` (tokens.ts cases, the cache case, the build cases, the paths case) and `packages/check/conformance/a11y-static-values.test.ts` (the Box-to-Text shape, unread values, sizes, the message at its bound). The existing `a11y-static-contrast-cli.test.ts` passes unchanged.

## Migration
None. Unreleased.

## Token impact
Spec: k.a11y-static about 1,400 tokens; k.a11y +12; the map +13 (within 1,570). Runtime: `keel check` about 25 ms per project with `tokens.ts`.

## For the operator
1. **Unread values are judged at render, not refused.** Recommended: the claim needs the render anyway.
2. **No error for a project with style tokens and no `tokens.ts`,** and none for a literal style token that `tokens.ts` lacks (k.ui E1801 at an element is reported by no `keel check` today; `keel build` warns). Recommended as a follow-up backlog line, not this RFC.
3. **Below an app component, `bg` is not found.** Recommended: its markup is another file's.
