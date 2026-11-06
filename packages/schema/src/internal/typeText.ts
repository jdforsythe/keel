import type { Node } from "./Node.ts";

/** One-line TypeScript-like rendering of a node. */
export function typeText(node: Node): string {
  switch (node.kind) {
    case "string":
      return node.min === 0 && node.max === undefined ? "string" : `string(${node.min}..${node.max ?? ""})`;
    case "number":
    case "int":
      return node.min === undefined && node.max === undefined
        ? node.kind
        : `${node.kind}(${node.min ?? ""}..${node.max ?? ""})`;
    case "boolean":
      return node.kind;
    case "literal":
      return JSON.stringify(node.value);
    case "enum":
      return node.values.map((v) => JSON.stringify(v)).join("|");
    case "id":
      return `id<${node.brand}>`;
    case "nullable":
      return `${typeText(node.inner)} | null`;
    case "optional":
      return typeText(node.inner);
    case "array":
      return `array<${typeText(node.item)}>`;
    case "record":
      return `record<${typeText(node.value)}>`;
    case "union":
      return node.variants.map(typeText).join(" | ");
    case "object":
      return `{ ${Object.entries(node.fields)
        .map(([k, f]) => `${k}${f.kind === "optional" ? "?" : ""}: ${typeText(f)}`)
        .join(", ")} }`;
  }
}
