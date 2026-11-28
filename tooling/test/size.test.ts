// The size tool (size.mjs): a browser entry is measured as a browser build loads it, each server-only file as the stub
// the compiler's `browserStub` makes, and a node entry counts everything.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { browserStub } from "../../packages/compiler/src/internal/browserStub.ts";
import { bundleOf, entryOf, gzipBytes } from "../size.mjs";
import { tempDir } from "../test-tmp.ts";

const SECRET = "ingest-only-the-server-runs";
/** Server code with little to compress, so the stub is the smaller of the two. */
const BODY = Array.from({ length: 200 }, (_, i) =>
  JSON.stringify(`row-${(i * 7919) % 10007}-${(i * 104729) % 1299709}`),
).join(", ");

/** A throwaway project: an entry importing `ingest.server.ts`, a `reader.guard.ts` and a plain file. */
function project(): string {
  const root = tempDir("keel-size-");
  const write = (file: string, text: string): void => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  };
  write(
    "entry.ts",
    'import { ingest } from "./ingest.server.ts";\nimport reader from "./reader.guard.ts";\nimport { shared } from "./shared.ts";\nexport const routes = { ingest, reader, shared };\n',
  );
  write(
    "ingest.server.ts",
    `const table = [${BODY}];\nexport const ingest = (rows: string[]): string => rows.map((r) => r + "${SECRET}" + table.join()).join(String(rows.length));\nexport default 1;\n`,
  );
  write("reader.guard.ts", "export default function reader(): string { return 'guard-body-the-server-runs'; }\n");
  write("shared.ts", 'export const shared = "shared-with-the-browser";\n');
  return path.join(root, "entry.ts");
}

describe("the size tool", () => {
  it("bundles a browser entry with each server-only file as its stub", async () => {
    const entry = project();
    const text = Buffer.from(await bundleOf(entry, "browser")).toString("utf8");
    expect(text).not.toContain(SECRET);
    expect(text).not.toContain("guard-body-the-server-runs");
    expect(text).toContain("shared-with-the-browser");
    expect(text).toContain("serverOnly");
    expect(text).toContain("@keel/router/internal");
  });

  it("counts the server-only code in a node entry", async () => {
    const entry = project();
    const text = Buffer.from(await bundleOf(entry, "node")).toString("utf8");
    expect(text).toContain(SECRET);
    expect(text).not.toContain("serverOnly");
  });

  it("measures a browser entry smaller than the same entry on node", async () => {
    const entry = project();
    expect(await gzipBytes(entry, "browser")).toBeLessThan(await gzipBytes(entry, "node"));
  });

  it("loads a server-only file through the compiler's browserStub, not a copy", async () => {
    const entry = project();
    const server = path.join(path.dirname(entry), "ingest.server.ts");
    const stub = browserStub(server, server, "ingest.server.ts", "@keel/router/internal");
    expect(stub).toContain('"ingest"');
    const text = Buffer.from(await bundleOf(entry, "browser")).toString("utf8");
    expect(text).toContain("ingest.server.ts");
  });

  it("finds a budget entry's source: a package's index, a subpath file", () => {
    const root = path.join(import.meta.dirname, "..", "..");
    expect(entryOf(root, "@keel/schema")).toBe(path.join(root, "packages", "schema", "src", "index.ts"));
    expect(entryOf(root, "@keel/std-sessions/routes")).toBe(
      path.join(root, "packages", "std-sessions", "src", "routes.ts"),
    );
    expect(entryOf(root, "@keel/not-a-package")).toBeUndefined();
  });
});
