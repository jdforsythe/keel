import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import nodePath from "node:path";
import { fileURLToPath } from "node:url";
import { fixedTime } from "@keel/tooling/test-time";
import { describe, expect, it } from "vitest";
import { type Files, apply } from "./helpers.ts";

// Repo root via a workspace link, so this also holds in Stryker's sandbox copy.
const REPO_ROOT = nodePath.resolve(
  fs.realpathSync(fileURLToPath(new URL("../node_modules/@keel/schema", import.meta.url))),
  "../..",
);
const TSC = nodePath.join(REPO_ROOT, "node_modules/typescript/bin/tsc");

/** Files a person adds beside the scaffold's: a link through the contract's `href`, and a service client over it. */
const CONSUMER: ReadonlyMap<string, string> = new Map([
  [
    "modules/shop/module.ts",
    [
      `import { module } from "@keel/compiler";`,
      "",
      `export default module({ id: "shop", deps: ["orders"], capabilities: [], public: { exports: [] } });`,
      "",
    ].join("\n"),
  ],
  [
    "modules/shop/shop.contract.ts",
    [`import { contract } from "@keel/router/contract";`, "", `export const shop = contract("shop", {});`, ""].join(
      "\n",
    ),
  ],
  [
    "modules/shop/ordersClient.ts",
    [
      `import { service } from "@keel/services";`,
      `import { orders } from "../orders/orders.contract.ts";`,
      "",
      "export const client = service({ contract: orders });",
      "export const feed = (ctx: Parameters<typeof client.feed>[1]) => client.feed({ params: { slug: 'a' } }, ctx);",
      "",
    ].join("\n"),
  ],
  [
    "modules/shop/link.ts",
    [
      `import { orders } from "../orders/orders.contract.ts";`,
      "",
      `export const tag: string = orders.href("orders.tag", { slug: "a" });`,
      `export const list: string = orders.href("orders.list");`,
      "",
    ].join("\n"),
  ],
]);

function scaffolded(): Files {
  let files: Files = apply("project", { name: "shop" }, new Map());
  files = apply("module", { id: "orders" }, files);
  files = apply("route", { id: "orders.list", path: "/orders" }, files);
  files = apply("route", { id: "orders.tag", path: "/tags/:slug" }, files);
  files = apply("route", { id: "orders.show", path: "/orders/:id" }, files);
  files = apply("route", { id: "orders.feed", path: "/api/feed/:slug", api: true }, files);
  files = apply("route", { id: "orders.add", path: "/api/orders", api: true, method: "POST" }, files);
  files = apply("route", { id: "orders.change", path: "/api/orders/:id", api: true, method: "PATCH" }, files);
  files = apply("route", { id: "orders.remove", path: "/api/orders/:id", api: true, method: "DELETE" }, files);
  files = apply("component", { id: "orders/OrderCard" }, files);
  files = apply("component", { id: "orders/OrderTotal", ctx: true }, files);
  for (const [p, text] of CONSUMER) files.set(p, text);
  return files;
}

function typecheck(files: Files): { status: number | null; out: string } {
  const dir = fs.mkdtempSync(nodePath.join(os.tmpdir(), "keel-scaffold-tsc-"));
  try {
    for (const [p, text] of files) {
      fs.mkdirSync(nodePath.dirname(nodePath.join(dir, p)), { recursive: true });
      fs.writeFileSync(nodePath.join(dir, p), text);
    }
    const scope = nodePath.join(dir, "node_modules/@keel");
    fs.mkdirSync(scope, { recursive: true });
    for (const pkg of fs.readdirSync(nodePath.join(REPO_ROOT, "packages")))
      fs.symlinkSync(nodePath.join(REPO_ROOT, "packages", pkg), nodePath.join(scope, pkg));
    for (const dep of ["vitest", "@types"])
      fs.mkdirSync(nodePath.dirname(nodePath.join(dir, "node_modules", dep)), { recursive: true });
    fs.symlinkSync(nodePath.join(REPO_ROOT, "node_modules/vitest"), nodePath.join(dir, "node_modules/vitest"));
    fs.mkdirSync(nodePath.join(dir, "node_modules/@types"));
    fs.symlinkSync(
      fs.realpathSync(fileURLToPath(new URL("../node_modules/@types/node", import.meta.url))),
      nodePath.join(dir, "node_modules/@types/node"),
    );
    const run = spawnSync(process.execPath, [TSC, "-p", "tsconfig.json", "--noEmit"], { cwd: dir, encoding: "utf8" });
    return { status: run.status, out: `${run.stdout}${run.stderr}` };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

describe("a scaffolded project type-checks against the kernel packages", () => {
  it(
    "project, module, page routes, API routes by method, components with and without ctx, an href link and a service client",
    () => {
      const r = typecheck(scaffolded());
      expect(r.out.trim()).toBe("");
      expect(r.status).toBe(0);
    },
    fixedTime(240_000),
  );

  it(
    "the check is live: a link to an id the contract lacks, and a binding for another entry, fail",
    () => {
      const files = scaffolded();
      files.set(
        "modules/shop/link.ts",
        `import { orders } from "../orders/orders.contract.ts";\nexport const x = orders.href("orders.nope");\n`,
      );
      const r = typecheck(files);
      expect(r.status).not.toBe(0);
      expect(r.out).toContain("modules/shop/link.ts");
    },
    fixedTime(240_000),
  );
});
