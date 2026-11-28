// Spec: k.scaffold-needs, clause "In a fresh `client`, `static` and `node` app from `pnpm create @keel/app`, `keel scaffold <g>` with no argument, for `module`, `route`, `component`, `store` and `service`, is E1052 ending `keel scaffold module orders`, `route app.about`, `component app/OrderCard`, `store app.cart` and `service app --base https://a.test` (with ` --reason geo` in the `client` app alone, whose `client` deployable E1358 binds; the `static` and `node` apps' lines hold none); each line run as printed there exits 0."
// Spec: k.scaffold-needs, clause "In a fresh app of each kind, `keel scaffold transaction` with no argument, and `transaction app.cart.addItem`, are E1052 `transaction needs a store first: keel scaffold store app.cart`; after that line exits 0, `transaction` with no argument ends `keel scaffold transaction app.cart.addItem`, which exits 0. `transaction orders.cart.addItem` there is E1052 `orders is not a module of this project`."
// Spec: k.scaffold-needs, clause "In a fresh `client` app `keel scaffold shell` with no argument ends `keel scaffold shell tauri --id com.acme.shop`, which exits 0. In a fresh `static` and `node` app it is E1052 `shell needs a client deployable, and this project has none`, and `shell tauri --id com.acme.shop` is E1359 `no client deployable; a tauri shell needs one`, each `see` k.topology, holding no `keel scaffold` or `keel codemod` line, and writing nothing."
// Spec: k.scaffold-needs, clause "In each of those apps, after each line a bullet above runs, every file and every `topology.ts` deployable the app held before is still there."
// Spec: k.scaffold-needs, clause "In a project holding route `app.about`, `keel scaffold route` with no argument ends `keel scaffold route app.about2`."
// Spec: k.scaffold-needs, clause "In a fresh `client` and `static` app, `keel scaffold route app.ping --api`, with and without `--method POST`, is E1353 naming E1511 whose message holds `an API route needs a node deployable`, and writes nothing; in a fresh `node` app each exits 0 and `keel check` is then clean."
// Spec: k.scaffold-needs, clause "In a fresh library from `pnpm create @keel/app charts --library @acme/charts`, `keel scaffold <g>` for `module`, `route`, `component`, `store`, `transaction`, `service` and `shell`, with no argument and with the argument of the `client` app's line, is one E1052 `a library has no modules; write a component in src/ and export it from src/index.ts`, holding no `keel scaffold` or `keel codemod` line, and writes nothing."
// Seed 1337 (fast-check, recorded). The real `keel` binary in compact output over the projects `create-app` writes for `client`, `static`, `node` and a library
// (scaffold-needs-support.ts); each printed line is run as written, in a fresh copy of the project it was printed for.
// ASSUMED: a printed line is the rest of the output line from `keel scaffold`; "ends" means the output line ends with it; "writes nothing" is the file tree
// (without node_modules) equal before and after; "see k.topology" is the text `k.topology` in the output; a library's refusal is "one E1052" when `E1052` occurs once.
// ASSUMED: `service`'s ` --reason geo` is expected in the `client` app only, as the first clause says; `static` and `node` print the line without it.
import fc from "fast-check";
import { afterAll, describe, expect, it } from "vitest";
import { SEED, apply } from "./fixtures.ts";
import { materialize, cleanup, readTree } from "./keel-cli.ts";
import {
  APPS,
  type App,
  BOUND,
  cleanAll,
  deployables,
  endsWithLine,
  fresh,
  holdsNoLine,
  printedLines,
  runLine,
  scaffold,
} from "./scaffold-needs-support.ts";

afterAll(cleanAll);

const SERVICE: Record<App, string> = {
  client: "keel scaffold service app --base https://a.test --reason geo",
  static: "keel scaffold service app --base https://a.test",
  node: "keel scaffold service app --base https://a.test",
};
const FIRST_LINES: [string, string][] = [
  ["module", "keel scaffold module orders"],
  ["route", "keel scaffold route app.about"],
  ["component", "keel scaffold component app/OrderCard"],
  ["store", "keel scaffold store app.cart"],
];
const linesFor = (app: App): [string, string][] => [...FIRST_LINES, ["service", SERVICE[app]]];
const NEEDS_STORE = "transaction needs a store first: keel scaffold store app.cart";
const NO_CLIENT = "shell needs a client deployable, and this project has none";
const LIBRARY = "a library has no modules; write a component in src/ and export it from src/index.ts";
const CLIENT_LINES: Record<string, string> = {
  module: "module orders",
  route: "route app.about",
  component: "component app/OrderCard",
  store: "store app.cart",
  transaction: "transaction app.cart.addItem",
  service: "service app --base https://a.test --reason geo",
  shell: "shell tauri --id com.acme.shop",
};
const split = (s: string): string[] => s.split(" ");

