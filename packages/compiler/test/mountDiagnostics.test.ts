// k.mount Rules, the whole diagnostics of mountDiags: E1580, E1581, E1582, E1584 and E1589 with their place, message
// and `see`, and what is not reported. Seed 1337 for the property.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { mountDiags } from "../src/hosting/mountDiags.ts";

const MOUNT = "import { identityMount } from '@keel/router'\nexport default identityMount('/api/auth')\n";
const SERVER =
  "import { identity } from '@keel/server'\nimport mount from './identity.ts'\nexport default identity({ identify: async () => '', handle: { path: mount.path, fn: () => new Response('') } })\n";
const base = [
  { path: "identity.ts", source: MOUNT },
  { path: "identity.server.ts", source: SERVER },
];
const topology = (body: string) => ({
  path: "topology.ts",
  source: `import { topology } from '@keel/server'\nexport default topology({\n${body}\n})\n`,
});
const API = "  api: { modules: ['b'], adapter: 'node' },";
const STATIC = "  site: { modules: ['shop'], adapter: 'static' },";
const CLIENT = "  web: { modules: ['shop'], adapter: 'client' },";
const E1589_STATIC =
  "site (static) serves no router, so with identity.ts its pages never learn the reader";
const E1589_CLIENT =
  "web (client) has no servedBy: no origin of it mounts the identity handle";
const use = (path: string, source: string) => ({ path, source });
const codes = (files: { path: string; source: string }[]): string[] => mountDiags(files).map((d) => d.code);

