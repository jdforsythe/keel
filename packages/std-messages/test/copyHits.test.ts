// E2406 hits of one file: where each is reported, the text its message quotes, and the shapes that are not copy.
import { describe, expect, it } from "vitest";
import { copyHits } from "../src/tools/internal/copyHits.ts";
import { at, program } from "./tooling.ts";

const VIEW = "modules/recipes/View.tsx";
const ROUTES = "modules/recipes/routes.ts";
const msg = (text: string): string => `literal copy '${text}'; read it from a message set`;
const view = (body: string, head = ""): string =>
  `${head}export default function View(props) {\n  const t = props.data.text\n  return ${body}\n}\n`;
const routes = (title: string, head = ""): string =>
  `import { manifest } from '@keel/router'\n${head}export const routes = manifest({ 'recipes.list': { path: '/recipes', title: ${title} } })\n`;

type Project = Readonly<Record<string, string>>;
/** The hits of `source` at `path`, in a project that also holds `others`. */
const hitsOf = (path: string, source: string, others: Project = {}) =>
  copyHits(program(path, source), path, [
    { path, source },
    ...Object.entries(others).map(([p, s]) => ({ path: p, source: s })),
  ]);
/** Asserts the hits of `source`, in source order: each `[needle, text]` is a hit at the first `needle`, quoting `text`. */
const expectHits = (path: string, source: string, want: readonly (readonly [string, string])[], others?: Project) => {
  expect(hitsOf(path, source, others).sort((a, b) => a.at - b.at)).toEqual(
    want.map(([needle, text]) => ({ at: at(source, needle), msg: msg(text) })),
  );
};
const inView = (body: string, want: readonly (readonly [string, string])[], head = "", others?: Project) =>
  expectHits(VIEW, view(body, head), want, others);
const inRoutes = (title: string, want: readonly (readonly [string, string])[], head = "") =>
  expectHits(ROUTES, routes(title, head), want);

describe("JSX text", () => {
  it("is reported at its first character that is not white space, trimmed", () => {
    inView("<h1>Recipes</h1>", [["Recipes", "Recipes"]]);
    inView("<h1>\n      Recipes of the day  \n    </h1>", [["Recipes of", "Recipes of the day"]]);
    inView("<p>été</p>", [["été", "été"]]);
    inView("<p>{t.count} left</p>", [["left", "left"]]);
  });

  it("is clipped in the message", () => {
    inView("<p>The quick brown fox jumps over</p>", [["The quick", "The quick brown fox j..."]]);
    inView("<p>Exactly twenty-four char</p>", [["Exactly", "Exactly twenty-four char"]]);
  });

  it("without a letter is not copy", () => {
    inView("<p>42 % - {t.count} · 7</p>", []);
  });
});

describe("JSX attributes", () => {
  it.each([
    "label",
    "alt",
    "placeholder",
    "title",
    "aria-label",
    "aria-description",
    "aria-placeholder",
    "aria-roledescription",
    "aria-valuetext",
    "children",
  ])("%s is reported at its string literal", (name) => {
    inView(`<Box ${name}="Close" />`, [['"Close"', "Close"]]);
    inView(`<Box ${name}={'Close'} />`, [["'Close'", "Close"]]);
  });

  it("outside the list, without a value, namespaced or holding an element are not read", () => {
    inView(`<Box id="main" fg="accent" data-title="Info" />`, []);
    inView("<Box title label />", []);
    inView(`<a xlink:title="Info" />`, []);
    inView("<Box label=<b /> />", []);
    inView("<Box label={<b />} />", []);
  });

  it("holding a thunk or a conditional are reported at each literal", () => {
    inView("<Input placeholder={() => 'Search'} />", [["'Search'", "Search"]]);
    inView("<Input label={props.on ? 'On' : `Off`} />", [
      ["'On'", "On"],
      ["`Off`", "Off"],
    ]);
  });
});

