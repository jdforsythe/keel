import { describe, expect, test } from "vitest";
import { sourceForm } from "../src/internal/sourceForm.ts";
import { sourceHash } from "../src/internal/sourceHash.ts";

const FIXED = [
  "import { b, a as z } from 'xs'",
  "import './p.ts'",
  "export const k = { first: 1, 'two': `t${z}`, r: /a/gi }",
  "export default function V() { return <p>Hi {'there'}</p> }",
  "",
].join("\n");

describe("sourceHash", () => {
  test("pins the form of a fixed source to an exact hash", () => {
    expect(sourceHash("x.tsx", FIXED)).toBe("fnv1a:318d003b");
  });
  test("a file that does not parse has no form", () => {
    expect(sourceForm("x.ts", "export const = ;")).toBeUndefined();
    expect(sourceHash("x.ts", "export const = ;")).toBeUndefined();
  });
  test("import {} from is a side-effect import", () => {
    expect(sourceHash("x.ts", "import {} from './p.ts'\n")).toBe(sourceHash("x.ts", "import './p.ts'\n"));
  });
});
