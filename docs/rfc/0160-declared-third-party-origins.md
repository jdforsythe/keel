# RFC 0160: k.origins: declared third-party origins

Status: proposed (ADR-0182), for operator decisions D46 and D41: safe by default, opened by config. It reverses k.security's "the policy has no option" and that clause of ADR-0094, so it lands before the freeze flip (W1).

## Decisions
- D1: a deployable of any adapter may set `origins` in `topology.ts`: one object per directive, `img`, `media`, `font`, `connect`, `frame`, each mapping an exact origin to its reason. It is the only input that widens a policy, and the only place: no `createApp` option, no environment variable.
- D2: an exact origin is its own serialization (`originOf(v) === v`, k.hosting's parser): scheme, lowercase host, a port only when not the default; no path, trailing `/`, query, fragment, credentials or `*`. The scheme is `https`, or `http` on `localhost`, the rule `KEEL_ORIGIN` already follows for shells (E1574). A reason is 1 to 200 characters on one line with a visible character. At most 16 origins per directive.
- D3: the declaration reaches every policy Keel emits for that deployable: `node` documents in production and dev, `csp.txt`, a `client` `index.html` served by its `host`, the Tauri `tauri.conf.json` and the Capacitor meta policy. A response that is not a document keeps `default-src 'none'; frame-ancestors 'none'`.
- D4: no declaration emits the bytes emitted today. `origins` absent, `{}` and an empty directive are one declaration: none.
- D5: `img-src`, `font-src`, `connect-src` keep `'self'` first and append; `media-src` and `frame-src`, absent from the fixed policy, are added after `connect-src` with the declared origins alone, so declaring a third-party video opens no same-origin frame.
- D6: scripts, styles and Trusted Types stay absolute. A third-party script is a later decision (below).
- D7: E1570 and E1571 stop reporting a URL whose origin is declared under the matching directive on each deployable that serves the file. Two new codes: E1590 (a malformed declaration) and E1591 (a duplicate).
- D8: `Frame`, a `@keel/ui` base element, so the `frame` directive has a use in app code, where E1805 forbids a lowercase `<iframe>`. Required `title`, a fixed `sandbox`, `referrerpolicy="strict-origin"`.
- D9: `security.json` in `keel evidence` lists every declared origin with its directive and reason.
- D10: one declaration. The static read of `topology.ts` is the only source of origins: a spread, a computed key or a key written twice inside a deployable's declaration (or a deployable written twice) is E1552, since k.topology already makes "not statically readable" E1552 and the problem is the deployable's, not `origins`' (a spread can hide `modules`, `host` or `caller` as well). The generated entries pass the read to `createApp({ origins })`, which replaces every deployable's runtime `origins`, so no policy can hold an origin `security.json`, `csp.txt` and the check rules did not see.
- D11: a `frame` origin that is the app's own is refused where Keel knows the app's origin, since `allow-scripts allow-same-origin` lifts the sandbox of a same-origin page: E1590 at `keel build` against a `KEEL_PEER_<NAME>` or `KEEL_ORIGIN` in the build environment, E1590 from `createApp` against `origin` and each URL peer, and a document leaves its own origin out of `frame-src` (in dev, `http://localhost:<port>`, one E1590 `diag`). `Frame` renders `about:blank` for a `src` of the document's origin.
- D12: a reason's visible character is one outside k.schema's blank set (`isBlank`, `@keel/schema/internal`), and a reason holds no control or format character (`Cc`, `Cf`, U+2028, U+2029). An IPv6 literal origin is E1590: a CSP host-source has no form for it. One directive written twice in `origins` is E1591 at the second; the first is read.
- D13: E1570 reads a backslash as `/`, as browsers do in an http(s) URL, so `/\host/x` and `\\host/x` are absolute; E1805 on `<iframe>` names `Frame`.

## Problem
k.security gives every document one policy: `default-src 'none'`, `'self'` for images, fonts and connections, no `media-src` or `frame-src` (so `default-src 'none'` blocks both), and "the policy has no option, so no app widens it" (ADR-0094 rejected a `createApp({ csp })` option because every option widens it). `packages/server/src/csp/cspPolicy.ts` takes a nonce or a list of `keel-peer` origins and nothing else. E1570 (`packages/check/src/rules/foreignUrlAttr.ts`) reports any absolute URL in `src`, `poster`, `data`, `srcset`, `action`, `formaction`; E1571 (`foreignUrlFetch.ts`) any absolute URL given to `ctx.net.fetch` or `service({ base })` in client-reachable code.

So a Keel app cannot show a photo from an image CDN, use a font file from a font host, send an event to an analytics collector or embed a video player. Each is a normal thing for an app to need, and the only route out today is to proxy every byte through the app's own origin. That costs the app a CDN's caching and resizing, and it hides the third party from the evidence bundle instead of listing it. The security of the fixed policy does not come from refusing these five directives: it comes from the nonce, `'strict-dynamic'`, `style-src 'self'` and Trusted Types, which keep any script but the app's own from running. An image, a font, a fetch or a sandboxed frame from a named origin runs no script in the document.

The five places a policy is emitted today, each the same `cspPolicy` with different inputs:
- `node` documents: `documentResponse.ts`, `cspPolicy({ nonce, dev })`, `Report-Only` in dev.
- A `client` `index.html` a `node` host serves: `handle.ts`, `cspPolicy({ peers })` from the built `keel-peer` tags.
- `csp.txt` for `client` and `static`: `cli/src/internal/cspText.ts`, the same text for every deployable.
- Tauri: `cli/src/internal/shellPolicy.ts`, `cspPolicy({ peers: [] })` once per project, with `ipc:` added; `scaffold/src/deployDrift.ts` compares it.
- Capacitor: `cli/src/shell/metaPolicy.ts` over `csp.txt`, less the directives a meta tag ignores.

`createApp` already receives the parsed topology (`opts.topology[name]`), as it does for `caller`. A page Vite serves in `keel dev` carries no policy.

## Proposal

### The declaration
```ts
// topology.ts
import { topology } from "@keel/server";

export default topology({
  shop: {
    modules: ["catalog", "account"],
    adapter: "node",
    storage: "postgres",
    origins: {
      img: { "https://img.cdn.example": "product photos, resized by the image CDN" },
      font: { "https://fonts.host.example": "Inter, the face app.css names" },
      connect: { "https://collect.analytics.example": "page-view counts, a route id and no personal data" },
      frame: { "https://player.video.example": "product videos on the item page" },
    },
  },
});
```
The `Topology` type (`packages/compiler/src/types/Topology.ts`) gains, per deployable:
```ts
readonly origins?: {
  readonly img?: Readonly<Record<string, string>>;
  readonly media?: Readonly<Record<string, string>>;
  readonly font?: Readonly<Record<string, string>>;
  readonly connect?: Readonly<Record<string, string>>;
  readonly frame?: Readonly<Record<string, string>>;
};
```
An object keyed by origin was chosen over an array of `{ origin, reason }`: the reason cannot be left out, and TypeScript itself refuses the same key twice (TS1117), so E1591 is a type error before it is a Keel one. Key order is declaration order (no origin is an integer-like key), and that order is the order in the policy and the evidence.

### Reading and diagnostics
`topologyReadProblems` (`packages/compiler/src/hosting/`) reads `origins` statically for `keel check`, `keel build` and `keel dev`, beside `callerDays`:
- E1590: `origins` or a directive that is not an object literal, or holds a spread or a computed key; a key outside the five (`script` and `style` included; the message says they are not declarable); an origin that is not exact; a reason not a string literal of 1 to 200 characters on one line with a visible character; a directive with more than 16 origins. Fix: for an origin whose `originOf` serialization is exact (`https://CDN.example/`, `https://cdn.example:443`), the key rewritten to it in the author's quote; for anything else, none (`https://cdn.example/img`, `http://cdn.example`). A path is not cut to its origin by a fix, since that widens what the author wrote.
- E1591: one origin twice in one directive, or one directive twice in `origins`, at the second. Fix: delete the second entry and its comma. The same origin under two directives is two declarations and is fine.
- E1552 (k.topology): a spread, a computed key or a key written twice inside a deployable's declaration, and a deployable name written twice. What it holds is known only when it runs, so the static read refuses it rather than read a part.

An exact origin is not an IPv6 literal (E1590, no fix). A reason's visible character is outside k.schema's blank set, and a reason holds no control or format character, so no NUL, tab or bidirectional override reaches the evidence.

`topology()` throws `Error('E1590 <deployable>: <message>')` for each check the runtime value can show (`originsProblem`, beside the static read in `@keel/compiler/hosting`; a duplicate key does not survive to runtime). `TopologySchema` keeps `origins` as an undeclared key, so that check is the one place.

### The policy
`cspPolicy` takes `origins?` beside its two present inputs:
```ts
export function cspPolicy(
  input: ({ readonly nonce: string; readonly dev?: boolean } | { readonly peers: readonly string[] }) & {
    readonly origins?: Origins;
  },
): string;
```
With `origins` absent or empty the output is the k.security text byte for byte. Otherwise, for the production `node` document of the topology above:
```
default-src 'none'; script-src 'nonce-<n>' 'strict-dynamic'; style-src 'self';
img-src 'self' https://img.cdn.example; font-src 'self' https://fonts.host.example;
connect-src 'self' https://collect.analytics.example; frame-src https://player.video.example;
manifest-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'; object-src 'none';
require-trusted-types-for 'script'; trusted-types keel; report-uri /__keel/csp; report-to keel-csp
```
Each place passes the deployable's own declaration, and every place reads the same one, the static read's: `csp.txt`, the shells and `security.json` read `declaredOrigins(source)`; `parseTopology` carries it on each deployable, and the generated `server.mjs` and `keel dev` entries write it into their code as JSON and pass it as `createApp({ origins })` (`start({ origins })`), which replaces each deployable's runtime `origins` (`declaredTopology`) before the document policy and the hosted `index.html` policy are built. A `createApp` without `origins`, as a test's, reads the topology's own.
- `createApp` passes `opts.topology[name].origins` to the document policy, production and dev.
- A host serving a `client` `index.html` passes that `client` deployable's origins, not its own.
- `cspText` becomes per deployable (`securityReport` with it). `connect-src` is `'self'`, then the `keel-peer` origins, then the declared ones; a declared origin equal to a peer is written once, in the peer's place.
- `shellPolicy` becomes per deployable: `cspPolicy({ peers: [], origins })`, `ipc: http://ipc.localhost` still last in `connect-src`; `deployDrift` compares the same text. Capacitor's meta policy keeps coming from `csp.txt`, which a plain `keel build` writes before any shell tool runs; `media-src` and `frame-src` are honoured in a meta policy, so `metaPolicy` is unchanged.
- A page Vite serves in `keel dev` still carries no policy.

### What stays absolute
`default-src`, `script-src`, `style-src`, `object-src`, `base-uri`, `form-action`, `frame-ancestors`, `manifest-src` and Trusted Types take no declaration.
- Scripts are a later decision. A `node` document's `script-src 'nonce-<n>' 'strict-dynamic'` ignores host lists in every CSP3 browser, so a declared script origin would be written and do nothing; making it work means trusting whatever the app's code inserts, which is a different policy. And `require-trusted-types-for 'script'` with the one policy `keel` refuses a script that assigns an HTML string to `innerHTML` or sets a `script.src` from a string, which most third-party tags do. Opening scripts is its own RFC, with its own threat model.
- `style-src 'self'` stays: a third-party stylesheet can exfiltrate through selectors and is how a library smuggles `<style>` in. A font host's CSS is copied into the app's own stylesheet (the font case below).
- `form-action` and `frame-ancestors` govern where the app's data goes and who frames the app; neither is a load.

### `Frame`
E1805 keeps lowercase intrinsics out of app code, so without an element the `frame` directive would have no use. `Frame` (`packages/ui/src/elements/Frame.ts`) renders `<iframe>`:
- `src: string`: anything but an absolute `http` or `https` URL, a relative one included, renders `about:blank`, as `Image` treats an unsafe scheme; so does a URL of the document's own origin, whose page the sandbox would not hold back. A literal `src` that is not absolute is E1570: the policy has no same-origin frame.
- `title: string`, required (E1802; blank too), the frame's accessible name (WCAG 4.1.2).
- `allow?: readonly ('autoplay' | 'encrypted-media' | 'fullscreen' | 'picture-in-picture')[]`, written joined by `; `. The `Permissions-Policy` header still denies camera, microphone, payment and USB to every frame.
- Always `loading="lazy"`, `sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"` (no top navigation, no forms, no downloads) and `referrerpolicy="strict-origin"`: the document's `Referrer-Policy: same-origin` would send an embedded player no referrer, and players that check their embedder refuse that; `strict-origin` sends the origin and never the path.
- `id`, `lang` and the k.ui style props (`StyleProps`), as `Image`.

`media` has no base element yet: it serves outside code in the W15 host element (D48), which owns its node and may create a `<video>` there. A `Video` and `Audio` pair with required captions is a k.ui question for the operator (below).

### Checks against code
E1570 and E1571 keep their codes and stop at a declared origin: the URL's origin is declared under the matching directive on each deployable listing the module that holds the file or a file importing it by a relative value import, directly or not; a file no module holds or imports is read against every deployable. A `srcset` is one E1570 when any of its absolute candidates is undeclared. The attribute map:

| directive | where |
| --- | --- |
| `img` | `Image src`, `src` and `srcset` of `img`, `srcset` of `source`, `poster` |
| `media` | `src` of `video`, `audio`, `source`, `track` |
| `frame` | `Frame src`, `iframe src` |
| `connect` | E1571: `ctx.net.fetch`, `service({ base })` |

`data`, `action` and `formaction` stay E1570 always. A backslash counts as `/`, as a browser reads an http(s) URL, so `/\host/x` and `\\host/x` are absolute. Font URLs live in CSS, which no rule reads; the policy enforces them at load.

### Evidence
`SecurityReport` (`packages/cli/src/evidence/SecurityReport.ts`) gains `origins: { directive, origin, reason }[]` on each of its three entry kinds (`{ adapter, name, headers, policy, origins }` for `node`, `{ adapter, name, csp, origins }` for `client` and `static`), directives in the order `img`, `media`, `font`, `connect`, `frame`, origins in declaration order, `[]` with none. The `node` entry's `policy` and the others' `csp` already carry them. A reason is source text, as a route id is, never an app value. `v` stays 1: no evidence schema is frozen.

### A public API needs none of this
The policy governs what a Keel document loads. A browser on another origin calling a Keel API is governed by `KEEL_ALLOW_ORIGINS` (k.hosting) and `bearer` (k.api), and a server or script calling it by `bearer` alone. An app that is only an API declares nothing.

## Worked cases
Components use today's signature, `(props, slots?, ctx?)`; W13's `(props, ctx)` changes only the parameter list.

**An image CDN.** `img` on `shop` as above.
```tsx
// modules/catalog/ItemPhoto.tsx
import { type Infer, s } from "@keel/schema";
import { Image } from "@keel/ui";

export const Props = s.object({ sku: s.string(), name: s.string() });

export default function ItemPhoto(props: Infer<typeof Props>) {
  return <Image src={`https://img.cdn.example/${props.sku}/640.webp`} alt={props.name} />;
}
```
`urlText` reads the template's head, `https://img.cdn.example`, declared under `img` on `shop`, which serves `catalog`: no E1570. The same file in a module of a deployable that does not declare it is E1570. The CDN sees the image path and the browser's address, and no referrer (`Referrer-Policy: same-origin`).

