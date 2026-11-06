import { scope, signal } from "@keel/reactive";
import { cond } from "@keel/runtime-dom/ops";
import type { KeelError } from "@keel/schema";
import { codedError } from "./internal/codedError.ts";
import { findRouter } from "./internal/findRouter.ts";
import { hrefIn } from "./internal/hrefIn.ts";
import { latest } from "./internal/latest.ts";
import { renderChildren } from "./internal/renderChildren.ts";
import type { FormProps } from "./types/FormProps.ts";

type Status = { readonly pending: boolean; readonly error: KeelError<string, unknown> | null };

function slot(parent: HTMLFormElement, when: () => boolean, render: () => Node): void {
  const anchor = document.createComment("keel:slot");
  parent.append(anchor);
  cond(anchor, when, render);
}

/**
 * `<Form method action params? form? loading? error?>` (k.router Form). Renders `<form method="post">` whose
 * `action` is the target route's href, with a hidden `_method` for PUT/PATCH/DELETE, so it posts natively
 * without JS. Rendered inside a router's `App` (found through the owner scope chain), it intercepts submit: validates `form` (if any), submits the FormData to
 * `actions[method]` of route `action`, and applies the Result (`ok(href)` navigates, `ok(null)` revalidates).
 * Throws E1505 when the route does not declare that method.
 */
export function Form(props: FormProps): HTMLFormElement {
  const core = findRouter();
  const table = core === null ? latest.get(props.action) : core.table;
  if (table?.get(props.action)?.def.actions?.[props.method] === undefined)
    throw codedError(
      "E1505",
      `<Form method="${props.method}" action="${props.action}">: route declares no such action`,
    );
  const params = props.params ?? {};
  const el = document.createElement("form");
  el.setAttribute("method", "post");
  el.setAttribute("action", hrefIn(table, props.action, params, {}));
  if (props.method !== "POST") {
    const hidden = document.createElement("input");
    hidden.setAttribute("type", "hidden");
    hidden.setAttribute("name", "_method");
    hidden.setAttribute("value", props.method);
    el.append(hidden);
  }
  el.append(...renderChildren(props.children));
  if (core === null) return el;
  const status = signal<Status>({ pending: false, error: null });
  const { loading, error } = props;
  if (loading !== undefined) slot(el, () => status.get().pending, loading);
  if (error !== undefined)
    slot(
      el,
      () => status.get().error !== null,
      () => {
        const e = status.get().error;
        return e === null ? document.createComment("") : error(e);
      },
    );
  const run = async (): Promise<void> => {
    status.set({ pending: true, error: null });
    const r = await core.submit({ action: props.action, method: props.method, params, form: el, handle: props.form });
    const shown = r !== null && !r.ok && (props.form === undefined || r.error.code !== "keel.fields") ? r.error : null;
    status.set({ pending: false, error: shown });
  };
  const onSubmit = (e: Event): void => {
    e.preventDefault();
    void run();
  };
  el.addEventListener("submit", onSubmit);
  scope(() => {}).onDispose(() => el.removeEventListener("submit", onSubmit));
  return el;
}
