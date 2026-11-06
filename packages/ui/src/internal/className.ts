import type { StyleState } from "../types/StyleState.ts";
import { ident } from "./ident.ts";
import { states } from "./states.ts";

/**
 * The atomic class for one (prop, token, breakpoint, state): `k-p-2`, `k-md-p-3`, `k-hover-bg-accent`.
 * Pure and injective; non-alphanumeric tokens or breakpoints get a stable hash suffix.
 */
export function className(prop: string, token: string, breakpoint?: string, state?: StyleState): string {
  const seg = states.find((s) => s.key === state)?.segment;
  const parts = [breakpoint, seg, prop, token].filter((p): p is string => p !== undefined);
  const readable = breakpoint === undefined || !states.some((s) => s.segment === breakpoint);
  return `k-${ident(parts, JSON.stringify([prop, token, breakpoint ?? null, state ?? null]), readable)}`;
}
