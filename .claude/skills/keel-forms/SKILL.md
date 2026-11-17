---
name: keel-forms
description: "Build Keel forms: form(schema), Field.bind, ui controls with field, router Form with actions, keel.fields errors, decodeStrings/toFormData; E19xx"
---

# Forms with @keel/forms

Spec: `pnpm spec k.forms`. Define the input as an `s.object` in `*.schema.ts`; the same schema is the action's input. `.pii()` fields: keel-compliance.

```tsx
const f = form(OrderEdit, { initial: order })   // in a component scope (else E1203)
<Form method="POST" action={routes.href('orders.show', { id })} form={f} error={(e) => <Text>{e.message}</Text>}>
  <Input field={f.field('address.city')} label="City" />
  <If when={f.pending()}><Text>Saving</Text></If>
  <Button id="orders.save" type="submit">Save</Button>
</Form>
```
- `Form` is from `@keel/router`; `action` is the target route's `Href` (`routes.href(id, params)`) whose action is bound by `routes.actions({ [id]: { POST } })`. Slot: `error` (no `loading`).
- `f.field(path)`: typed dotted path (array indexes ok). Handle: `values()`, `errors()`, `pending()` (the one pending state), `reset()`. A `Field` has `name, id, errorId, value(), error(), touched(), set(v), blur(), bind(el)`.
- Base inputs given `field` call `bind` (name, id, value, `aria-invalid`, `aria-describedby`); for a plain `input` call `field.bind(el)` (returns unbind).
- Validation is from the schema only: on blur, then each input once an error shows; all on submit. Invalid submit sends nothing and focuses the first invalid field.
- Action result: `ok` resets to `initial`; `err({ code: 'keel.fields', data: { title: 'Taken' } })` sets exactly those field errors (422 on the server); any other `err` shows in the `error` slot, values kept. Pass a client-service 422 body on: `err(r.error.data.body?.error ?? r.error)`.
- A page's `Form` posts to a page action, which declares no `output` and answers `ok(href)` or `ok(null)`; an API route's action is not a form target for navigation.
- Without JS the server decodes FormData by the action input schema and re-renders.
- Encoding: `schema.decodeStrings(formData)` coerces numbers, checkbox booleans, `a.b` nested keys, repeated keys; `toFormData(schema, value)` is its inverse (except empty optional strings).

**Errors:** E1901 input in a `<Form>` without `field` · E1902 path not in schema.

**Tests:** `renderRoute`, `fire(<field id>, { type: 'input', value })`, `fire(submitId, { type: 'click' })`, then `find(id).state.focused` and `find(`${id}:error`).text`.
