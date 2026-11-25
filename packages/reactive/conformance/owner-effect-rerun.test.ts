// Spec: k.reactive, clause "`owner()` inside `scope(fn)` returns that scope's handle; outside any scope it returns undefined; inside an effect it returns the scope that owns the effect."
import { describe, expect, it } from "vitest";
import { effect, owner, scope, signal } from "@keel/reactive";
import type { Scope } from "@keel/reactive";

function setup() {
  const owners: (Scope | undefined)[] = [];
  let set: (v: number) => void = () => {};
  const h = scope(() => {
    const s = signal(0);
    set = (v) => s.set(v);
    effect(() => {
      s.get();
      owners.push(owner());
    });
  });
  return { h, owners, set };
}

describe("k.reactive: owner() inside an effect re-run", () => {
  it("a re-run triggered by a write from outside every scope still sees the owning scope", () => {
    const { h, owners, set } = setup();
    expect(owner()).toBeUndefined();
    set(1);
    set(2);
    expect(owners.length).toBeGreaterThanOrEqual(3);
    for (const o of owners) expect(o).toBe(h);
    expect(owner()).toBeUndefined();
  });

  it("a re-run triggered by a write inside another scope's run sees the owning scope, not the writer's", () => {
    const { h, owners, set } = setup();
    const other = scope(() => {});
    let writerOwner: Scope | undefined;
    other.run(() => {
      set(1);
      writerOwner = owner();
    });
    const afterWrite = owner();
    expect(owners.length).toBeGreaterThanOrEqual(2);
    for (const o of owners) expect(o).toBe(h);
    expect(owners).not.toContain(other);
    expect(writerOwner).toBe(other);
    expect(afterWrite).toBeUndefined();
  });

  it("a re-run triggered by a write inside scope(fn) sees the owning scope and the writer's owner is restored", () => {
    const { h, owners, set } = setup();
    let writerOwner: Scope | undefined;
    const w = scope(() => {
      set(1);
      writerOwner = owner();
    });
    expect(owners.length).toBeGreaterThanOrEqual(2);
    for (const o of owners) expect(o).toBe(h);
    expect(writerOwner).toBe(w);
    expect(owner()).toBeUndefined();
  });
});
