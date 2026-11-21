---
"@keel/runtime-dom": patch
"@keel/router": patch
"@keel/forms": patch
"@keel/server": patch
---

A `keel.fields` answer to a native form post re-renders the page's bound controls with the submitted values, `aria-invalid` and the error text, and resume keeps them: the `<Form>` the post went to hands them to its `form` handle before its controls bind.