**A font host.** The host's own stylesheet would need `style-src`, so the app copies its `@font-face` rules into a stylesheet of its own, which the build serves from `'self'`:
```css
/* app.css, linked from index.html like @keel/ui/fonts */
@font-face {
  font-family: "Inter";
  font-display: swap;
  src: url("https://fonts.host.example/inter/v4/inter-latin.woff2") format("woff2");
}
```
```ts
// tokens.ts
import { defineTokens } from "@keel/ui";

export const tokens = defineTokens({ font: { body: '"Inter", system-ui, sans-serif' } /* other groups */ });
```
`font-src 'self' https://fonts.host.example` lets the face load; the host must answer the cross-origin font request with `Access-Control-Allow-Origin`, as font hosts do. `@keel/ui/fonts`, self-hosted, stays the default and needs no declaration.

**An analytics `connect` endpoint.** No third-party tag runs, so the app sends its own event:
```ts
// modules/catalog/pageView.ts
import type { Ctx } from "@keel/ctx";

export async function pageView(ctx: Ctx, routeId: string): Promise<void> {
  await ctx.net.fetch(
    new Request("https://collect.analytics.example/v1/event", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "pageview", route: routeId }),
    }),
  );
}
```
Client-reachable, `connect` declares the origin: no E1571. It sends a route id, never the URL, so no path parameter leaves; what the body holds is the app's, and k.privacy's rules on personal data apply to it as to any request. Under `img` only, the same call is E1571.

