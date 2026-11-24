// Spec: k.module, the last two Conformance clauses (#21, #22), each quoted whole:
// 21. "Modules `members` (deps `['shopping']`, `public.exports` `['signedIn']`) holding `signedIn.guard.ts` and a page that imports `../shopping/shopping.contract.ts` and links with `shopping.href('shopping.list')`, and `shopping` (deps `['members']`) whose `routes.ts` imports `signedIn` from `../members/signedIn.guard.ts` and binds it as a page's `guard`: one E1153, at the `shopping` entry of `modules/members/module.ts`, message `module deps cycle through guard signedIn: members -> shopping -> members`, `see` `k.guards`. With `signedIn.guard.ts` in module `access` (deps `[]`, `public.exports` `['signedIn']`), `members` listing `['access', 'shopping']` and `shopping` listing `['access']`, each `routes.ts` importing `../access/signedIn.guard.ts` and binding it: no E1153, E1152 or E1165."
// 22. "Modules `a` (deps `['b']`, a file importing `../b/X.ts`) and `b` (deps `['a']`, a file importing `../a/y.guard.ts` and `../a/w.guard.ts`), each `public.exports` naming the files the other imports: one E1153, message `module deps cycle through guard w: a -> b -> a`; with `a` importing `../b/x.guard.ts` as well, `module deps cycle through guard x: a -> b -> a`; with no guard file imported either way, `module deps cycle: a -> b -> a` and `see` `k.module`."
// Rules text of E1153 (k.module), whole item: "E1153 cycle in module `deps`, at the entry of the cycle's smallest module id that names the next module of the cycle (message `module deps cycle: <ids joined by ' -> '>`; when a module of the cycle imports from a `*.guard.*` file of the module after it, `module deps cycle through guard <name>: <ids>` and `see` k.guards, `<name>` the stem of the first such file along the cycle, by path within one edge: k.guards Home)"
// k.guards Home, whole paragraph: "**Home.** A guard lives in a `*.guard.*` file of a module (k.boundary). A `routes.ts` binds it by value import, so a module binding another module's guard lists that module in `deps` (E1152), and that module may then neither list the binder nor link to its pages, since a link imports the binder's contract (k.contract Derived): E1153, naming the guard. A guard bound by modules that link to one another lives in a module of its own, with no pages, whose files are guards and what they import, and whose `deps` reach no module that binds them; each binding module lists it:" followed by the three-module `access` / `members` / `shopping` listing.
// Reading asserted: the 89-character clip is an output concern; at the check level it shows as the guard name sitting wholly inside the first 89 characters of the message.
// Reading asserted: the entry's line and column are those of the quoted id inside `deps: [...]` of module-support's manifest source (the quote opens the entry).
// Seed 1337
import { check } from "@keel/check";
import fc from "fast-check";
import { expect, test } from "vitest";
import { type Files, SEED, codesOf, contractFile, lowerId, manifestFile, manifestSource } from "./module-support.ts";

const guardSource = (name: string, redirect = "members.signin") =>
  `import { guard } from '@keel/router'\nimport { ok } from '@keel/schema'\nexport const ${name} = guard({ redirect: '${redirect}' }, async () => ok(null))\n`;

/** A `routes.ts` of `id` binding `ids`, the first of them guarded by `name` imported from `guardPath`. */
function guardedBinding(id: string, ids: string[], name: string, guardPath: string) {
  const entries = ids.map((r, i) => `  '${r}': { component: Page${i === 0 ? `, guard: ${name}` : ""} },`).join("\n");
  return {
    path: `modules/${id}/routes.ts`,
    source: `import { manifest } from '@keel/router'\nimport { ${id} } from './${id}.contract.ts'\nimport { ${name} } from '${guardPath}'\ndeclare const Page: () => Node\nexport const routes = manifest(${id}, {\n${entries}\n})\n`,
  };
}

