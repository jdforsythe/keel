import type { RefLink } from "./RefLink.ts";
import type { ReferenceUse } from "./ReferenceUse.ts";
import { isAstNode } from "./isAstNode.ts";

/** Wrappers a value passes through unchanged. */
const THROUGH = new Set([
  "ParenthesizedExpression",
  "TSAsExpression",
  "TSSatisfiesExpression",
  "TSNonNullExpression",
  "TSTypeAssertion",
  "ChainExpression",
]);

/**
 * The use of the value standing below `links[at]` (k.privacy-reads Held), climbing through what carries it unread:
 * wrappers, a non-computed member read, a field value of an object literal, a spread, an array element and a branch of
 * `?:`. It ends at a call argument, a top-level `const`'s initializer, an export, or any other use.
 */
export function refUse(links: readonly RefLink[], at: number): ReferenceUse {
  for (let i = at; i >= 0; i--) {
    const link = links[i];
    if (link === undefined) break;
    const { node, key } = link;
    if (THROUGH.has(node.type) && key === "expression") continue;
    switch (node.type) {
      case "MemberExpression":
        if (key === "object" && node.computed !== true) continue;
        return { kind: "other" };
      case "Property":
        if (
          key === "value" &&
          node.kind === "init" &&
          node.method !== true &&
          links[i - 1]?.node.type === "ObjectExpression"
        )
          continue;
        return { kind: "other" };
      case "SpreadElement":
        continue;
      case "ObjectExpression":
        if (key === "properties") continue;
        return { kind: "other" };
      case "ArrayExpression":
        if (key === "elements") continue;
        return { kind: "other" };
      case "ConditionalExpression":
        if (key === "consequent" || key === "alternate") continue;
        return { kind: "other" };
      case "CallExpression":
        return key === "arguments" ? { kind: "argument", call: node.start } : { kind: "other" };
      case "VariableDeclarator": {
        const id = node.id;
        const decl = links[i - 1]?.node;
        const holder = links[i - 2]?.node;
        const exported = holder?.type === "ExportNamedDeclaration";
        const topLevel = exported ? links[i - 3]?.node.type === "Program" : holder?.type === "Program";
        const name = isAstNode(id) && id.type === "Identifier" ? id.name : undefined;
        if (key === "init" && typeof name === "string" && decl?.type === "VariableDeclaration")
          if (decl.kind === "const" && topLevel) return { kind: "alias", name, exported };
        return { kind: "other" };
      }
      case "ExportSpecifier": {
        const exported = node.exported;
        const name = isAstNode(exported) ? (exported.type === "Literal" ? exported.value : exported.name) : undefined;
        return key === "local" && typeof name === "string" ? { kind: "export", name } : { kind: "other" };
      }
      case "ExportDefaultDeclaration":
        return key === "declaration" ? { kind: "export", name: "default" } : { kind: "other" };
      default:
        return { kind: "other" };
    }
  }
  return { kind: "other" };
}