describe("k.scaffold-needs: fresh app, a generator with no argument", () => {
  for (const app of APPS) {
    it(
      `In a fresh \`${app}\` app, \`keel scaffold <g>\` with no argument, for \`module\`, \`route\`, \`component\`, \`store\` and \`service\`, is E1052 ending the line the spec gives; each line run as printed there exits 0`,
      () => {
        for (const [g, line] of linesFor(app)) {
          const dir = fresh(app);
          const before = readTree(dir);
          const r = scaffold(dir, [g]);
          expect(r.status, r.out).not.toBe(0);
          expect(r.out, g).toContain("E1052");
          expect(endsWithLine(r.out, line), `${g}: ${r.out}`).toBe(true);
          expect(readTree(dir), `${g} wrote`).toEqual(before);
          const run = runLine(dir, line);
          expect(run.status, `${line}\n${run.out}`).toBe(0);
        }
      },
      BOUND * 2,
    );
  }
});

describe("k.scaffold-needs: transaction needs a store first", () => {
  for (const app of APPS) {
    it(
      `In a fresh \`${app}\` app, \`transaction\` with no argument and \`transaction app.cart.addItem\` are E1052 \`${NEEDS_STORE}\`; after that line exits 0, \`transaction\` ends \`keel scaffold transaction app.cart.addItem\`, which exits 0; \`transaction orders.cart.addItem\` is E1052 \`orders is not a module of this project\``,
      () => {
        for (const args of [["transaction"], ["transaction", "app.cart.addItem"]]) {
          const dir = fresh(app);
          const before = readTree(dir);
          const r = scaffold(dir, args);
          expect(r.status, r.out).not.toBe(0);
          expect(r.out).toContain("E1052");
          expect(endsWithLine(r.out, NEEDS_STORE), r.out).toBe(true);
          expect(readTree(dir)).toEqual(before);
        }
        const dir = fresh(app);
        const first = runLine(dir, "keel scaffold store app.cart");
        expect(first.status, first.out).toBe(0);
        const again = scaffold(dir, ["transaction"]);
        expect(again.out).toContain("E1052");
        expect(endsWithLine(again.out, "keel scaffold transaction app.cart.addItem"), again.out).toBe(true);
        const run = runLine(dir, "keel scaffold transaction app.cart.addItem");
        expect(run.status, run.out).toBe(0);
        const other = fresh(app);
        const bad = scaffold(other, ["transaction", "orders.cart.addItem"]);
        expect(bad.status).not.toBe(0);
        expect(bad.out).toContain("E1052");
        expect(bad.out).toContain("orders is not a module of this project");
        expect(holdsNoLine(bad.out), bad.out).toBe(true);
      },
      BOUND * 2,
    );
  }
});

describe("k.scaffold-needs: shell", () => {
  it(
    "In a fresh `client` app `keel scaffold shell` with no argument ends `keel scaffold shell tauri --id com.acme.shop`, which exits 0",
    () => {
      const dir = fresh("client");
      const r = scaffold(dir, ["shell"]);
      expect(r.status, r.out).not.toBe(0);
      expect(endsWithLine(r.out, "keel scaffold shell tauri --id com.acme.shop"), r.out).toBe(true);
      const run = runLine(dir, "keel scaffold shell tauri --id com.acme.shop");
      expect(run.status, run.out).toBe(0);
    },
    BOUND,
  );
  for (const app of ["static", "node"] as const) {
    it(
      `In a fresh \`${app}\` app \`shell\` is E1052 \`${NO_CLIENT}\` and \`shell tauri --id com.acme.shop\` is E1359 \`no client deployable; a tauri shell needs one\`, each \`see\` k.topology, holding no \`keel scaffold\` or \`keel codemod\` line, and writing nothing`,
      () => {
        const dir = fresh(app);
        const before = readTree(dir);
        const a = scaffold(dir, ["shell"]);
        expect(a.status, a.out).not.toBe(0);
        expect(a.out).toContain("E1052");
        expect(a.out).toContain(NO_CLIENT);
        expect(a.out).toContain("k.topology");
        expect(holdsNoLine(a.out), a.out).toBe(true);
        const b = scaffold(dir, ["shell", "tauri", "--id", "com.acme.shop"]);
        expect(b.status, b.out).not.toBe(0);
        expect(b.out).toContain("E1359");
        expect(b.out).toContain("no client deployable; a tauri shell needs one");
        expect(b.out).toContain("k.topology");
        expect(holdsNoLine(b.out), b.out).toBe(true);
        expect(readTree(dir)).toEqual(before);
      },
      BOUND,
    );
  }
});

