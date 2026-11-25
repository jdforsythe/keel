import { Secret } from "../Secret.ts";
import type { Above } from "./Above.ts";
import type { Issue } from "./Issue.ts";
import type { Node } from "./Node.ts";
import { formats } from "./formats.ts";
import { isJson } from "./isJson.ts";
import { leafRule } from "./leafRule.ts";
import { plainEntries } from "./plainEntries.ts";
import { plainItems } from "./plainItems.ts";
import { scanExtras } from "./scanExtras.ts";
import { variantOf } from "./variantOf.ts";

type Path = (string | number)[];

/** Put container `x` on `above` while its items are judged; the count to pop after. */
const enter = (x: unknown, above: Above): number => (typeof x === "object" && x !== null ? above.push(x) : 0);

/**
 * Validate `x` against `node`, appending every failure to `issues`. A container node judges the value's own shape
 * first (k.schema Plain data) and reads nothing under a value that is not a plain container. An array in `copies` is
 * one `seal` built in this parse from a plain array's items, so it is plain by construction and its shape is not read
 * again; its items are judged as any array's. A Proxy whose trap throws makes it throw; `make` turns that into an
 * issue.
 */
export function check(
  node: Node,
  x: unknown,
  path: Path,
  issues: Issue[],
  above: Above = [],
  copies: ReadonlySet<object> = new Set(),
): void {
  switch (node.kind) {
    case "nullable":
      if (x !== null) check(node.inner, x, path, issues, above, copies);
      break;
    case "optional":
      check(node.inner, x, path, issues, above, copies);
      break;
    case "secret":
      if (Secret.is(x)) check(node.inner, Secret.open(x), path, issues, [], copies);
      else if (x === Secret.marker) issues.push({ path, rule: "secret-missing" });
      else check(node.inner, x, path, issues, above, copies);
      break;
    case "format": {
      const before = issues.length;
      check(node.base, x, path, issues, above, copies);
      // Fail closed: a format node with no in-memory check (deserialized, or another copy of @keel/schema) refuses.
      if (issues.length === before && formats.get(node)?.test(x) !== true) issues.push({ path, rule: "format" });
      break;
    }
    case "json":
      if (!isJson(x)) issues.push({ path, rule: "type" });
      break;
    case "array": {
      const items = Array.isArray(x) && copies.has(x) ? x : plainItems(x);
      if (items === undefined) issues.push({ path, rule: "type" });
      else {
        const pushed = enter(x, above);
        for (const [i, item] of items.entries()) check(node.item, item, [...path, i], issues, above, copies);
        if (pushed > 0) above.pop();
      }
      break;
    }
    case "record": {
      const own = plainEntries(x);
      if (own === undefined) issues.push({ path, rule: "type" });
      else {
        const pushed = enter(x, above);
        own.keys.forEach((key, i) => {
          check(node.value, own.values[i], [...path, key], issues, above, copies);
        });
        if (pushed > 0) above.pop();
      }
      break;
    }
    case "object": {
      const own = plainEntries(x);
      if (own === undefined) {
        issues.push({ path, rule: "type" });
        break;
      }
      const { keys, values } = own;
      const pushed = enter(x, above);
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        if (key === undefined || Object.hasOwn(node.fields, key)) continue;
        if (node.closed === true) issues.push({ path: [...path, key], rule: "unknown-key" });
        else scanExtras(values[i], [...path, key], issues, above);
      }
      for (const key in node.fields) {
        const field = node.fields[key];
        if (field === undefined) continue;
        const at = [...path, key];
        const i = keys.indexOf(key);
        if (i < 0) {
          if (field.kind !== "optional")
            issues.push({ path: at, rule: field.kind === "nullable" ? "nullable-absent" : "required" });
        } else if (values[i] === null && field.kind === "optional" && field.inner.kind !== "nullable") {
          issues.push({ path: at, rule: "optional-null" });
        } else {
          check(field, values[i], at, issues, above, copies);
        }
      }
      if (pushed > 0) above.pop();
      break;
    }
    case "union": {
      const own = plainEntries(x);
      if (own === undefined) {
        issues.push({ path, rule: "type" });
        break;
      }
      const at = own.keys.indexOf(node.key);
      const variant = at < 0 ? undefined : variantOf(node, own.values[at]);
      if (variant === undefined) issues.push({ path: [...path, node.key], rule: "discriminant" });
      else check(variant, x, path, issues, above, copies);
      break;
    }
    case "anyOf": {
      let last: Issue[] = [];
      for (const member of node.members) {
        last = [];
        check(member, x, path, last, above, copies);
        if (last.length === 0) return;
      }
      issues.push(...last);
      break;
    }
    default: {
      const rule = leafRule(node, x);
      if (rule !== undefined) issues.push({ path, rule });
    }
  }
}
