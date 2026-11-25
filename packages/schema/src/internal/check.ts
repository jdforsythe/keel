import { Secret } from "../Secret.ts";
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

/**
 * Validate `x` against `node`, appending every failure to `issues`. A container node judges the value's own shape
 * first (k.schema Plain data) and reads nothing under a value that is not a plain container. A Proxy whose trap
 * throws makes it throw; `make` turns that into an issue.
 */
export function check(node: Node, x: unknown, path: Path, issues: Issue[]): void {
  switch (node.kind) {
    case "nullable":
      if (x !== null) check(node.inner, x, path, issues);
      break;
    case "optional":
      check(node.inner, x, path, issues);
      break;
    case "secret":
      if (Secret.is(x)) check(node.inner, Secret.open(x), path, issues);
      else if (x === Secret.marker) issues.push({ path, rule: "secret-missing" });
      else check(node.inner, x, path, issues);
      break;
    case "format": {
      const before = issues.length;
      check(node.base, x, path, issues);
      // Fail closed: a format node with no in-memory check (deserialized, or another copy of @keel/schema) refuses.
      if (issues.length === before && formats.get(node)?.test(x) !== true) issues.push({ path, rule: "format" });
      break;
    }
    case "json":
      if (!isJson(x)) issues.push({ path, rule: "type" });
      break;
    case "array": {
      const items = plainItems(x);
      if (items === undefined) issues.push({ path, rule: "type" });
      else for (const [i, item] of items.entries()) check(node.item, item, [...path, i], issues);
      break;
    }
    case "record": {
      const entries = plainEntries(x);
      if (entries === undefined) issues.push({ path, rule: "type" });
      else for (const [key, v] of entries) check(node.value, v, [...path, key], issues);
      break;
    }
    case "object": {
      const entries = plainEntries(x);
      if (entries === undefined) {
        issues.push({ path, rule: "type" });
        break;
      }
      for (const [key, v] of entries) {
        if (Object.hasOwn(node.fields, key)) continue;
        if (node.closed === true) issues.push({ path: [...path, key], rule: "unknown-key" });
        else scanExtras(v, [...path, key], issues);
      }
      for (const [key, field] of Object.entries(node.fields)) {
        const at = [...path, key];
        const found = entries.find((e) => e[0] === key);
        const v = found?.[1];
        if (found === undefined) {
          if (field.kind !== "optional")
            issues.push({ path: at, rule: field.kind === "nullable" ? "nullable-absent" : "required" });
        } else if (v === null && field.kind === "optional" && field.inner.kind !== "nullable") {
          issues.push({ path: at, rule: "optional-null" });
        } else {
          check(field, v, at, issues);
        }
      }
      break;
    }
    case "union": {
      const entries = plainEntries(x);
      if (entries === undefined) {
        issues.push({ path, rule: "type" });
        break;
      }
      const tag = entries.find(([k]) => k === node.key);
      const variant = tag === undefined ? undefined : variantOf(node, tag[1]);
      if (variant === undefined) issues.push({ path: [...path, node.key], rule: "discriminant" });
      else check(variant, x, path, issues);
      break;
    }
    case "anyOf": {
      let last: Issue[] = [];
      for (const member of node.members) {
        last = [];
        check(member, x, path, last);
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