describe("k.scaffold-needs: a printed line only adds", () => {
  for (const app of APPS) {
    it(
      `In a fresh \`${app}\` app, after each line a bullet above runs, every file and every \`topology.ts\` deployable the app held before is still there`,
      () => {
        const dir = fresh(app);
        const ops = ["module", "route", "component", "store", "service", "transaction", "transaction", "shell"];
        let ran = 0;
        for (const g of ops) {
          const r = scaffold(dir, [g]);
          const line = printedLines(r.out).at(-1);
          if (line === undefined) continue; // shell in static and node: no line, nothing to run
          const before = readTree(dir);
          const decl = deployables(before.get("topology.ts") ?? "");
          expect(decl.length, "topology.ts deployables read").toBeGreaterThan(0);
          const run = runLine(dir, line);
          expect(run.status, `${line}\n${run.out}`).toBe(0);
          ran += 1;
          const after = readTree(dir);
          for (const path of before.keys()) expect(after.has(path), `${line} removed ${path}`).toBe(true);
          const kept = deployables(after.get("topology.ts") ?? "");
          for (const d of decl) expect(kept, `${line} removed deployable ${d}`).toContain(d);
        }
        expect(ran).toBe(app === "client" ? 8 : 7);
      },
      BOUND * 4,
    );
  }
});

describe("k.scaffold-needs: the next route name", () => {
  it(
    "In a project holding route `app.about`, `keel scaffold route` with no argument ends `keel scaffold route app.about2`",
    () => {
      const files = apply("route", { id: "app.about" }, readTree(fresh("client"))).files;
      const dir = materialize(files);
      try {
        const r = scaffold(dir, ["route"]);
        expect(r.status, r.out).not.toBe(0);
        expect(endsWithLine(r.out, "keel scaffold route app.about2"), r.out).toBe(true);
      } finally {
        cleanup(dir);
      }
    },
    BOUND,
  );

  it(
    "with `app.about` to `app.about<n>` held, `keel scaffold route` ends the next of `about2` to `about9`, and that line exits 0",
    () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 8 }), (n) => {
          let files = readTree(fresh("client"));
          for (let i = 1; i <= n; i += 1) files = apply("route", { id: `app.about${i === 1 ? "" : i}` }, files).files;
          const dir = materialize(files);
          try {
            const r = scaffold(dir, ["route"]);
            const line = `keel scaffold route app.about${n + 1}`;
            expect(endsWithLine(r.out, line), r.out).toBe(true);
            const run = runLine(dir, line);
            expect(run.status, run.out).toBe(0);
          } finally {
            cleanup(dir);
          }
        }),
        { seed: SEED, numRuns: 4 },
      );
    },
    BOUND * 2,
  );
});

describe("k.scaffold-needs: route --api", () => {
  for (const app of ["client", "static"] as const) {
    it(
      `In a fresh \`${app}\` app, \`keel scaffold route app.ping --api\`, with and without \`--method POST\`, is E1353 naming E1511 whose message holds \`an API route needs a node deployable\`, and writes nothing`,
      () => {
        for (const extra of [[], ["--method", "POST"]]) {
          const dir = fresh(app);
          const before = readTree(dir);
          const r = scaffold(dir, ["route", "app.ping", "--api", ...extra]);
          expect(r.status, r.out).not.toBe(0);
          expect(r.out).toContain("E1353");
          expect(r.out).toContain("E1511");
          expect(r.out).toContain("an API route needs a node deployable");
          expect(readTree(dir)).toEqual(before);
        }
      },
      BOUND * 2,
    );
  }
  it(
    "in a fresh `node` app each exits 0 and `keel check` is then clean",
    () => {
      for (const extra of [[], ["--method", "POST"]]) {
        const dir = fresh("node");
        const r = scaffold(dir, ["route", "app.ping", "--api", ...extra]);
        expect(r.status, r.out).toBe(0);
        const c = runLine(dir, "keel check");
        expect(c.status, c.out).toBe(0);
        expect(c.out).not.toMatch(/\b[EW]\d{4}\b/);
      }
    },
    BOUND * 2,
  );
});