**An embedded video frame.**
```tsx
// modules/catalog/ItemVideo.tsx
import { type Infer, s } from "@keel/schema";
import { Frame } from "@keel/ui";

export const Props = s.object({ videoId: s.string(), name: s.string() });

export default function ItemVideo(props: Infer<typeof Props>) {
  return (
    <Frame
      src={`https://player.video.example/embed/${props.videoId}`}
      title={`Video: ${props.name}`}
      allow={["encrypted-media", "fullscreen", "picture-in-picture"]}
    />
  );
}
```
`frame-src https://player.video.example` admits it. The player runs its own scripts in its own origin, sandboxed: it cannot navigate the shop, submit a form or read the document. The shop's document runs no script it did not nonce.

## Alternatives
- Keep the fixed policy and proxy third parties through the app's origin: every image and font paid for twice, the CDN's resizing lost, and the third party absent from the evidence, which is worse for an auditor than a named origin.
- `createApp({ csp })` or an environment variable: a widening a reviewer cannot see in source and the evidence cannot list before deploy, and a second place for one fact.
- Wildcards (`https://*.cdn.example`): one declaration that admits any subdomain the vendor or an attacker on it controls; an exact origin names one party.
- Paths in a source (`https://cdn.example/shop/`): CSP drops the path after a redirect, so a path gives less than it reads as.
- An array of `{ origin, reason }`: same content; it lets the reason be forgotten and the duplicate get past the types.
- `'self'` in `media-src` and `frame-src` when declared: opens same-origin frames, which the app did not ask for; same-origin media is its own question (below).
- Declarable scripts now, with a host list: ignored under `'strict-dynamic'`, refused by Trusted Types; it would be an option that reads as open and is not.
- No `Frame`, frames only through the W15 host element: the commonest embed would need outside code and lose the required title and the fixed sandbox.

