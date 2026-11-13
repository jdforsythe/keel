// k.privacy E1111, k.security E1570/E1571, k.a11y E1804/E1820: edges the conformance suites do not cover.
import { expect, it } from "vitest";
import { check } from "../src/index.ts";

type Files = Parameters<typeof check>[0];
const codes = (files: Files, code: string, tokens?: unknown) =>
  check(files, { types: false, ...(tokens === undefined ? {} : { artifacts: { tokens } }) }).diagnostics.filter(
    (d) => d.code === code,
  );
const C = (jsx: string): Files => [
  {
    path: "src/C.tsx",
    source: `import { Box, Text, Button } from '@keel/ui'\nexport default function C() { return ${jsx} }\n`,
  },
];

it("E1570 reads every srcset candidate, and `href` to another origin is fine", () => {
  expect(codes(C('<img srcset="/a.png 1x, https://x.example/b.png 2x" />'), "E1570")).toHaveLength(1);
  expect(codes(C('<img srcset="/a.png 1x, /b.png 2x" />'), "E1570")).toEqual([]);
  expect(codes(C('<a href="https://x.example/">x</a>'), "E1570")).toEqual([]);
});

it("E1571 follows a const URL into new URL(), and ignores a relative one", () => {
  const load = (url: string): Files => [
    {
      path: "src/load.ts",
      source: `const U = ${JSON.stringify(url)}\nexport const load = (ctx) => ctx.net.fetch(new URL(U))\n`,
    },
  ];
  expect(codes(load("https://api.example/x"), "E1571")).toHaveLength(1);
  expect(codes(load("/x"), "E1571")).toEqual([]);
});

it("E1111 follows a schema const nested in another schema file", () => {
  const files: Files = [
    {
      path: "src/Who.schema.ts",
      source: "import { s } from '@keel/schema'\nexport const Who = s.object({ ip: s.string().pii('network') })\n",
    },
    {
      path: "src/Q.schema.ts",
      source:
        "import { s } from '@keel/schema'\nimport { Who } from './Who.schema.ts'\nexport const Q = s.object({ who: Who.optional() })\n",
    },
    {
      path: "src/routes.ts",
      source:
        "import { manifest } from '@keel/router'\nimport { Q } from './Q.schema.ts'\nconst Page = () => null\nexport const routes = manifest({ 'a.b': { path: '/b', search: Q, component: Page } })\n",
    },
  ];
  const ds = codes(files, "E1111");
  expect(ds).toHaveLength(1);
  expect(ds[0]?.message).toContain("search");
});

it("E1804 leaves an element whose nearest ancestor bg is not a literal to the render check", () => {
  const tokens = { color: { low: "#949494", white: "#ffffff" } };
  expect(codes(C('<Box bg="white"><Box bg={x}><Text fg="low">t</Text></Box></Box>'), "E1804", tokens)).toEqual([]);
  expect(codes(C('<Box bg="white"><Box><Text fg="low">t</Text></Box></Box>'), "E1804", tokens)).toHaveLength(1);
});

it("E1820 counts focusable elements at any depth and reverses only the direct children", () => {
  const src = '<Box direction="column-reverse"><Box><Button>A</Button></Box> <Button>B</Button></Box>';
  const [d] = codes(C(src), "E1820");
  expect(d?.fix).toContain('direction="column"><Button>B</Button> <Box><Button>A</Button></Box></Box>');
});
