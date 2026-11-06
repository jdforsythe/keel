---
name: keel-forms
description: "Build Keel forms: form(schema), Field.bind, ui controls with field, router Form with actions, keel.fields errors, decodeStrings/toFormData; E19xx"
---

# Forms with @keel/forms

Spec: `pnpm spec k.forms`. Define the input as an `s.object` in `*.schema.ts`; the same schema is the action's input.

```tsx
const f = form(OrderEdit, { initial: order })   // in a component scope (else E1203)
<Form method="POST" action="orders.show" form={f} error={(e) => <Text>{e.message}</Text>}>
  <Input field={f.field('address.city')} label="City" />
  <Button id="orders.save" type="submit" label="Save" />
</Form>
```
- `Form` is from `@keel/router`; `action` is a route id whose `actions: { POST }` takes the same schema. Slots: `loading`, `error`.
- `f.field(path)`: typed dotted path (array indexes ok). Handle: `values()`, `errors()`, `pending()`, `reset()`. A `Field` has `name, id, errorId, value(), error(), touched(), set(v), blur(), bind(el)`.
- Base inputs given `field` call `bind` (sets name, id, value, `aria-invalid`, `aria-describedby` -> `errorId`). For a plain `input/select/textarea` call `field.bind(el)`; it returns unbind.
- Validation is from the schema only: on blur, then each input once an error shows; all on submit. Invalid submit sends nothing and focuses the first invalid field.
- Action result: `ok` resets to `initial`; `err({ code: 'keel.fields', data: { title: 'Taken' } })` sets exactly those field errors (422 on the server); any other `err` shows in the `error` slot, values kept. Pass a client-service 422 body on: `err(r.error.data.body?.error ?? r.error)`.
- Without JS the server decodes FormData with the action input schema and re-renders with values and errors.
- Encoding: `schema.decodeStrings(formData)` coerces numbers, checkbox booleans, `a.b` nested keys, repeated keys; `toFormData(schema, value)` is its inverse (empty string in optional keys excepted).

**Errors:** E1901 input in a `<Form>` without `field` · E1902 path not in schema (also thrown as `code: 'E1902'`) · E1903 form schema differs from the action input schema · E1904 `keel.fields` names a path outside the action input.

**Tests:** `renderRoute`, `fire(<field id>, { type: 'input', value })`, `fire(submitId, { type: 'click' })`, then `find(id).state.focused` and `find(`${id}:error`).text`.