## Spec diff
- New section k.origins (`spec/kernel/k.origins.md`, proposed): declaration, policy, what stays absolute, `Frame`, E1570/E1571 at declared origins, E1590, E1591, evidence, conformance.
- k.security, Policy: "The policy has no option, so no app widens it." becomes "Only declared origins (k.origins) widen it."; E1570's reason becomes "the policy blocks an undeclared origin (k.origins; fix: none)"; to fit, "Vite's injected styles" becomes "Vite's styles" and "E1004's reachability" "E1004's reach". 5,996 characters.
- k.topology, Declaration: `origins?` in the shape, "`origins`: k.origins". Rules: E1552 "`topology.ts` not statically readable (a spread, computed key or key twice in a deployable too)".
- k.ui, Base elements: `Frame` (k.origins) in the list. 6,000 characters.
- k.evidence, `security.json` row: "each with its declared `origins` (k.origins)"; the paragraph on each entry's `origins` (`{ directive, origin, reason }`, directive and declaration order, `[]` with none) lives there, k.origins having no room for it.
- k.origins, from the red-team pass: no IPv6 literal; a reason's visible character outside k.schema's blank set and no control or format character; every policy reads the static read through `createApp({ origins })`; a `frame` origin of the app's own refused in `keel build` and `createApp`, dropped from a document's `frame-src`, and `about:blank` from `Frame`; E1570 reads `\` as `/`; a directive twice is E1591. The code block of Declaration becomes one inline example and Absolute one sentence, to fit.
- Map: the `k.origins` row and k.origins among the E155x owners. `tooling/docs-owners.json`: `@keel/cli` owns k.origins.
- Glossary: **declared origin**.

k.shell is not edited: its Tauri policy is "the `client` policy without peer origins", which carries the declared origins under this text, and D47 is splitting that section.

## Conformance diff
By the `conformance-writer` under `rfc:0160`, from k.origins' Conformance list (11 bullets; `packages/server/conformance/` for policies, `packages/check/conformance/` for E1570, E1571, E1590, E1591, `packages/ui/conformance/` for `Frame`, `packages/cli/conformance/` for `csp.txt`, shells and evidence). Every existing k.security case stays as written; the first k.origins bullet pins that a fixture without a declaration is byte-equal to them.

From the red-team pass (D10 to D13):
- k.topology: `web: { modules: ['a'], adapter: 'node', ...{ origins: { connect: { 'https://evil.example': 'x' } } } }` and `web: { ..., origins: {}, origins: { connect: { 'https://evil.example': 'x' } } }` are each one E1552 in `keel check` and `keel build`, and the built `server.mjs` serves documents whose policy lacks `https://evil.example`; so do its `csp.txt`, shell policies and `security.json`.
- k.origins: a `frame` origin equal to `KEEL_PEER_API` at `keel build` is one E1590 naming the key; `createApp` with `origin: 'https://a.example'` for a deployable framing `https://a.example` rejects with E1590; a `keel dev` document framing `http://localhost:<its port>` has a `frame-src` without it.
- k.origins: `Frame src` of the document's own origin renders `about:blank`.
- k.origins: a reason of `'\u00a0'` alone, or holding NUL, a tab or U+202E, is E1590; `https://[::1]` is E1590 with no fix; `img` written twice in one `origins` is one E1591 at the second.
- k.origins: `Image src="/\evil.example/x"` and `src="\\evil.example/x"` are E1570.
- k.ui: a lowercase `<iframe>` is E1805 naming `Frame`.
- Re-cite under k.evidence the `security.json` origins sentence, which moved there from k.origins Evidence.

