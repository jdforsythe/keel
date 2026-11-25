// Spec: k.reactive, clause "`owner()` inside `scope(fn)` returns that scope's handle; outside any scope it returns undefined; inside an effect it returns the scope that owns the effect."
import { describe, expect, it } from "vitest";
import { effect, owner, scope } from "@keel/reactive";
import type { Scope } from "@keel/reactive";

describe("k.reactive: owner()", () => {
  it("outside any scope it returns undefined", () => {
    expect(owner()).toBeUndefined();
  });

  it("inside scope(fn) it returns the handle scope(fn) returns", () => {
    let seen: Scope | undefined;
    const h = scope(() => {
      seen = owner();
    });
    expect(seen).toBe(h);
    expect(owner()).toBeUndefined();
  });

  it("a nested scope sees its own handle; the outer handle is restored after it", () => {
    let outerSeen: Scope | undefined;
    let innerSeen: Scope | undefined;
    let afterInner: Scope | undefined;
    let inner: Scope | undefined;
    const outer = scope(() => {
      outerSeen = owner();
      inner = scope(() => {
        innerSeen = owner();
      });
      afterInner = owner();
    });
    expect(outerSeen).toBe(outer);
    expect(innerSeen).toBe(inner);
    expect(afterInner).toBe(outer);
    expect(innerSeen).not.toBe(outerSeen);
  });

  it("inside an effect it returns the scope that owns the effect", () => {
    let seen: Scope | undefined;
    const h = scope(() => {
      effect(() => {
        seen = owner();
      });
    });
    expect(seen).toBe(h);
  });

  it("parent links to the enclosing scope; onDispose runs once on dispose", () => {
    let calls = 0;
    let inner: Scope | undefined;
    const outer = scope(() => {
      inner = scope(() => {});
    });
    expect(inner?.parent).toBe(outer);
    expect(outer.parent).toBeUndefined();
    outer.onDispose(() => calls++);
    outer.dispose();
    outer.dispose();
    expect(calls).toBe(1);
    outer.onDispose(() => calls++);
    expect(calls).toBe(2);
  });
});
