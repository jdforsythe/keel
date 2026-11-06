import { fail } from "./fail.ts";

/**
 * The throw the mount's default root Boundary caught (k.errors; runtime-dom renders it as
 * `<pre data-k-error="<at>">message</pre>`), as a `keel.unexpected` error, or undefined when none was caught.
 */
export function rootError(container: Element): Error | undefined {
  for (const el of Array.from(container.getElementsByTagName("pre"))) {
    const at = el.getAttribute("data-k-error");
    if (at !== null) return fail("keel.unexpected", `at ${at}: ${el.textContent ?? ""}`, { at });
  }
  return undefined;
}