describe("JSX child expressions", () => {
  it("are reported at the lettered operand of a `+`", () => {
    inView("<p>{'Hello, ' + props.name}</p>", [["'Hello, '", "Hello,"]]);
    inView("<p>{props.count + ' recipes'}</p>", [["' recipes'", "recipes"]]);
    inView("<p>{(props.n * 2) + ' left'}</p>", [["' left'", "left"]]);
    inView("<p>{props.a + props.b + ' in all'}</p>", [["' in all'", "in all"]]);
    inView("<p>{'Total ' + props.a + props.b}</p>", [["'Total '", "Total"]]);
    inView("<p>{'1 ' + ('of ' + props.n)}</p>", [["'of '", "of"]]);
  });

  it("are reported at a template, quoting its text around each substitution", () => {
    inView("<p>{`${props.n} recipes`}</p>", [["`${props.n} recipes`", "… recipes"]]);
    inView("<p>{`Page ${props.n} of ${props.m}`}</p>", [["`Page", "Page … of …"]]);
    inView("<p>{`It\\'s ${props.n}`}</p>", [["`It", "It's …"]]);
    inView("<p>{`Don\\'t`}</p>", [["`Don", "Don't"]]);
  });

  it("without a letter once cooked are not copy", () => {
    inView("<p>{`${props.a}\\n${props.b}`}</p>", []);
    inView("<p>{`\\n`}</p>", []);
    inView("<p>{'\\n'}</p>", []);
    inView("<p>{`${props.a} · ${props.b}`}</p>", []);
    inView("<p>{props.a + ' / ' + props.b}</p>", []);
  });

  it("that compare, negate or compute are not copy", () => {
    inView("<p>{props.kind === 'draft'}</p>", []);
    inView("<Field label={props.kind !== 'draft'} />", []);
    inView("<p>{+props.n}</p>", []);
    inView("<p>{props.n - 'x'}</p>", []);
    inView("<p>{typeof props.n}</p>", []);
    inView("<p>{/* a note for readers */}</p>", []);
  });

  it("of a fragment are read as an element's are", () => {
    inView("<>Recipes {'More'} {t.title}</>", [
      ["Recipes", "Recipes"],
      ["'More'", "More"],
    ]);
  });

  it("returned by a thunk with a block body are not followed", () => {
    inView("<p>{() => { return 'Open' }}</p>", []);
  });
});

describe("JSX", () => {
  const body = "<main title=\"Info\"><h1>Recipes</h1><p>{'More'}</p><>{'Less'}</></main>";

  it("is read in `.tsx` and `.jsx` files only", () => {
    const source = view(body);
    const jsx = (path: string) => copyHits(program(path, source, "tsx"), path, []);
    expect(jsx("modules/recipes/View.jsx")).toHaveLength(4);
    expect(jsx("modules/recipes/View.tsx")).toHaveLength(4);
    expect(jsx("modules/recipes/View.tsx.ts")).toEqual([]);
    expect(jsx("modules/recipes/tsx/View.ts")).toEqual([]);
  });
});

describe("a `const` name", () => {
  it("is reported at each use, quoting its text", () => {
    inView(
      "<h1 title={heading}>{heading}</h1>",
      [
        ["heading}>", "Recipes"],
        ["heading}</h1>", "Recipes"],
      ],
      "const heading = 'Recipes'\n",
    );
  });

  it("is followed through the values its initializer can take", () => {
    const head = "const fallback = props.x ? '' : 'Untitled'\nconst lazy = () => cond && ('—' || `Late ${n}`)\n";
    inView(
      "<p>{fallback}{lazy}</p>",
      [
        ["fallback}", "Untitled"],
        ["lazy}", "Late …"],
      ],
      head,
    );
  });

  it("is followed through eight names and no further", () => {
    const chain = (n: number): string =>
      `const n${n} = 'Recipes'\n${Array.from({ length: n - 1 }, (_, i) => `const n${i + 1} = n${i + 2}\n`).join("")}`;
    inView("<p>{n1}</p>", [["n1}", "Recipes"]], chain(8));
    inView("<p>{n1}</p>", [], chain(9));
  });

  it("bound by `let`, twice, by a pattern, a param or nothing in the file is not followed", () => {
    inView(
      "<p>{a}{b}{c}{d}{props}{e}</p>",
      [],
      "let a = 'Recipes'\nlet unset\nconst b = 'One'\nvar b = 'Two'\nconst { c } = { c: 'Three' }\nconst d = load('Four')\n",
    );
    inView("<p>{a}</p>", [], "export default function () { return 1 }\nimport { other } from './copy.ts'\n", {
      "modules/recipes/copy.ts": "export const other = 'Recipes'\n",
    });
  });
});

