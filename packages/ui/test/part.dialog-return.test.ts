// @vitest-environment happy-dom
// A dialog part returns focus on close to the element `returnFocus` names; when it is gone, to the element focused
// at open; when that is gone too (or was `body`), to `main` with `tabindex="-1"`.
import { scope, signal } from "@keel/reactive";
import { mount } from "@keel/runtime-dom";
import { list } from "@keel/runtime-dom/ops";
import { Part } from "@keel/ui/aria";
import { afterEach, expect, test } from "vitest";

const flush = async (): Promise<void> => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};
const owner = scope(() => undefined);
afterEach(() => {
  document.body.innerHTML = "";
});

const setup = (returnFocus?: string) => {
  document.body.innerHTML = '<main><button id="trigger" type="button">Open</button><div id="host"></div></main>';
  const host = document.getElementById("host");
  if (host === null) throw new Error("no host");
  const open = owner.run(() => signal(false));
  const off = mount(
    () =>
      Part({
        id: "d",
        role: "dialog",
        labelledBy: "d",
        open,
        ...(returnFocus === undefined ? {} : { returnFocus }),
        children: () => [Part({ id: "ok", role: "button", children: () => "OK" })],
      }),
    host,
  );
  return { open, off };
};

test("focus returns to `returnFocus` though the click left focus on body", async () => {
  const { open, off } = setup("trigger");
  open.set(true);
  await flush();
  expect(document.activeElement?.id).toBe("ok");
  open.set(false);
  await flush();
  expect(document.activeElement?.id).toBe("trigger");
  off();
});

test("with the trigger gone and nothing focused at open, focus goes to `main` with tabindex -1", async () => {
  const { open, off } = setup("trigger");
  open.set(true);
  await flush();
  document.getElementById("trigger")?.remove();
  open.set(false);
  await flush();
  expect(document.activeElement?.localName).toBe("main");
  expect(document.querySelector("main")?.getAttribute("tabindex")).toBe("-1");
  off();
});

test("an open dialog removed with its trigger returns focus by the same rule", async () => {
  document.body.innerHTML = '<main><div id="host"></div></main>';
  const host = document.getElementById("host");
  if (host === null) throw new Error("no host");
  const rows = owner.run(() => signal<readonly { id: string }[]>([{ id: "r1" }]));
  const open = owner.run(() => signal(false));
  const row = (r: string): Node =>
    Part({
      id: `${r}.row`,
      role: "group",
      label: "Row",
      children: () => [
        Part({ id: `${r}.trigger`, role: "button", children: () => "Delete" }),
        Part({
          id: `${r}.dlg`,
          role: "alertdialog",
          labelledBy: `${r}.trigger`,
          describedBy: `${r}.trigger`,
          open,
          returnFocus: `${r}.trigger`,
          children: () => [Part({ id: `${r}.ok`, role: "button", children: () => "OK" })],
        }),
      ],
    });
  const off = mount(() => {
    const box = document.createElement("div");
    const anchor = document.createComment("");
    box.append(anchor);
    list(
      anchor,
      () => rows.get(),
      (r) => r.id,
      (item) => row(item().id),
    );
    return box;
  }, host);
  open.set(true);
  await flush();
  expect(document.activeElement?.id).toBe("r1.ok");
  rows.set([]);
  await flush();
  expect(document.querySelector("[id='r1.dlg']")).toBeNull();
  expect(document.activeElement?.localName).toBe("main");
  off();
});
