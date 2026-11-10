import { Secret } from "../Secret.ts";
import type { Issue } from "./Issue.ts";
import type { Node } from "./Node.ts";
import { formats } from "./formats.ts";
import { hasProtoKey } from "./hasProtoKey.ts";
import { isJson } from "./isJson.ts";
import { isRecord } from "./isRecord.ts";
import { leafRule } from "./leafRule.ts";
import { scanExtras } from "./scanExtras.ts";
import { variantOf } from "./variantOf.ts";

type Path = (string | number)[];

/** Validate `x` against `node`, appending every failure to `issues`. Never throws. */
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
      if (issues.length === before && formats.get(node)?.test(x) === false) issues.push({ path, rule: "format" });
      break;
    }
    case "json":
      if (!isJson(x, new Set())) issues.push({ path, rule: "type" });
      break;
    case "array":
      if (!Array.isArray(x)) issues.push({ path, rule: "type" });
      else for (const [i, item] of x.entries()) check(node.item, item, [...path, i], issues);
      break;
    case "record":
      if (!isRecord(x) || hasProtoKey(x)) issues.push({ path, rule: "type" });
      else for (const key of Object.keys(x)) check(node.value, x[key], [...path, key], issues);
      break;
    case "object":
      if (!isRecord(x) || hasProtoKey(x)) {
        issues.push({ path, rule: "type" });
        break;
      }
      for (const key of Object.keys(x)) {
        if (Object.hasOwn(node.fields, key)) continue;
        if (node.closed === true) issues.push({ path: [...path, key], rule: "unknown-key" });
        else scanExtras(x[key], [...path, key], issues);
      }
      for (const [key, field] of Object.entries(node.fields)) {
        const at = [...path, key];
        if (!Object.hasOwn(x, key)) {
          if (field.kind !== "optional")
            issues.push({ path: at, rule: field.kind === "nullable" ? "nullable-absent" : "required" });
        } else if (x[key] === null && field.kind === "optional" && field.inner.kind !== "nullable") {
          issues.push({ path: at, rule: "optional-null" });
        } else {
          check(field, x[key], at, issues);
        }
      }
      break;
    case "union": {
      if (!isRecord(x) || hasProtoKey(x)) {
        issues.push({ path, rule: "type" });
        break;
      }
      const variant = Object.hasOwn(x, node.key) ? variantOf(node, x[node.key]) : undefined;
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
