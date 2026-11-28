# k.forms: Forms
status: conformance-covered

**API.**
```tsx
import { form } from '@keel/forms'
import { Form } from '@keel/router'
const f = form(OrderEdit, { initial: order }) // OrderEdit is an s.object in orders.schema.ts
<Form method="POST" action={orders.href('orders.show', { id: order.id })} form={f} error={(e) => <Text>{e.message}</Text>}>
  <Input field={f.field('note')} label="Note" />
  <Input field={f.field('address.city')} label="City" />
  <If when={f.pending()}><Text>Saving</Text></If>
  <Button type="submit">Save</Button>
</Form>
```
`form(schema, { initial?, id?, issueText? })` creates form state in the calling component's scope. The handle: `field(path)` (typed dotted path; array indexes allowed), `values()`, `errors()` (path to message), `pending()`, `reset()`. Reads are computeds. `pending()` is a submission's one pending state: render from it; `route().pending` is the router's (k.router).

**Bindings.** `field(path)` returns a `Field`: `{ name, id, errorId, value(), error(), touched(), set(v), blur(), bind(el) }` where reads are computeds and `bind(el)` attaches to a plain `input`, `select`, or `textarea`: it sets `name`, `id`, `value`, writes the value at bind as the element's default (`value` attribute, textarea text, `selected`, `checked`; none on `password`, `file` or an `s.secret` field) so server HTML shows it; an element whose value already differs from its default (a user edit before the runtime loaded) keeps it and the field takes it; it listens to `input` and `blur`, and keeps `aria-invalid` and `aria-describedby` (naming `errorId`) in sync; it returns an unbind function and is disposed with the scope. Field `id` is `<formId>:<path>` (an `id` already on the element wins) and `errorId` is `<id>:error`; `formId` is `id` if given, else a stable hash of the schema shape, never a counter, so server and client agree. A second live form with one `formId` in a render root gets `~2`, then `~3` (RFC 0024). A base input (k.ui) given `field` calls `bind` and renders the error text under `errorId`; that is the only way an element binds to a form. Values are typed; FormData coding derives from the schema (numbers, checkbox booleans, absent optionals).

**Validation.** From the schema only. A field validates on blur, then on every input once it has shown an error; all fields validate on submit. Messages derive from `schema.invalid` issues. `issueText(issue): string` gives a field's text for each issue `{ rule, path, min?, max?, values?, format? }` (`FieldIssue`: the constraint from the schema node at the path; `format` is the format type's name); without it the text is English from the rule and constraint, `Invalid value` for `format`. Its `path` is the key `errors()` uses: the issue's path segments joined by `.`, a record key and an array index as the input holds them, so a record key a person typed reaches `issueText`, and one holding `.` reads as more segments. The English text comes from the rule and constraint alone: it is the same for every path and every failing value.

**Submit.** The client parses values. On `err`: set field errors, focus the first invalid field in document order, send nothing. On `ok`: submit FormData to the route action (k.router, k.server); `pending()` is true until the response. The action's `Result`:
- `ok`: errors clear, values reset to `initial`, loaders revalidate (k.router).
- `err` with code `keel.fields` (`data: { [path]: message }`): exactly those field errors are set.
- any other `err`: the `error` slot renders it; values and field errors are unchanged.

Without JS the server runs the same flow: it decodes FormData with the action's input schema and, on `keel.fields`, re-renders the page with the submitted values, less password-input ones and any that may reach an `s.secret`, and errors (k.server). The page carries a summary before its content, `role="alert"` with class `k-summary` (k.ui Base): one item per error, a link to the field's control (`#<field id>`) named by the text of its `<label for>` (else the path), then the message.

**Slot** on `<Form>`: `error` for non-field errors (k.ui standard slots); no `loading` slot (rfc:0043).

**Rules.** E1901 input inside a `<Form>` without `field` · E1902 `field(path)` path not in the schema. A password control's field: W1114 (k.privacy-reads).

**Conformance.**
- Submitting invalid values sends no request.
- Submitting invalid values sets an error on every invalid field.
- Submitting invalid values focuses the first invalid field.
- A field of `s.string({ min: 1 })` shows one message for an absent value, `''` and `'  '`: the `required` one.
- A field of `s.string({ min: 1 }).optional()` holding `''` or `'  '` shows no error and submits without the key; one of `s.string().optional()` submits `'  '`.
- For every generated valid value, FormData encode then decode by the schema returns an equal value.
- A `keel.fields` response sets exactly the listed field errors and clears all others.
- Any other `err` renders in the `error` slot and leaves values intact.
- An invalid bound input has `aria-invalid="true"` and `aria-describedby` naming an element whose text is its message.
- `pending()` is true from submit until the response and false after; `<Form>` has no `loading` prop.
- A bound `input`, `textarea`, `select` and checkbox show the bound value in their markup from the first render (`value` attribute, text, `selected`, `checked`); a later user edit changes the property, not the markup.
- Binding a control whose value differs from its markup default (edited before bind) keeps that value, sets the field to it, and leaves the markup.
- With the runtime absent, posting invalid FormData returns 422 HTML containing the submitted values and messages.
- Two `form()` calls in separate render roots with one schema and one `id` give equal field ids; a second live one in the same root gets `~2`.
- With `issueText`, an invalid field's error text is exactly its return value for that field's issue, whose `rule`, `path` and constraint match the schema; without it, a `format` issue shows `Invalid value`.
- No 422 response carries a submitted `s.secret` or password-input value.
- Of input `s.object({ cards: s.record(s.object({ name: s.string({ min: 3 }), pin: s.secret(s.string()) })), pay: s.union('kind', [s.object({ kind: s.literal('card'), cvc: s.secret(s.string()) }), s.object({ kind: s.literal('cash'), note: s.string() })]) })`, a no-script post of `cards.a.name=x`, `cards.a.pin=pin-7781`, `pay.kind=cash`, `pay.note=hi` and `pay.cvc=cvc-7781` answers 422 whose `#k-state` `form.values` holds `cards.a.name` `x`, `pay.kind` `cash` and `pay.note` `hi` and no `cards.a.pin` or `pay.cvc` key, and whose body holds neither `pin-7781` nor `cvc-7781`.
- A no-script post that fails `amount` (an `Input` labelled `Amount`) answers 422 with a `.k-summary` item reading `Amount: <message>` whose link targets `#<field id>`.
- With `form(s.object({ tags: s.record(s.string({ max: 3 })) }), { issueText })`, for every record key `k` that `parse` accepts, a submit of `{ tags: { [k]: 'long' } }` calls `issueText` with an issue whose `rule` is `max`, `max` 3 and `path` `tags.` followed by `k`, and `errors()` holds that path; without `issueText` its message is one text for every such `k` and every value longer than 3 characters, so it holds neither the key nor the value.