describe("mountDiags diagnostics", () => {
  it("E1580 at 1:1 of identity.ts when identity.server.ts is absent or mounts nothing", () => {
    const want = [
      {
        code: "E1580",
        path: "identity.ts",
        line: 1,
        col: 1,
        message: "identity.server.ts gives no handle: { path: <identity.ts default import>.path }",
        see: "k.mount",
      },
    ];
    expect(mountDiags([{ path: "identity.ts", source: MOUNT }])).toEqual(want);
    expect(
      mountDiags([
        { path: "identity.ts", source: MOUNT },
        { path: "identity.server.ts", source: "export default 1\n" },
      ]),
    ).toEqual(want);
    expect(mountDiags(base)).toEqual([]);
  });

  it("E1580 for an unreadable identity.ts carries the read's own message", () => {
    const [d, ...rest] = mountDiags([{ path: "identity.ts", source: "export default 1\n" }, ...base.slice(1)]);
    expect(rest).toEqual([]);
    expect(d).toMatchObject({ code: "E1580", path: "identity.ts", line: 1, col: 1, see: "k.mount" });
    expect(d?.message).not.toBe("");
    expect(d?.message).not.toContain("identity.server.ts gives no handle");
  });

  it("E1584 points into identity.ts and sees k.mount", () => {
    const source = MOUNT.replace("('/api/auth')", "('/api/auth', { links: [''] })");
    const diags = mountDiags([{ path: "identity.ts", source }, ...base.slice(1)]);
    expect(diags).toHaveLength(1);
    expect(diags[0]).toMatchObject({ code: "E1584", path: "identity.ts", line: 2, see: "k.mount" });
    expect(diags[0]?.message).not.toBe("");
  });

  it("E1581 at the import, naming the deployable, its adapter and the module", () => {
    const page = use(
      "modules/shop/page.ts",
      "import { x } from './x.ts'\n  import mount from '../../identity'\nexport const y = mount.path\n",
    );
    expect(mountDiags([...base, topology(`${API}\n${STATIC}`), page])).toEqual([
      {
        code: "E1581",
        path: "modules/shop/page.ts",
        line: 2,
        col: 3,
        message: "site (static) serves module shop, whose origin mounts no handle",
        see: "k.mount",
      },
    ]);
    expect(mountDiags([...base, topology(`${API}\n${CLIENT}`), page]).map((d) => d.message)).toEqual([
      "web (client) serves module shop, whose origin mounts no handle",
    ]);
  });

  it("E1581 only for a file of a module the deployable lists", () => {
    const top = topology(`${API}\n${STATIC}`);
    const source = (from: string): string => `import mount from '${from}'\nexport const y = mount.path\n`;
    for (const page of [
      use("main.ts", source("./identity")),
      use("lib/modules/shop/page.ts", source("../../../identity.ts")),
      use("modules/s/page.ts", source("../../identity.ts")),
      use("modules/b/page.ts", source("../../identity.ts")),
      use("modules/shop.ts", source("../identity.ts")),
    ])
      expect(
        mountDiags([...base, top, page]).map((d) => [d.code, d.path]),
        page.path,
      ).toEqual([["E1589", "topology.ts"]]);
    expect(codes([...base, top, use("modules/shop/deep/page.ts", source("../../../identity.ts"))])).toEqual(["E1581"]);
  });

  it("reads .ts and .tsx files only, each in its own syntax", () => {
    const top = topology(`${API}\n${STATIC}`);
    const source = "import mount from '../../identity'\nexport const y = mount.href('/a?')\n";
    for (const path of [
      "modules/shop/page.js",
      "modules/shop/page.ts.bak",
      "modules/shop/page.tsxx",
      "modules/shop/page.mts.txt",
    ])
      expect(codes([...base, top, use(path, source)]), path).toEqual(["E1589"]);
    expect(codes([...base, top, use("modules/shop/page.ts", source)])).toEqual(["E1581", "E1582"]);
    expect(
      codes([
        ...base,
        top,
        use(
          "modules/shop/page.tsx",
          "import mount from '../../identity'\nexport const Page = () => <a href={mount.href('/a?')}>in</a>\n",
        ),
      ]),
    ).toEqual(["E1581", "E1582"]);
    expect(
      codes([
        ...base,
        top,
        use(
          "modules/shop/x.ts",
          "import mount from '../../identity'\nconst v = <string>(<unknown>1)\nexport const y = mount.href('/a?') + v\n",
        ),
      ]),
    ).toEqual(["E1581", "E1582"]);
  });

  it("E1582 at the call, quoting the subpath cut to thirty characters", () => {
    const page = use(
      "modules/shop/page.ts",
      "import mount from '../../identity.ts'\nexport const y = [\n  mount.href('/a b'),\n  mount.href('/ok'),\n  mount.href(''),\n  mount.href('/0123456789/0123456789/0123456789?'),\n]\n",
    );
    expect(mountDiags([...base, page])).toEqual([
      {
        code: "E1582",
        path: "modules/shop/page.ts",
        line: 3,
        col: 3,
        message: `href("/a b"): not '' or / segments of [A-Za-z0-9._~-]`,
        see: "k.mount",
      },
      {
        code: "E1582",
        path: "modules/shop/page.ts",
        line: 6,
        col: 3,
        message: `href("/0123456789/0123456789/012345): not '' or / segments of [A-Za-z0-9._~-]`,
        see: "k.mount",
      },
    ]);
  });

  it("E1582 only for href of the default import of identity.ts, with a string literal", () => {
    const calls = (head: string, call: string) =>
      codes([...base, use("modules/shop/page.ts", `${head}\nexport const y = ${call}\n`)]);
    const DEFAULT = "import mount from '../../identity'";
    expect(calls(DEFAULT, "mount.href('/a?')")).toEqual(["E1582"]);
    expect(calls("import m, { other } from '../../identity.ts'", "m.href('/a?')")).toEqual(["E1582"]);
    for (const [head, call] of [
      [DEFAULT, "mount['href']('/a?')"],
      [DEFAULT, "mount.path('/a?')"],
      [DEFAULT, "mount.href()"],
      [DEFAULT, "mount.href(1)"],
      [DEFAULT, "mount.href(sub)"],
      [DEFAULT, "mount.href(`/a?`)"],
      [DEFAULT, "href('/a?')"],
      [DEFAULT, "other.href('/a?')"],
      [DEFAULT, "a.mount.href('/a?')"],
      [DEFAULT, "(() => mount)().href('/a?')"],
      ["import { mount } from '../../identity'", "mount.href('/a?')"],
      ["import * as mount from '../../identity'", "mount.href('/a?')"],
      ["import mount from '../../identity-of-another'", "mount.href('/a?')"],
      ["import mount from './identity'", "mount.href('/a?')"],
      ["import mount from '../../identity.tsx'", "mount.href('/a?')"],
      ["const identity = 1", "mount.href('/a?')"],
    ] as const)
      expect(calls(head, call), `${head} ${call}`).toEqual([]);
  });

  it("E1589 carries the whole message at the deployable's key, however the topology is wrapped", () => {
    const want = (line: number, col: number, message: string) => ({
      code: "E1589",
      path: "topology.ts",
      line,
      col,
      message,
      see: "k.mount",
    });
    expect(mountDiags([...base, topology(`${API}\n${STATIC}\n${CLIENT}`)])).toEqual([
      want(4, 3, E1589_STATIC),
      want(5, 3, E1589_CLIENT),
    ]);
    for (const [open, close] of [
      ["export default {", "}"],
      ["export default ({", "})"],
      ["export default {", "} as const"],
      ["export default {", "} satisfies T"],
      ["export default topology(({", "} as const) satisfies T)"],
      ["export default topology({", "}, more)"],
    ] as const) {
      const source = `${open}\n${API}\n    "web": { modules: ['shop'], adapter: 'client' },\n${close}\n`;
      expect(mountDiags([...base, { path: "topology.ts", source }]), open + close).toEqual([want(3, 5, E1589_CLIENT)]);
    }
  });

  it("reports nothing of a topology the static read takes no deployable from", () => {
    for (const source of [
      "",
      "export default {",
      `export default function t() { return {\n${STATIC}\n} }\n`,
      `export default class T { x = {\n${STATIC}\n} }\n`,
      "export default topology()\n",
      `export default topology(...[{\n${STATIC}\n}])\n`,
      `export const t = {\n${STATIC}\n}\n`,
    ])
      expect(mountDiags([...base, { path: "topology.ts", source }]), source).toEqual([]);
  });

  it("E1589 for each bare deployable but those a file's E1581 already names", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.stringMatching(/^[a-z][a-z0-9]{0,5}$/), { minLength: 1, maxLength: 4 }),
        fc.array(fc.constantFrom("static", "client", "served", "node"), { minLength: 4, maxLength: 4 }),
        fc.array(fc.boolean(), { minLength: 4, maxLength: 4 }),
        (names, kinds, imports) => {
          fc.pre(!names.includes("api"));
          const rows = names.map((n, i) => ({ name: n, kind: kinds[i] ?? "node", imports: imports[i] ?? false }));
          const top = topology(
            [
              API,
              ...rows.map(
                (r) =>
                  `  ${r.name}: { modules: ['m-${r.name}'], adapter: '${r.kind === "served" ? "client" : r.kind}'${r.kind === "served" ? ", servedBy: 'api'" : ""} },`,
              ),
            ].join("\n"),
          );
          const pages = rows.flatMap((r) =>
            r.imports
              ? [
                  use(
                    `modules/m-${r.name}/page.ts`,
                    "import mount from '../../identity'\nexport const p = mount.path\n",
                  ),
                ]
              : [],
          );
          const bare = rows.filter((r) => r.kind === "static" || r.kind === "client");
          const got = mountDiags([...base, top, ...pages]);
          expect(got.filter((d) => d.code === "E1581").map((d) => d.path)).toEqual(
            bare.filter((r) => r.imports).map((r) => `modules/m-${r.name}/page.ts`),
          );
          expect(got.filter((d) => d.code === "E1589").map((d) => [d.line, d.col, d.message.split(" ")[0]])).toEqual(
            bare.filter((r) => !r.imports).map((r) => [4 + rows.indexOf(r), 3, r.name]),
          );
          expect(got).toHaveLength(bare.length);
        },
      ),
      { seed: 1337, numRuns: 100 },
    );
  });
});
