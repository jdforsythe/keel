import { axe } from "./axe.ts";
import { fail } from "./fail.ts";

/** Throw E1703 listing up to five violations when the rendered subtree breaks an axe rule. */
export function assertAccessible(root: Element): void {
  const found = axe(root);
  const [first] = found;
  if (first === undefined) return;
  const more = found.slice(1, 5).map((v) => `\n  E1703 ${v.rule}: ${v.at} ${v.help}`);
  const rest = found.length > 5 ? `\n  ... +${found.length - 5} more E1703` : "";
  throw fail("E1703", `${first.rule}: ${first.at} ${first.help}${more.join("")}${rest}`, { violations: found });
}
