import type { Result } from "../Result.ts";
import type { Schema } from "../Schema.ts";
import type { SchemaError } from "../SchemaError.ts";
import { err } from "../err.ts";
import { ok } from "../ok.ts";
import type { Issue } from "./Issue.ts";
import type { Node } from "./Node.ts";
import { check } from "./check.ts";
import { docOf } from "./docOf.ts";
import { freeze } from "./freeze.ts";
import { freezeNode } from "./freezeNode.ts";
import { hasSecret } from "./hasSecret.ts";
import { invalid } from "./invalid.ts";
import { issueText } from "./issueText.ts";
import { mark } from "./mark.ts";
import { seal } from "./seal.ts";
import { toJson } from "./toJson.ts";

/**
 * Build the public Schema object for a node, frozen with the node and everything under it. The type guard below is
 * the only place unknown becomes T.
 */
export function make<T, O extends boolean>(node: Node, isOptional: O): Schema<T, O> {
  freezeNode(node);
  let issues: Issue[] = [];
  const is = (x: unknown, copies: ReadonlySet<object> = new Set()): x is T => {
    issues = [];
    // A value whose shape cannot be read (a revoked Proxy, a throwing trap) is not plain data.
    try {
      check(node, x, [], issues, [], copies);
    } catch {
      issues = [{ path: [], rule: "type" }];
    }
    return issues.length === 0;
  };
  const sealing = hasSecret(node);
  const parse = (input: unknown): Result<T, SchemaError> => {
    if (!sealing) return is(input) ? ok(input) : err(invalid(issues));
    // `seal` copies only plain containers, read through their descriptors, so the one check of the copy judges every
    // value read once (k.schema Plain data): a getter or a hidden key is refused, never flattened or dropped. Each
    // sealed value is frozen deep only once the whole value passes, so a failed parse leaves the input as it was; a
    // value the seal, check or freeze cannot walk is an err, never a throw.
    try {
      const made: unknown[] = [];
      const copies = new Set<object>();
      const value = seal(node, input, made, copies);
      if (!is(value, copies)) return err(invalid(issues));
      for (const v of made) freeze(v, copies);
      return ok(value);
    } catch {
      return err(invalid([{ path: [], rule: "type" }]));
    }
  };
  const schema: Schema<T, O> = {
    node,
    isOptional,
    parse,
    encode(value) {
      if (!is(value)) throw new Error(issueText(issues));
      return toJson(node, value);
    },
    doc: () => docOf(node),
    pii: (cls) => make<T, O>(mark(node, cls), isOptional),
    toJSON: () => node,
    optional: () => make<T, true>(node.kind === "optional" ? node : { kind: "optional", inner: node }, true),
    nullable() {
      const wrap = (n: Node): Node => (n.kind === "nullable" ? n : { kind: "nullable", inner: n });
      return make<T | null, O>(
        node.kind === "optional" ? { kind: "optional", inner: wrap(node.inner) } : wrap(node),
        isOptional,
      );
    },
  };
  return Object.freeze(schema);
}
