import { expect, test } from "vitest";
import { codes } from "./support.ts";

const server = { path: "db.server.ts", source: `export const secret = 1` };

test("E1004: a *.server.ts module imported from client-reachable code produces a diagnostic", () => {
  const d = codes(`import { secret } from './db.server'\nexport default function C() { return <p>{secret}</p> }`, "C.tsx", [server]);
  const hit = d.filter((x) => x.code === "E1004");
  expect(hit.length).toBe(1);
  expect(hit[0]?.path).toBe("C.tsx");
});

test("E1004: a *.server.ts module imported from another server module emits no E1004", () => {
  const d = codes(`import { secret } from './db.server'\nexport const x = secret`, "api.server.ts", [server]);
  expect(d.map((x) => x.code)).not.toContain("E1004");
});
