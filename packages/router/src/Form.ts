import { scope, signal } from "@keel/reactive";
import { cond, element } from "@keel/runtime-dom/ops";
import type { KeelError } from "@keel/schema";
import { codedError } from "./internal/codedError.ts";
import { findRouter } from "./internal/findRouter.ts";
import { renderChildren } from "./internal/renderChildren.ts";
import type { FormProps } from "./types/FormProps.ts";

/** The non-field error the `error` slot shows; pending state lives on the `form` handle only (RFC 0043). */
type Shown = KeelError<string, unknown> | null;

function slot(parent: HTMLFormElement, when: () => boolean, render: () => Node): void {
  const anchor = document.createComment("keel:slot");
  parent.append(anchor);
  cond(anchor, when, render);
}

/**
 * `<Form method action form? error?>` (k.router Form, RFC 0045). Renders `<form method="post">` whose `action` is
 * the given `Href` (`routes.href`), with a hidden `_method` for PUT/PATCH/DELETE, so it posts natively without JS
 * and reads no route table. Rendered inside a router's `App` (found through the owner scope chain), it intercepts
 * submit: validates `form` (if any), submits the FormData to `actions[method]` of the route `action` matches in that
 * router's table, and applies the Result (`ok(href)` navigates, `ok(null)` revalidates). Inside a router, throws
 * E1505 when the matched route does not declare that method.
 */
export function Form(props: FormProps): HTMLFormElement {
  const core = findRouter();
  if (core !== null && !core.accepts(props.action, props.method))
    throw codedError(
      "E1505",
      `<Form method="${props.method}" action="${props.action}">: no route of this router declares that action`,
    );
  // Through the runtime's `element`, so at resume the form, its hidden input and its children claim the server's
  // nodes, which stay where they are.
  const el = element("form", (f) => {
    f.setAttribute("method", "post");
    f.setAttribute("action", props.action);
    const nodes =
      props.method === "POST"
        ? []
        : [
            element("input", (hidden) => {
              hidden.setAttribute("type", "hidden");
              hidden.setAttribute("name", "_method");
              hidden.setAttribute("value", props.method);
            }),
          ];
    for (const n of [...nodes, ...renderChildren(props.children)]) if (n.parentNode !== f) f.append(n);
  });
  if (core === null) return el;
  const status = signal<Shown>(null);
  const { error } = props;
  if (error !== undefined)
    slot(
      el,
      () => status.get() !== null,
      () => {
        const e = status.get();
        return e === null ? document.createComment("") : error(e);
      },
    );
  const run = async (): Promise<void> => {
    status.set(null);
    const r = await core.submit({ action: props.action, method: props.method, form: el, handle: props.form });
    const shown = r !== null && !r.ok && (props.form === undefined || r.error.code !== "keel.fields") ? r.error : null;
    status.set(shown);
  };
  const onSubmit = (e: Event): void => {
    e.preventDefault();
    void run();
  };
  el.addEventListener("submit", onSubmit);
  scope(() => {}).onDispose(() => el.removeEventListener("submit", onSubmit));
  return el;
}