## Migration
No app changes: no app declares origins, so every policy is the same bytes. An app that proxies images or fonts may declare the origin instead. The build lane also updates, as describing what exists: `docs/THREAT-MODEL.md` (text below), `docs/COMPLIANCE.md`'s "no option" paragraph, the `keel-compliance` and `keel-deploy` skills, `@keel/server` and `@keel/ui` READMEs, and the code comments that say "no app widens the policy" (`cspPolicy.ts`, `shellPolicy.ts`).

**Threat model, Content security policy bullet**, the sentence "The policy has no option, so no app widens it." becomes:
> A deployable may declare third-party origins in `topology.ts` for five directives (`img`, `media`, `font`, `connect`, `frame`), each an exact origin with a reason, and nothing else widens the policy; the declarations are listed in the evidence bundle. A declared origin can serve the app's pages an image, media, a font or a frame, and receive what the app's own code sends it; it never runs script in the document, since `script-src`, `style-src` and Trusted Types take no declaration. A framed page runs in its own origin under a fixed sandbox (no top navigation, no forms) and gets the document's origin as its referrer, never its path. A declared origin sees the address of each browser that loads from it: that is the app author's choice, recorded with its reason.

## Token impact
k.origins: new, 5,996 characters (under 1,500 tokens). k.security 5,996 (from 5,998); k.ui 6,000 (from 5,979); k.topology 5,971; k.evidence 5,067. Spec map: one row and one owner name (`pnpm check` budgets green). Size budgets: `@keel/server` grows by the `origins` branch of `cspPolicy` and the schema entry; `@keel/ui` by `Frame` (one element, shaped like `Image`). The server is 5 bytes under its budget (D17), so the build lane measures and, if needed, re-bases it with the number.