describe("k.scaffold-needs: a library", () => {
  const GENS = Object.keys(CLIENT_LINES);
  it(
    "In a fresh library, `keel scaffold <g>` for `module`, `route`, `component`, `store`, `transaction`, `service` and `shell`, with no argument and with the argument of the `client` app's line, is one E1052 `a library has no modules`, holding no `keel scaffold` or `keel codemod` line, and writes nothing",
    () => {
      for (const g of GENS) {
        for (const args of [[g], split(CLIENT_LINES[g] ?? g)]) {
          const dir = fresh("library");
          const before = readTree(dir);
          const r = scaffold(dir, args);
          const where = `${args.join(" ")}\n${r.out}`;
          expect(r.status, where).not.toBe(0);
          expect(r.out.match(/E1052/g)?.length, where).toBe(1);
          expect(r.out, where).toContain(LIBRARY);
          expect(holdsNoLine(r.out), where).toBe(true);
          expect(readTree(dir), where).toEqual(before);
        }
      }
    },
    BOUND * 4,
  );
  it(
    "in a fresh library, any generator given any one name is the same one E1052 and writes nothing",
    () => {
      fc.assert(
        fc.property(fc.constantFrom(...GENS), fc.stringMatching(/^[a-z]{3,8}$/), (g, name) => {
          const dir = fresh("library");
          const before = readTree(dir);
          const r = scaffold(dir, [g, name]);
          expect(r.status, r.out).not.toBe(0);
          expect(r.out.match(/E1052/g)?.length, r.out).toBe(1);
          expect(r.out).toContain(LIBRARY);
          expect(holdsNoLine(r.out), r.out).toBe(true);
          expect(readTree(dir)).toEqual(before);
        }),
        { seed: SEED, numRuns: 6 },
      );
    },
    BOUND * 2,
  );
});

describe("k.scaffold-needs: the table", () => {
  type Line = "example" | "first" | "none";
  const rows: [string, string[], string, Line][] = [
    ["module", ["module"], "E1052", "example"],
    ["route", ["route"], "E1052", "example"],
    ["component", ["component"], "E1052", "example"],
    ["store", ["store"], "E1052", "example"],
    ["service", ["service"], "E1052", "example"],
    ["transaction", ["transaction"], "E1052", "first"],
    ["transaction with a store missing", ["transaction", "app.cart.addItem"], "E1052", "first"],
    ["transaction in a module the project lacks", ["transaction", "orders.cart.addItem"], "E1052", "none"],
  ];
  for (const app of APPS) {
    it(
      `In a \`${app}\` app each generator's diagnostic prints its code and an example line, a \`first:\` line or no line, and every line printed, run as written in the same project, exits 0`,
      () => {
        const all: [string, string[], string, Line][] = [...rows];
        all.push(app === "client" ? ["shell", ["shell"], "E1052", "example"] : ["shell", ["shell"], "E1052", "none"]);
        if (app !== "client")
          all.push(["shell with a shell", ["shell", "tauri", "--id", "com.acme.shop"], "E1359", "none"]);
        for (const [name, args, code, kind] of all) {
          const dir = fresh(app);
          const r = scaffold(dir, args);
          const where = `${name}\n${r.out}`;
          expect(r.status, where).not.toBe(0);
          expect(r.out, where).toContain(code);
          const lines = printedLines(r.out);
          if (kind === "none") expect(holdsNoLine(r.out), where).toBe(true);
          else expect(lines.length, where).toBeGreaterThan(0);
          if (kind === "first") {
            expect(r.out, where).toContain("first: keel scaffold store app.cart");
            expect(r.out, where).not.toContain("keel scaffold transaction");
          }
          if (kind === "example") expect(r.out, where).not.toContain("first:");
          for (const line of lines) {
            const run = runLine(dir, line);
            expect(run.status, `${where}\nrun ${line}\n${run.out}`).toBe(0);
          }
        }
      },
      BOUND * 4,
    );
  }
});