const linkPage = {
  path: "modules/members/Signin.ts",
  source:
    "import { shopping } from '../shopping/shopping.contract.ts'\nexport const Signin = shopping.href('shopping.list')\n",
};

/** Where `next` sits as an entry of `deps` in module-support's manifest of `id`: [line, col] (1-based). */
function entryPos(id: string, deps: string[], next: string): [number, number] {
  const lines = manifestSource({ id, deps }).split("\n");
  const at = lines.findIndex((l) => l.includes("deps:"));
  const line = lines[at] ?? "";
  return [at + 1, line.indexOf(`'${next}'`) + 1];
}

const GUARD_MSG = (name: string, ids: string[]) => `module deps cycle through guard ${name}: ${ids.join(" -> ")}`;

const homeCycle = (): Files => [
  manifestFile({ id: "members", deps: ["shopping"], exports: ["signedIn"] }),
  { path: "modules/members/signedIn.guard.ts", source: guardSource("signedIn") },
  linkPage,
  manifestFile({ id: "shopping", deps: ["members"] }),
  contractFile("shopping", ["shopping.list"]),
  guardedBinding("shopping", ["shopping.list"], "signedIn", "../members/signedIn.guard.ts"),
];

const homeOwnModule = (): Files => [
  manifestFile({ id: "access", deps: [], exports: ["signedIn"] }),
  { path: "modules/access/signedIn.guard.ts", source: guardSource("signedIn") },
  manifestFile({ id: "members", deps: ["access", "shopping"] }),
  contractFile("members", ["members.signin", "members.home"]),
  guardedBinding("members", ["members.home", "members.signin"], "signedIn", "../access/signedIn.guard.ts"),
  linkPage,
  manifestFile({ id: "shopping", deps: ["access"] }),
  contractFile("shopping", ["shopping.list"]),
  guardedBinding("shopping", ["shopping.list"], "signedIn", "../access/signedIn.guard.ts"),
];

test("k.module #21: members and shopping linking to one another, the guard in members: one E1153 at the shopping entry of modules/members/module.ts, message through guard signedIn, see k.guards", () => {
  const d = codesOf(homeCycle(), "E1153");
  expect(d.length).toBe(1);
  const [line, col] = entryPos("members", ["shopping"], "shopping");
  expect(d[0]?.path).toBe("modules/members/module.ts");
  expect(d[0]?.line).toBe(line);
  expect(d[0]?.col).toBe(col);
  expect(d[0]?.message).toBe("module deps cycle through guard signedIn: members -> shopping -> members");
  expect(d[0]?.see).toBe("k.guards");
});

test("k.module #21: the guard in its own module access, listed by members and shopping, reports no E1153, E1152 or E1165", () => {
  const files = homeOwnModule();
  const codes = check(files, {}).diagnostics.map((d) => d.code);
  for (const code of ["E1153", "E1152", "E1165"]) expect(codes).not.toContain(code);
});

test("k.guards Home: a guard module with no pages whose deps reach no binder is clean of E1153, E1152 and E1165 for any ids", () => {
  fc.assert(
    fc.property(
      fc.uniqueArray(lowerId, { minLength: 3, maxLength: 3 }),
      fc.stringMatching(/^[a-z][a-zA-Z]{2,12}$/),
      (idList, name) => {
        const [access = "", members = "", shopping = ""] = idList;
        const guardPath = `../${access}/${name}.guard.ts`;
        const files: Files = [
          manifestFile({ id: access, deps: [], exports: [name] }),
          { path: `modules/${access}/${name}.guard.ts`, source: guardSource(name, `${members}.signin`) },
          manifestFile({ id: members, deps: [access, shopping] }),
          contractFile(members, [`${members}.signin`, `${members}.home`]),
          guardedBinding(members, [`${members}.home`, `${members}.signin`], name, guardPath),
          {
            path: `modules/${members}/Signin.ts`,
            source: `import { ${shopping} } from '../${shopping}/${shopping}.contract.ts'\nexport const Signin = ${shopping}.href('${shopping}.list')\n`,
          },
          manifestFile({ id: shopping, deps: [access] }),
          contractFile(shopping, [`${shopping}.list`]),
          guardedBinding(shopping, [`${shopping}.list`], name, guardPath),
        ];
        const codes = check(files, {}).diagnostics.map((d) => d.code);
        for (const code of ["E1153", "E1152", "E1165"]) expect(codes).not.toContain(code);
      },
    ),
    { seed: SEED, numRuns: 25 },
  );
});

