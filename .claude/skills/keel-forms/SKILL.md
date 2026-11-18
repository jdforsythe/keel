---
name: keel-forms
description: "Build Keel forms: form(schema), Field.bind, ui controls with field, router Form with actions or a native post to the identity mount, keel.fields errors, decodeStrings/toFormData; E19xx, E1583"
---

# Forms with @keel/forms

Spec: `pnpm spec k.forms`. Input: an `s.object` in `*.schema.ts`, also the action's input. `.pii()`: keel-compliance.

```tsx
const f = form(OrderEdit, { initial: order })   // in a component scope (else E1203)
<Form method="POST" action={routes.href('orders.show', { id })} form={f} error={(e) => <Text>{e.message}</Text>}>
  <Input field={f.field('address.city')} label="City" />
  <If when={f.pending()}><Text>Saving</Text></If>
  <Button id="orders.save" type="submit">Save</Button>
</Form>
```
- `Form` is from `@keel/router`; `action` is the route's `Href` (`routes.href(id, params)`), its action bound by `routes.actions({ [id]: { POST } })`. Slot: `error`.
- `action={mount.href('/sign-in/email')}` (keel-server): after validation the browser posts it natively, urlencoded, the named fields; `POST` only; a chosen file is E1583. A rejection returns as a search key the route declares (`?error=credentials`).
- Password `s.secret`: `<Input field={...} type="password" autocomplete="current-password" />`.
- `f.field(path)`: typed dotted path. Handle: `values()`, `errors()`, `pending()`, `reset()`. A `Field`: `name, id, errorId, value(), error(), touched(), set(v), blur(), bind(el)`.
- Base inputs given `field` call `bind`; a plain `input` calls `field.bind(el)`.
- Schema validation: on blur, then each input once an error shows; all on submit. Invalid submit sends nothing, focuses the first invalid field.
- Result: `ok` resets to `initial`; `err({ code: 'keel.fields', data: { title: 'Taken' } })` sets those field errors (422); any other `err` shows in `error`, values kept.
- A page action has no `output`, answers `ok(href)` or `ok(null)`. Without JS the server decodes and re-renders.
- `schema.decodeStrings(formData)` coerces numbers, checkboxes, `a.b` and repeated keys; `toFormData(schema, value)` is its inverse.

**Errors:** E1901 input in a `<Form>` without `field` · E1902 path not in schema.

**Tests:** `renderRoute`, `fire(<field id>, { type: 'input', value })`, `fire(submitId, { type: 'click' })`, then `find(id).state.focused` and `find(`${id}:error`).text`.
