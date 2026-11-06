# k.forms: Forms
status: implemented

**API.**
```tsx
import { form } from '@keel/forms'
import { Form } from '@keel/router'
const f = form(OrderEdit, { initial: order }) // OrderEdit is an s.object in orders.schema.ts
<Form method="POST" action="orders.show" form={f} error={(e) => <Text>{e.message}</Text>}>
  <Input field={f.field('note')} label="Note" />
  <Input field={f.field('address.city')} label="City" />
  <Button type="submit" label="Save" />
</Form>
```
`form(schema, { initial? })` creates form state in the calling component's scope. The handle: `field(path)` (typed dotted path; array indexes allowed), `values()`, `errors()` (path to message), `pending()`, `reset()`. Reads are computeds.

**Bindings.** `field(path)` returns a `Field`: `{ name, id, errorId, value(), error(), touched(), set(v), blur(), bind(el) }` where reads are computeds and `bind(el)` attaches to a plain `input`, `select`, or `textarea`: it sets `name`, `id`, `value`, listens to `input` and `blur`, and keeps `aria-invalid` and `aria-describedby` (naming `errorId`) in sync; it returns an unbind function and is disposed with the scope. A base input (k.ui) given `field` calls `bind` and renders the error text under `errorId`; that is the only way an element binds to a form. Values are typed; FormData coding derives from the schema (numbers, checkbox booleans, absent optionals).

**Validation.** From the schema only. A field validates on blur, then on every input once it has shown an error; all fields validate on submit. Messages derive from `schema.invalid` issues (rule plus constraint).

**Submit.** The client parses values. On `err`: set field errors, focus the first invalid field in document order, send nothing. On `ok`: submit FormData to the route action (k.router, k.server); `pending()` is true until the response. The action's `Result`:
- `ok`: errors clear, values reset to `initial`, loaders revalidate (k.router).
- `err` with code `keel.fields` (`data: { [path]: message }`): exactly those field errors are set.
- any other `err`: the `error` slot renders it; values and field errors are unchanged.

Without JS the server runs the same flow: it decodes FormData with the action's input schema and, on `keel.fields`, re-renders the page with the submitted values and errors (k.server).

**Slots** on `<Form form>`: `loading` while pending, `error` for non-field errors (k.ui standard slots).

**Rules.** E1901 input inside a `<Form>` without `field` · E1902 `field(path)` path not in the schema · E1903 form schema differs from the target action's input schema · E1904 `keel.fields` error names a path not in the action's input schema.

**Conformance.**
- Submitting invalid values sends no request, sets an error on every invalid field, and focuses the first invalid field.
- For every generated valid value, FormData encode then decode by the schema returns an equal value.
- A `keel.fields` response sets exactly the listed field errors and clears all others.
- Any other `err` renders in the `error` slot and leaves values intact.
- An invalid bound input has `aria-invalid="true"` and `aria-describedby` naming an element whose text is its message.
- `pending()` is true from submit until the response and false after.
- With the runtime absent, posting invalid FormData returns 422 HTML containing the submitted values and messages.