/** Files making module `from` import each of `files` (`<stem>.guard.ts`, or `<stem>.ts` when plain) of module `to`; `to` holds them. */
function edge(from: string, to: string, guards: string[], plain: string[] = [], useFile = "use"): Files {
  const targets = [...guards.map((g) => `${g}.guard`), ...plain];
  return [
    ...targets.map((t) => ({
      path: `modules/${to}/${t}.ts`,
      source: `export const ${t.replace(/\.guard$/, "")} = 1\n`,
    })),
    {
      path: `modules/${from}/${useFile}.ts`,
      source: targets
        .map(
          (t, i) =>
            `import { ${t.replace(/\.guard$/, "")} as v${i} } from '../${to}/${t}.ts'\nexport const u${i} = v${i}\n`,
        )
        .join(""),
    },
  ];
}

const abManifests = (aExports: string[], bExports: string[]): Files => [
  manifestFile({ id: "a", deps: ["b"], exports: aExports }),
  manifestFile({ id: "b", deps: ["a"], exports: bExports }),
];

test("k.module #22: b importing y.guard and w.guard of a: one E1153, message through guard w: a -> b -> a", () => {
  const files = [...abManifests(["y", "w"], ["X"]), ...edge("a", "b", [], ["X"]), ...edge("b", "a", ["y", "w"])];
  const d = codesOf(files, "E1153");
  expect(d.length).toBe(1);
  expect(d[0]?.message).toBe(GUARD_MSG("w", ["a", "b", "a"]));
  expect(d[0]?.see).toBe("k.guards");
});

test("k.module #22: with a importing x.guard of b as well, the message is through guard x: a -> b -> a", () => {
  const files = [
    ...abManifests(["y", "w"], ["X", "x"]),
    ...edge("a", "b", ["x"], ["X"]),
    ...edge("b", "a", ["y", "w"]),
  ];
  const d = codesOf(files, "E1153");
  expect(d.length).toBe(1);
  expect(d[0]?.message).toBe(GUARD_MSG("x", ["a", "b", "a"]));
  expect(d[0]?.see).toBe("k.guards");
});

test("k.module #22: with no guard file imported either way, the message is module deps cycle: a -> b -> a and see k.module", () => {
  const files = [...abManifests(["Y"], ["X"]), ...edge("a", "b", [], ["X"]), ...edge("b", "a", [], ["Y"])];
  const d = codesOf(files, "E1153");
  expect(d.length).toBe(1);
  expect(d[0]?.message).toBe("module deps cycle: a -> b -> a");
  expect(d[0]?.see).toBe("k.module");
});

test("E1153 guard edge: a guard imported only by a test file is no guard edge, the plain message stands", () => {
  const files = [
    ...abManifests(["y"], ["X"]),
    ...edge("a", "b", [], ["X"]),
    ...edge("b", "a", ["y"], [], "use.test"),
    ...edge("b", "a", [], ["y2"]),
  ];
  const d = codesOf(files, "E1153");
  expect(d.length).toBe(1);
  expect(d[0]?.message).toBe("module deps cycle: a -> b -> a");
  expect(d[0]?.see).toBe("k.module");
});

const stem = fc.stringMatching(/^[a-z][a-zA-Z]{2,12}$/);
const edgeKind = fc.record({
  guards: fc.uniqueArray(stem, { maxLength: 2 }),
  testOnly: fc.boolean(),
});