## Build order
1. This commit: RFC, ADR, spec text, glossary. 2. `conformance-writer` from k.origins. 3. Build: `Topology` type, `TopologySchema`, `topologyReadProblems` (E1590, E1591), `cspPolicy({ origins })`, the five call sites, E1570/E1571 at declared origins, `Frame` with E1802, `SecurityReport.origins`, docs listed under Migration.

## For the operator
1. **Same-origin media.** The fixed policy has no `media-src`, so a `<video>` of the app's own file is blocked today, declared or not. Recommendation: a separate k.security change adding `media-src 'self'` once a media element exists; not here, since it changes the default bytes this RFC keeps.
2. **`Video` and `Audio` base elements.** `media` is declarable but only W15's host element can use it in app code. Recommendation: a k.ui RFC after W15, with required captions (`track`) for `Video`; until then `media` serves host elements.
3. **`Frame` in this RFC.** I added a base element to a security RFC because the `frame` worked case has no other way in app code. Recommendation: keep it here; it is one element shaped like `Image`, and its sandbox and title belong to the same review.
4. **Diagnostic codes.** E1590 and E1591 were free when written; the other RFC lanes may take nearby codes. Recommendation: the orchestrator settles any collision at merge.
5. **Scripts.** Recommendation: no third-party script before a real app needs one; then an RFC that starts from a nonce on the tag and a Trusted Types policy per script, with the threat model first.
