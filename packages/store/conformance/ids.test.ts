import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import { store, stores } from "@keel/store";
// k.store Ids: default id `store.<n>`; stores() lists stores whose owning scope is live; duplicate live id throws.
// Spec: k.store, clause "`stores()` lists stores whose owning scope is live and drops one on disposal."
// Spec: k.store, clause "A duplicate live id throws."
import { describe, expect, it } from "vitest";
import { Cart } from "./fixtures";

describe("k.store: ids and registry", () => {
  it("an omitted id is store.<n> with distinct n per store", () => {
    const ids: string[] = [];
    scope(() => {
      ids.push(store(Cart, { items: [] }).id, store(Cart, { items: [] }).id);
    });
    expect(ids[0]).toMatch(/^store\.\d+$/);
    expect(ids[1]).toMatch(/^store\.\d+$/);
    expect(ids[0]).not.toBe(ids[1]);
  });

  it("stores() lists a live store under its id and drops it when its scope is disposed", () => {
    let created: ReturnType<typeof store<{ items: { sku: string; qty: number }[] }>> | undefined;
    const h = scope(() => {
      created = store(Cart, { items: [] }, { id: "reg.cart" });
    });
    expect(stores().get("reg.cart")).toBe(created);
    h.dispose();
    expect(stores().has("reg.cart")).toBe(false);
  });

  it("a duplicate live id throws; the id is reusable after disposal", () => {
    const h = scope(() => {
      store(Cart, { items: [] }, { id: "dup.cart" });
    });
    expect(() => scope(() => void store(Cart, { items: [] }, { id: "dup.cart" }))).toThrow();
    expect(stores().has("dup.cart")).toBe(true);
    h.dispose();
    const again = scope(() => {
      store(s.object({}), {}, { id: "dup.cart" });
    });
    expect(stores().has("dup.cart")).toBe(true);
    again.dispose();
  });
});
