import type { AttrLookup } from "./AttrLookup.ts";
import { IMPLICIT_ROLES } from "./IMPLICIT_ROLES.ts";
import { INPUT_ROLES } from "./INPUT_ROLES.ts";

/**
 * The ARIA role of an element (k.compiler Artifacts, WAI-ARIA 1.2 / HTML-AAM): the first token of an explicit
 * `role`, else the implicit role of `tag`. `undefined` when the table has no role for the tag or an attribute the
 * role depends on is not known statically; the compiler records that as `null`, the harness as `generic`.
 * `img` with `alt=""` is `presentation`; `section` is `region` only with `aria-label` or `aria-labelledby`.
 */
export function roleFor(tag: string, attr: AttrLookup): string | undefined {
  const role = attr("role");
  if (role === undefined) return undefined;
  const explicit = (role ?? "").trim().split(/\s+/)[0] ?? "";
  if (explicit !== "") return explicit;
  switch (tag) {
    case "a":
    case "area":
      return attr("href") === null ? "generic" : "link";
    case "img":
      return attr("alt") === "" ? "presentation" : "img";
    case "input": {
      const type = attr("type");
      return type === undefined ? undefined : (INPUT_ROLES.get((type ?? "text").toLowerCase()) ?? "textbox");
    }
    case "select": {
      const multiple = attr("multiple");
      const size = attr("size");
      if (multiple === undefined) return undefined;
      if (multiple !== null) return "listbox";
      if (size === undefined) return undefined;
      return Number(size ?? "1") > 1 ? "listbox" : "combobox";
    }
    case "section":
      return attr("aria-label") === null && attr("aria-labelledby") === null ? "generic" : "region";
    default:
      return IMPLICIT_ROLES.get(tag);
  }
}
