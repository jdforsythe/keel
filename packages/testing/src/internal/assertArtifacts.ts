import type { A11yEntry } from "@keel/compiler";
import { elementsWithId } from "./elementsWithId.ts";
import { fail } from "./fail.ts";
import { isHidden } from "./isHidden.ts";
import { nameAndSource } from "./nameAndSource.ts";
import { roleOf } from "./roleOf.ts";

const hiddenWithin = (el: Element, root: Element): boolean => {
  for (let n: Element | null = el; n !== null && n !== root; n = n.parentElement) if (isHidden(n)) return true;
  return false;
};

/**
 * E1702: every rendered, visible element whose id is in `a11y` must have the expected role (when the compiler
 * knew one) and take its accessible name from the expected source. Elements absent from either side are skipped.
 */
export function assertArtifacts(root: Element, a11y: Readonly<Record<string, A11yEntry>>): void {
  const found: { readonly id: string; readonly expected: string; readonly actual: string }[] = [];
  for (const el of elementsWithId(root)) {
    const entry = a11y[el.id];
    if (entry === undefined || hiddenWithin(el, root)) continue;
    const role = roleOf(el);
    const { source } = nameAndSource(el, role);
    const roleOk = entry.role === null || entry.role === role;
    if (roleOk && entry.name === source) continue;
    found.push({
      id: el.id,
      expected: `${entry.role === null ? "any role" : `role ${entry.role}`}, name from ${entry.name}`,
      actual: `role ${role}, name from ${source}`,
    });
  }
  const [first] = found;
  if (first === undefined) return;
  const line = (m: (typeof found)[number]): string => `"${m.id}" expected ${m.expected}; rendered ${m.actual}`;
  const more = found.slice(1, 5).map((m) => `\n  E1702 ${line(m)}`);
  const rest = found.length > 5 ? `\n  ... +${found.length - 5} more E1702` : "";
  throw fail("E1702", `${line(first)}${more.join("")}${rest}`, { mismatches: found });
}
