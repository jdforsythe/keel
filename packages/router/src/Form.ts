import { signal } from "@keel/reactive";
import { servedForm } from "@keel/runtime-dom/internal";
import { cond, element, on } from "@keel/runtime-dom/ops";
import type { KeelError } from "@keel/schema";
import { isHref } from "../unsafe/isHref.ts";
import { codedError } from "./internal/codedError.ts";
import { findRouter } from "./internal/findRouter.ts";
import { formHandle } from "./internal/formHandle.ts";
import { formSeams } from "./internal/formSeams.ts";
import { onOwnerDispose } from "./internal/onOwnerDispose.ts";
import { renderChildren } from "./internal/renderChildren.ts";
import type { FormProps } from "./types/FormProps.ts";
import type { Href } from "./types/Href.ts";

/** The non-field error the `error` slot shows; pending state lives on the `form` handle only (RFC 0043). */
type Shown = KeelError<string, unknown> | null;

function slot(parent: HTMLFormElement, when: () => boolean, render: () => Node): void {
  const anchor = document.createComment("keel:slot");
  parent.append(anchor);
  cond(anchor, when, render);
}

/**
 * `<Form method action form? error?>` (k.router Form, k.mount Form). Renders `<form method="post">` whose `action` is
 * the given `Href`, with a hidden `_method` for PUT/PATCH/DELETE, so it posts natively without JS. Rendered inside a
 * router's `App` (found through the owner scope chain) whose table matches `action`, it intercepts submit: validates
 * `form` (if any), submits the FormData to `actions[method]` of that route, and applies the Result (`ok(href)`
 * navigates, `ok(null)` revalidates); it throws E1505 when that route does not declare the method. Otherwise the
 * browser posts it: on submit `form` is validated (errors prevent the submit), a chosen file throws E1583 and sends
 * nothing, else `form.pending()` is true until a `pageshow` from the back-forward cache, or in a shell until the mount
 * request is answered (k.return). Rendered for the post it sent that the server answered `keel.fields` (`servedForm`,
 * on the server's 422 re-render and at its resume), its `form` takes the submitted values and errors before its
 * controls bind. An `action` that is no `Href` at run time (`isHref`) throws E1501.
 */
export function Form(
  props: (FormProps & { readonly method: "POST" }) | FormProps<Href & { readonly __mount?: never }>,
): HTMLFormElement {
  // An `Href` is a type; an `action` that slipped past it at run time (no `isHref`) is E1501, and no form renders.
  if (typeof props.action !== "string" || !isHref(props.action))
    throw codedError("E1501", "<Form action>: the value is no Href, a path of this origin");
  const core = findRouter();
  const routed = core?.accepts(props.action, props.method);
  if (routed === false)
    throw codedError(
      "E1505",
      `<Form method="${props.method}" action="${props.action}">: no route of this router declares that action`,
    );
  // The rejected post this form sent, re-rendered (k.forms Submit): its handle takes the submitted values and errors
  // before the controls bind, on the server and at resume alike.
  const posted = servedForm.current;
  if (posted !== null && posted.href === props.action && posted.method === props.method)
    props.form?.[formHandle].restore?.(posted.values, posted.errors);
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
  if (core === null || !routed) {
    const seam = props.form?.[formHandle];
    let refused: Event | undefined;
    const files = (e: Event): void => {
      for (const c of el.querySelectorAll("input"))
        if (c.files?.length) {
          refused = e;
          e.preventDefault();
          throw codedError("E1583", `<Form action="${props.action}"> file`);
        }
    };
    const onShow = (e: PageTransitionEvent): void => {
      if (e.persisted) seam?.setPending(false);
    };
    el.addEventListener("submit", files);
    // Delegated, so a submit queued before resume (k.defaults) is validated at its replay, where a file is refused too.
    if (seam !== undefined) {
      formSeams.set(el, seam);
      on(el, "submit", (e) => {
        if (refused === e) return;
        if (!seam.validate().ok) return e.preventDefault();
        files(e);
        seam.setPending(true);
        addEventListener("pageshow", onShow);
      });
    }
    // A server render has no window; the page listener is added at a submit, which only a browser makes.
    onOwnerDispose(() => {
      el.removeEventListener("submit", files);
      globalThis.removeEventListener?.("pageshow", onShow);
    });
    return el;
  }
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
  onOwnerDispose(() => el.removeEventListener("submit", onSubmit));
  return el;
}