describe("an imported `const`", () => {
  const COPY = { "modules/recipes/copy.ts": "export const dash = '—'\nexport const title = 'Recipes'\n" };

  it("is followed into the project file, under its imported name, with or without an extension", () => {
    inView("<h1>{title}</h1>", [["title}", "Recipes"]], "import { dash, title } from './copy.ts'\n", COPY);
    inView(
      "<h1>{heading}{dash}</h1>",
      [["heading}", "Recipes"]],
      "import { dash, title as heading } from './copy.ts'\n",
      COPY,
    );
    inView("<h1>{title}</h1>", [["title}", "Recipes"]], "import { title } from './copy'\n", COPY);
    inView("<h1>{title}</h1>", [["title}", "Recipes"]], "import { title } from './Copy'\n", {
      "modules/recipes/Copy.tsx": "export const title = 'Recipes'\n",
    });
    inView("<h1>{title}</h1>", [["title}", "Recipes"]], "import { title } from '../shared/copy.ts'\n", {
      "modules/shared/copy.ts": "export const title = 'Recipes'\n",
    });
  });

  it("is not followed through a type import, a default import, a package or a file the project lacks", () => {
    inView("<h1>{title}</h1>", [], "import type { title } from './copy.ts'\n", COPY);
    inView("<h1>{title}</h1>", [], "import title from './copy.ts'\n", COPY);
    inView("<h1>{title}</h1>", [], "import * as title from './copy.ts'\n", COPY);
    inView("<h1>{title}</h1>", [], "import { title } from 'copy'\n", {
      "modules/recipes/copy": COPY["modules/recipes/copy.ts"],
    });
    inView("<h1>{title}</h1>", [], "import { title } from 'modules/recipes/copy.ts'\n", COPY);
    inView("<h1>{title}</h1>", [], "import { title } from './missing.ts'\n", COPY);
    inView("<h1>{title}</h1>", [], "import { title } from './copy.ts'\n", {
      "modules/recipes/copy.ts": "export const title = \n",
    });
  });

  it("is followed through eight files and no further", () => {
    const chain = (n: number): Record<string, string> =>
      Object.fromEntries(
        Array.from({ length: n }, (_, i) => [
          `modules/recipes/c${i + 1}.ts`,
          i + 1 === n
            ? "export const title = 'Recipes'\n"
            : `import { title } from './c${i + 2}.ts'\nexport { title }\n`,
        ]),
      );
    inView("<h1>{title}</h1>", [["title}", "Recipes"]], "import { title } from './c1.ts'\n", chain(8));
    inView("<h1>{title}</h1>", [], "import { title } from './c1.ts'\n", chain(9));
  });
});

