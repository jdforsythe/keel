// @vitest-environment happy-dom
// `Part`'s `focus` moves focus after the commit: focus and blur handlers that write state (a transaction's commit) run
// outside the effect, so no write lands inside it (k.reactive E1201), and a reactive `tabIndex` binds `tabindex`.
import { scope, signal } from "@keel/reactive";
import { mount } from "@keel/runtime-dom";
import { Part } from "@keel/ui/aria";
import { expect, test } from "vitest";
import { testCtx } from "./testCtx.ts";

const flush = async (): Promise<void> => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};
const owner = scope(() => undefined, { detached: true });

test("a focus move whose focus and blur handlers write state reports no error", async () => {
  const errors: unknown[] = [];
  const log = owner.run(() => signal<readonly string[]>([]));
  const at = owner.run(() => signal<"a" | "b">("a"));
  const tab = (id: "a" | "b"): Node =>
    Part({
      id,
      role: "tab",
      selected: false,
      controls: "p",
      tabIndex: owner.run(() => ({ get: (): 0 | -1 => (at.get() === id ? 0 : -1) })),
      focus: { get: () => at.get() === id },
      onFocus: () => log.set([...log.get(), `focus ${id}`]),
      onBlur: () => log.set([...log.get(), `blur ${id}`]),
      children: () => id,
    });
  const host = document.createElement("div");
  document.body.appendChild(host);
  const off = mount(() => Part({ id: "l", role: "tablist", label: "T", children: () => [tab("a"), tab("b")] }), host, {
    ctx: testCtx,
    onError: (e) => errors.push(e),
  });
  await flush();
  at.set("b");
  await flush();
  expect(errors).toEqual([]);
  expect(document.activeElement?.id).toBe("b");
  expect(host.querySelector("#b")?.getAttribute("tabindex")).toBe("0");
  expect(host.querySelector("#a")?.getAttribute("tabindex")).toBe("-1");
  at.set("a");
  await flush();
  expect(errors).toEqual([]);
  expect(log.get()).toEqual(["focus b", "blur b", "focus a"]);
  off();
  host.remove();
});