test("E1153: for any cycle of generated modules the guard message appears exactly when an edge of the listed cycle is a guard import, naming the first guard of the first guard edge by path", () => {
  fc.assert(
    fc.property(
      fc.uniqueArray(lowerId, { minLength: 2, maxLength: 4 }),
      fc.array(edgeKind, { minLength: 4, maxLength: 4 }),
      (rawIds, kinds) => {
        const ids = [...rawIds].sort();
        const files: Files[number][] = [];
        let expected: string | undefined;
        ids.forEach((id, i) => {
          const next = ids[(i + 1) % ids.length] ?? id;
          const k = kinds[i] ?? { guards: [], testOnly: false };
          files.push(manifestFile({ id, deps: [next], exports: ["Plain", ...k.guards] }));
          files.push(...edge(id, next, [], ["Plain"]));
          if (k.guards.length > 0) {
            files.push(...edge(id, next, k.guards, [], k.testOnly ? "guards.test" : "guards"));
            if (!k.testOnly && expected === undefined) {
              expected = [...k.guards].sort((p, q) => (`${p}.guard.ts` < `${q}.guard.ts` ? -1 : 1))[0];
            }
          }
        });
        const d = codesOf(files, "E1153");
        expect(d.length).toBe(1);
        const cycle = [...ids, ids[0]].join(" -> ");
        if (expected === undefined) {
          expect(d[0]?.message).toBe(`module deps cycle: ${cycle}`);
          expect(d[0]?.see).toBe("k.module");
        } else {
          // OUTPUT.md: "`message` under 90 chars". The text states no clip marker, so a clipped message is asserted by its bound and its guard prefix, an unclipped one by equality.
          const full = `module deps cycle through guard ${expected}: ${cycle}`;
          const msg = d[0]?.message ?? "";
          expect(msg.length).toBeLessThan(90);
          if (full.length < 90) expect(msg).toBe(full);
          expect(msg.startsWith(`module deps cycle through guard ${expected}:`)).toBe(true);
          expect(d[0]?.see).toBe("k.guards");
        }
        const [line, col] = entryPos(ids[0] ?? "", [ids[1 % ids.length] ?? ""], ids[1 % ids.length] ?? "");
        expect(d[0]?.path).toBe(`modules/${ids[0]}/module.ts`);
        expect([d[0]?.line, d[0]?.col]).toEqual([line, col]);
      },
    ),
    { seed: SEED, numRuns: 25 },
  );
});

test("E1153: a long guard name or a long cycle never cuts the guard name within the first 89 characters of the message", () => {
  fc.assert(
    fc.property(
      fc.stringMatching(/^[a-z][a-zA-Z]{20,28}$/),
      fc.uniqueArray(fc.stringMatching(/^[a-z]{12}$/), { minLength: 5, maxLength: 6 }),
      (name, rawIds) => {
        const ids = [...rawIds].sort();
        const files: Files[number][] = [];
        ids.forEach((id, i) => {
          const next = ids[(i + 1) % ids.length] ?? id;
          files.push(manifestFile({ id, deps: [next], exports: [name, "Plain"] }));
          files.push(...edge(id, next, i === ids.length - 1 ? [name] : [], i === ids.length - 1 ? [] : ["Plain"]));
        });
        const d = codesOf(files, "E1153");
        expect(d.length).toBe(1);
        const msg = d[0]?.message ?? "";
        // OUTPUT.md: "`message` under 90 chars"; the guard comes before the cycle (RFC 0212 D4).
        expect(GUARD_MSG(name, [...ids, ids[0] ?? ""]).length).toBeGreaterThan(89);
        expect(msg.length).toBeLessThan(90);
        expect(msg.includes(name)).toBe(true);
        expect(msg.startsWith(`module deps cycle through guard ${name}:`)).toBe(true);
      },
    ),
    { seed: SEED, numRuns: 25 },
  );
});
