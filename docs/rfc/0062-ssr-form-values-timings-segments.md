# RFC 0062: bound controls write their first value as the markup default, and the timings cap protects names with history

Status: implemented (ADR-0051)

## Problem
- **Backlog 0166.** The server DOM keeps `value`, `checked` and `selected` as control state, as a browser does (RFC 0060). Neither `Field.bind` nor a reactive `value` on a `@keel/ui` control wrote anything else. So a server-rendered edit form had empty fields and the first option selected until the runtime loaded. Golden-1's edit page has no island, so it stayed that way: `<input name="title">` with no value, `<option value="normal">` not selected. A user without JS posted the empty values.
- **Red team 0172 (std.timings).** The LRU cap of RFC 0059 traded starvation for erasure. 256 request-derived names (`GET /u/<i>`) evicted every name updated less often, and its stats restarted. Repro: `time(ctx, "db", f)` 1,000 times, then 256 unique GETs. `timingsOf(ctx).db` was `undefined`, and the next call reported `count: 1`. One crawl wiped all history, and `dropped` only counted it.

- **Red team on the first draft (0178, 0179, 0180).** The timings clause overstated the guarantee, and its tests copied the implementation. A textarea value lost a leading newline in server HTML. `Field.bind` overwrote text typed before the page went live.