describe("a call of an uppercase name", () => {
  const ROW = "modules/recipes/row.ts";

  it("is read in any file: the listed properties of its object literal", () => {
    const source =
      "export const row = () => Text({ children: 'Recipes', id: 'Row', 'aria-label': `Open`, ...rest, [k]: 'Key' })\n";
    expectHits(ROW, source, [
      ["'Recipes'", "Recipes"],
      ["`Open`", "Open"],
    ]);
    expectHits(ROW, "export const x = (Input)({ placeholder: on ? 'Search' : t.search })\n", [["'Search'", "Search"]]);
  });

  it("is not read for another callee or another first argument", () => {
    for (const call of [
      "text({ children: 'Recipes' })",
      "makeText({ children: 'Recipes' })",
      "ui.Text({ children: 'Recipes' })",
      "Text('Recipes')",
      "Text()",
      "Text(...args)",
      "Text(props, { children: 'Recipes' })",
      "new Text({ children: 'Recipes' })",
    ])
      expect(hitsOf(ROW, `export const x = ${call}\n`)).toEqual([]);
  });
});

describe("a route `title`", () => {
  it("is read in `routes.ts` at any depth of directory, and in no other file", () => {
    const source = routes("'Recipes'");
    const want = [{ at: at(source, "'Recipes'"), msg: msg("Recipes") }];
    expect(hitsOf("routes.ts", source)).toEqual(want);
    expect(hitsOf("modules/recipes/routes.ts", source)).toEqual(want);
    expect(hitsOf("modules/recipes/subroutes.ts", source)).toEqual([]);
    expect(hitsOf("modules/recipes/routes.tsx", source)).toEqual([]);
  });

  it("is reported at each literal its function returns, nested functions aside", () => {
    inRoutes("() => 'Recipes'", [["'Recipes'", "Recipes"]]);
    inRoutes("(p) => { if (p.params.x) return; return `Recipes` }", [["`Recipes`", "Recipes"]]);
    inRoutes("function (p) { const inner = () => 'Inner'; return 'Outer' }", [["'Outer'", "Outer"]]);
    inRoutes("function (p) { function inner() { return 'Inner' } return 'Outer' }", [["'Outer'", "Outer"]]);
    inRoutes("(p) => { const inner = function () { return 'Inner' }; return p.x ? 'Outer' : 'Other' }", [
      ["'Outer'", "Outer"],
      ["'Other'", "Other"],
    ]);
    inRoutes("(p) => 'Recipes: ' + p.params.name", [["'Recipes: '", "Recipes:"]]);
  });

  it("is followed into the same-file function it names or calls, reported at that function's literal", () => {
    const want = [["'Recipes'", "Recipes"]] as const;
    inRoutes("title", want, "const title = () => { return 'Recipes' }\n");
    inRoutes("title", want, "const title = function () { return 'Recipes' }\n");
    inRoutes("title", want, "function title() { return 'Recipes' }\n");
    inRoutes("title", want, "const title = () => 'Recipes'\n");
    inRoutes("title()", want, "const title = () => { return 'Recipes' }\n");
    inRoutes(
      "(p) => title(p)",
      want,
      "let unset\nexport default function () { return 1 }\nfunction title(p) { return 'Recipes' }\n",
    );
  });

  it("naming a `const` that is not a function is reported at the use", () => {
    inRoutes("heading", [["heading }", "Recipes"]], "const heading = 'Recipes'\n");
  });

  it("calling anything else is not followed", () => {
    inRoutes("format('Recipes')", []);
    inRoutes("(p) => format('Recipes')", []);
    inRoutes("(p) => p.data.text.title", []);
  });

  it("reads a function that returns itself once", () => {
    inRoutes("title", [["'Recipes'", "Recipes"]], "function title(p) { return p ? 'Recipes' : title }\n");
    inRoutes(
      "a",
      [["'Recipes'", "Recipes"]],
      "function a(p) { return p ? b : 'Recipes' }\nfunction b() { return a }\n",
    );
  });

  it("is followed through eight functions and no further", () => {
    const chain = (n: number): string =>
      `${Array.from({ length: n }, (_, i) => `function f${i}() { return f${i + 1} }\n`).join("")}function f${n}() { return 'Recipes' }\n`;
    inRoutes("f0", [["'Recipes'", "Recipes"]], chain(8));
    inRoutes("f0", [], chain(9));
  });
});
