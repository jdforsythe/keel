import type { SchemaError } from "@keel/schema";
import type { SchemaNode as Node } from "./SchemaNode.ts";
import { unwrapNode } from "./unwrapNode.ts";

type Rule = SchemaError["data"]["issues"][number]["rule"];

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Copy of @keel/forms messageFor (router precedes forms in deps order, D30). One-line message for a broken rule, using the constraint from the schema node at the issue path. */
export function messageFor(node: Node | undefined, rule: Rule): string {
  const n = node === undefined ? undefined : unwrapNode(node);
  switch (rule) {
    case "required":
    case "nullable-absent":
    case "secret-missing":
      return "Required";
    case "optional-null":
      return "Must not be null";
    case "finite":
      return "Must be a finite number";
    case "int":
      return "Must be a whole number";
    case "min":
      return n?.kind === "string" ? `Must be at least ${plural(n.min, "character")}` : "Required";
    case "max":
      return n?.kind === "string" && n.max !== undefined ? `Must be at most ${plural(n.max, "character")}` : "Too long";
    case "literal":
      return n?.kind === "literal" ? `Must be ${JSON.stringify(n.value)}` : "Invalid value";
    case "enum":
      return n?.kind === "enum" ? `Must be one of: ${n.values.join(", ")}` : "Invalid choice";
    case "discriminant":
      return "Invalid choice";
    case "format":
    case "json":
      return "Invalid value";
    case "unknown-key":
      return "Unknown field";
    case "type":
      return typeText(n);
  }
}

function typeText(n: Node | undefined): string {
  switch (n?.kind) {
    case "number":
    case "int":
      return "Must be a number";
    case "boolean":
      return "Must be true or false";
    case "string":
    case "id":
      return "Must be text";
    case "enum":
      return `Must be one of: ${n.values.join(", ")}`;
    default:
      return "Invalid value";
  }
}