## Proposal
1. **0166: the first render's value is the markup default.** A browser treats the `value` attribute, a textarea's text, `selected` and `checked` as the control's default, and shows the default until the control is edited. Writing them changes neither a dirty control nor the property.
   - **`Field.bind` (k.forms).** The bind's sync effect already sets the property. On its first run it also writes the element's state as the default (`markDefault`): the `value` attribute of an input, the textarea's text, `selected` on each option that is selected (removed from the others), and `checked` on a checkbox or radio. It writes only what differs, so an empty value adds no `value=""`. A `password` or `file` input gets no `value` attribute, so a secret never enters the markup. Later syncs (user edits, `set`, `reset`, a `keel.fields` reply) write the property only.
   - **`@keel/ui` controls.** A reactive `value` (`Input`, `TextArea`, `Select`) or `checked` (`Checkbox`) binds the property through `prop`, as before. Its first value is also written as the default (`markFirst`): the `value` attribute (not on a `password` Input), the textarea's text, `selected` on the first matching option, `checked`. A static string already wrote the attribute. A control given `field` gets the default from `bind`.
   - **One path.** The same DOM calls run in the browser, under happy-dom and on the server DOM. The server DOM keeps control state out of the markup. Its one change is the leading newline (Proposal 3).
   - **An edit before bind wins (backlog 0180).** Server HTML is now editable before the runtime loads. At bind, a control whose state differs from its markup default (`edited`: the `value` attribute, the textarea's text, `checked`, or the last option marked `selected`, else the first enabled one) was changed by the user. The field reads it as an `input` event would, and no default is written. Before this, the first sync wrote the field's initial value over the edit.
   - **First run, not at bind.** Inside a render, effects flush after the component returns, so a write at `bind` would read the control before the sync. The write runs in the sync effect's first run, after the property is set.
2. **0172: a segmented LRU (SLRU).** A ctx keeps at most 256 names in two `Map`s in update order.
   - A new name joins the unprotected segment. At the cap it first evicts the least recently updated unprotected name and adds 1 to `dropped`. Its stats are gone.
   - A call to a known name, in either segment, moves it to the protected segment's recent end.
   - Past 192 protected names, the least recent one moves back to the unprotected recent end. It is not evicted and not counted.
   - Declaratively, the protected names are the up to 192 kept names whose last call was a repeat call (a call to a kept name), latest first. A name becomes unprotected at its first call, or when it drops out of those 192, and a new name at the cap evicts the name unprotected longest.
   - **The guarantee (amended, backlog 0178).** A kept name with `count` 2 or more is evicted only after 192 other names had a repeat call since its last call. Names called once churn only the unprotected names. The first draft said "names called once never evict a name called more than once". That is false past 192 repeated names: a demoted name is unprotected, and new names evict it. Repro: 193 names called twice, then 64 new names, evicts `r0`. A crawler that requests each URL twice can still erase older history. Ranking by frequency would close that, but it needs counts that decay, or old names never leave. The clause states the bound that holds.

3. **0179: a leading newline in `textarea`, `pre` and `listing`.** The HTML parser drops one newline right after these start tags. The server serializer now writes an extra `\n` when the element's text starts with `\n` or `\r`. The server parser drops one `\n` or `\r\n` there, as browsers do. A value such as `"\nindented"` then survives server HTML and a no-JS submit.

## Alternatives
- **The server DOM serializes the current property as the attribute.** Server HTML would then differ from a browser's `outerHTML` and from happy-dom for the same tree: two DOM behaviours where there is one now. Only server pages would show values, and RFC 0060 rejected it for that reason.
- **Write the default on every sync.** Every keystroke would then rewrite an attribute. A native form reset would restore the last value instead of the rendered one. A typed password would also reach the attribute.
- **Write at `bind`, before the effects.** Under `mount` and the server's render unit, effects flush after the component returns, so this read the control before its sync and wrote empty defaults. The first conformance run caught it.
- **A sample threshold (N = 8) for protection.** A name with 2 to 7 samples could still be erased by a crawl. A second call is the plain signal that a name is not a one-off.
- **A separate cap for request-derived names.** `time` cannot tell a request-derived name from another without a naming rule. The segments need none.

## Spec diff
- **k.forms Bindings.** "it sets `name`, `id`, `value`, listens" becomes "it sets `name`, `id`, `value`, writes the value at bind as the element's default (`value` attribute, textarea text, `selected`, `checked`; none on `password` or `file`; rfc:0062) so server HTML shows it, listens". It continues "; an element whose value already differs from its default (a user edit before the runtime loaded) keeps it and the field takes it". **Conformance** adds "A bound `input`, `textarea`, `select` and checkbox show the bound value in their markup from the first render (`value` attribute, text, `selected`, `checked`); a later user edit changes the property, not the markup." and "Binding a control whose value differs from its markup default (edited before bind) keeps that value, sets the field to it, and leaves the markup."
- **k.ui Base elements.** Adds "A reactive `value` or `checked` binds the property and writes its first value as the default (`value` attribute, text, `selected`, `checked`; not on a `password` Input; rfc:0062), so server HTML shows it." **Conformance** adds "An `Input`, `TextArea`, `Select` or `Checkbox` given a signal for `value` or `checked` shows its first value in the markup; a later signal write changes only the property."
- **std.timings `timingsOf`.** "A ctx keeps at most 256 names: a new name evicts the least recently updated one." becomes the declarative rule and the guarantee of Proposal 2. `TimingsRecent` adds "(their stats are gone; a move between segments is not counted)". **Conformance** adds "A kept name with `count` 2 or more stays kept, whatever names are called once, until 192 other names had a repeat call since its last call; `dropped` counts each evicted name."
- **k.server.** No change (1,499 tokens). The server DOM is unchanged.

## Conformance diff
- **Added** `packages/forms/conformance/bound-value-in-markup.test.ts`. It covers markup and property on first render for an input, textarea, select and checkbox, a user edit that leaves the markup, a password without `value`, and a property (seed 1337) that `outerHTML` reparsed gives the same value.
- **Added** `packages/ui/conformance/reactive-value-in-markup.test.ts`, one test per control: the first value is in the markup, and a later signal write changes the property only.
- **Replaced** `packages/std-timings/conformance/cap-least-recent.test.ts` (the LRU model) with `cap-protected-192.test.ts`. It uses an oracle that recomputes the protected set from each name's last call and repeat flag at every step, not the implementation's segment moves (0178). It covers sequences over 401 names and sequences with more than 192 repeated names (seed 1337), plus the `r0` example. **Added** `protected-survives-single-calls.test.ts`: the 0172 repro, and a property (seed 1337) with up to 400 repeated names. While fewer than 192 other names had a repeat call since `db`'s last call, `db` stays, and exactly one name leaves per new name at the cap.
- **Added** `packages/forms/conformance/bind-keeps-prior-edit.test.ts` for the 0180 clause. `evict-least-recent.test.ts` is unchanged.
- **Unit tests.**
  - forms `markDefault.test.ts`: values, password, user edit, `set`/`reset`, stale defaults cleared.
  - ui `valueDefaults.test.ts`: a compiled edit form under a real `form`, and resume. Server HTML carries the values, and after `resume` an edit stays in the property and the field while the attribute keeps the default.
  - server `ssr-form-values.test.ts`: under plain Node, a `createApp` edit page shows each value, escaped, and no password.
  - server `ssr-form-values.property.test.ts` (seed 1337): random strings round-trip through the server DOM parser as an input `value`, textarea text and selected option.
  - forms `markDefault.test.ts` (0180): the backlog repro, and `edited` per control. ui `valueDefaults.test.ts`: a compiled component whose `input`s resume in place keeps text typed before resume and an unticked box, while the markup keeps the server default. The test fails without `edited`.
  - server `ssr-form-values.property.test.ts` (0179, seed 1337): a TextArea and a `pre` whose text starts with `\n`, `\r\n` or `\r` round-trip through the server parser, and parsed `<textarea>\nx` reads `x`.
  - std-timings `cap.test.ts`: the 0172 repro, the move back past 192, and the property that a name with two or more samples survives any sequence of single-sample names.
- **Golden-1.** `apps/golden-1/test/ssrNode.test.ts` asserts `value="Milk"` and `<option value="normal" selected="">` on the edit page under plain Node. Before this change it asserted the empty form.

## Migration
- **Markup.** Server and client HTML of bound controls gains `value`, `selected`, `checked` and textarea text. Snapshot tests of rendered forms change.
- **Timings.** Names called more than once survive crawls. Unprotected names are evicted in their own update order, so which one-off name goes first can differ from RFC 0059's LRU.
- **App code.** None.

## Known limits
- **Radio groups bound outside a render.** `edited` sees a radio the user picked. But when `bind` runs outside a render, the first radio's sync can untick the user's pick before the second radio is bound. Under a render, effects run after every `bind`. `@keel/ui` has no radio element.
- **Islands built from `@keel/ui` elements re-render at resume.** Base elements are made with `createElement`, not compiled templates, so resume cannot claim them: E1253 "the component did not render the island root". An edit typed before resume is lost with the server nodes. The attribute is not the cause, and after resume the default never overwrites an edit. This is filed for the runtime and compiler.

## Token impact
- k.forms 987 to 1,154. k.ui 1,143 to 1,237. std.timings 555 to 715. k.server unchanged at 1,499.
- Size (gzip): `@keel/forms` 3,825 to 4,100 bytes (5 kB budget). `@keel/ui` 2,622 to 2,717 (4 kB). `@keel/std-timings` 602 to 681. `@keel/server` 13,692 to 13,789 (13.5 kB is 13,824) for the newline rule. No budget changes.
