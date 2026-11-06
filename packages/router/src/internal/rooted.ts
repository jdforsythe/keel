import { type Scope, scope } from "@keel/reactive";

/** Run `make` in a new root scope and return both; reactive primitives need an owner (E1203). */
export function rooted<T extends object>(make: () => T): { readonly scope: Scope; readonly value: T } {
  const box: { value?: T } = {};
  const sc = scope(() => {
    box.value = make();
  });
  if (box.value === undefined) throw new Error("k.router: scope body did not run");
  return { scope: sc, value: box.value };
}
