// Copy of the class-name scheme in packages/ui/src/internal/className.ts (with its `ident`, `fnv1a`, and
// state segments). The compiler may not import @keel/ui (later in tooling/deps.json); keep both in step:
// test/className.test.ts asserts they agree.

import type { StyleUsage } from "../types/StyleUsage.ts";

type State = NonNullable<StyleUsage["state"]>;

const SEGMENTS: readonly { readonly key: State; readonly segment: string }[] = [
  { key: "selected", segment: "selected" },
  { key: "checked", segment: "checked" },
  { key: "pressed", segment: "pressed" },
  { key: "expanded", segment: "expanded" },
  { key: "current", segment: "current" },
  { key: "highlighted", segment: "highlighted" },
  { key: "hover", segment: "hover" },
  { key: "focusVisible", segment: "focus" },
  { key: "active", segment: "active" },
  { key: "disabled", segment: "disabled" },
];

const PLAIN = /^[A-Za-z0-9]+$/;

/** FNV-1a 32-bit, base 36 (ui's `fnv1a`; the compiler's own `fnv1a` is hex). */
function hash36(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

function ident(parts: readonly string[], key: string, readable: boolean): string {
  if (readable && parts.every((p) => PLAIN.test(p))) return parts.join("-");
  return `${parts.map((p) => p.replace(/[^A-Za-z0-9]/g, "_")).join("-")}_${hash36(key)}`;
}

/**
 * The atomic class for one (prop, token, breakpoint, state): `k-p-2`, `k-md-p-3`, `k-hover-bg-accent`.
 * Identical to `@keel/ui`'s, so a class the compiler writes matches the rule `compileStyles` emits.
 */
export function className(prop: string, token: string, breakpoint?: string, state?: State): string {
  const seg = SEGMENTS.find((s) => s.key === state)?.segment;
  const parts = [breakpoint, seg, prop, token].filter((p): p is string => p !== undefined);
  const readable = breakpoint === undefined || !SEGMENTS.some((s) => s.segment === breakpoint);
  return `k-${ident(parts, JSON.stringify([prop, token, breakpoint ?? null, state ?? null]), readable)}`;
}
