// More pages for the third part of k.e2e-page (not a test file): known ids, island claims that remove, add and grow, and controls built by
// a host element's code (a file input, a download link, an alert, a `target="_blank"` link, a hover target, a same-origin frame): `@keel/ui` has
// no element for them and app code may not write a lowercase element (E1805), so a host element's `mount` makes them with the DOM's own calls.
// Seed 1337 for every property. ASSUMED: `Box` takes `as: 'ul'` and `as: 'li'`; a host element's `mount` runs when its island claims (before
// `resume()` resolves), so what it removes or adds is what the claim does (k.e2e-page `resume`).
import type { Page, Tree } from "./node-app.ts";

const SCHEMA = "import { type Infer, s } from '@keel/schema'\n";
const UI = "import { Box, Button, Text } from '@keel/ui'\n";
const HOST = "import { Host } from '@keel/ui'\nimport { HostIn } from './HostIn.schema.ts'\n";
const EMPTY = "export const Props = s.object({})\n";
const comp = (imports: string, name: string, body: string): string =>
  `${imports}${SCHEMA}${EMPTY}export default function ${name}(_props: Infer<typeof Props>) {\n${body}}\n`;
const hostTag = (id: string, code: string): string =>
  `<Host id="${id}" role="img" label="mark" input={HostIn} value={{}} code={() => import('./${code}.ts').then((m) => m.${code})} />`;
const page = (name: string, path: string, source: string): Page => ({ name, path, source });
const items = (n: number): string =>
  Array.from({ length: n }, (_, i) => `        <Box as="li">Item ${i + 1}</Box>`).join("\n");

/** A page with `shop.cart.count` and no template id. */
const cart = page(
  "cart",
  "/cart",
  comp(UI, "Cart", '  return (\n    <Box as="main">\n      <Text id="shop.cart.count">2</Text>\n    </Box>\n  )\n'),
);
/** A page whose source writes the template id `shop.row.${row}`; the row `p1` is shown. */
const tmpl = page(
  "tmpl",
  "/tmpl",
  comp(
    UI,
    "Tmpl",
    "  const row = 'p1'\n  return (\n    <Box as=\"main\">\n      <Text id={`shop.row.${row}`}>Row</Text>\n    </Box>\n  )\n",
  ),
);
/** A click that logs a console error (`ERR_INTERNET_DISCONNECTED`) and rejects with `new Error('late')`. */
const mixed = page(
  "mixed",
  "/mixed",
  comp(
    UI,
    "Mixed",
    "  const go = () => {\n    console.error('net::ERR_INTERNET_DISCONNECTED')\n    void Promise.reject(new Error('late'))\n  }\n  return (\n    <Box as=\"main\">\n      <Button id=\"a.mixed.go\" onClick={go}>Go</Button>\n    </Box>\n  )\n",
  ),
);
const islandPage = (name: string, path: string, listId: string, count: number, code: string): Page =>
  page(
    name,
    path,
    comp(
      `${UI}${HOST}`,
      cap(name),
      `  return (\n    <Box as="main">\n      <Box as="ul" id="${listId}">\n${items(count)}\n      </Box>\n      ${hostTag(`a.${name}.host`, code)}\n    </Box>\n  )\n`,
    ),
  );
const cap = (s: string): string => `${s.slice(0, 1).toUpperCase()}${s.slice(1)}`;
/** Three `li` without ids under `recipes.list`; the claim removes the third. */
const lremove = islandPage("lremove", "/lremove", "recipes.list", 3, "removeThird");
/** The claim adds an element under the island root, outside any list. */
const ladd = islandPage("ladd", "/ladd", "recipes.add", 3, "addOutside");
/** `app.events` holds one `li`; the claim appends one inside it. */
const grow = islandPage("grow", "/grow", "app.events", 1, "appendInside");
/** The claim removes the `li` inside `app.events`. */
const growcut = islandPage("growcut", "/growcut", "app.events", 2, "removeInside");
/** The claim appends inside `app.events` and adds one element outside it. */
const growout = islandPage("growout", "/growout", "app.events", 1, "addOutside");

const withHost = (name: string, path: string, code: string, extra = ""): Page =>
  page(
    name,
    path,
    comp(
      `${UI}${HOST}`,
      cap(name),
      `  return (\n    <Box as="main">\n      <Button id="a.${name}.btn" onClick={() => undefined}>Button</Button>\n${extra}      ${hostTag(`a.${name}.host`, code)}\n    </Box>\n  )\n`,
    ),
  );
/** `a.file` (an `<input type="file">`) and `a.file.out`; `a.upload.btn` is a button. */
const upload = withHost("upload", "/upload", "fileMark");
/** `a.export`, a link with `download` to `https://api.example.com/export.csv`. */
const download = withHost("download", "/download", "exportMark");
/** `a.alert` calls `alert('hi')`; `a.blank` is a `target="_blank"` link to `/status`; `a.hover` writes `hovered` into `a.hover.out` on `mouseover`. */
const walls = withHost("walls", "/walls", "wallsMark");
/** `a.go` (made by a host element) fetches `https://example.org/x` and every other origin the run does not serve. */
const offsite = withHost("offsite", "/offsite", "offsiteMark");
/** `a.inframe` is inside a same-origin `<iframe>`. */
const framed = withHost("framed", "/framed", "frameMark");

export const EXTRA = { cart, tmpl, mixed, offsite, lremove, ladd, upload, download, walls, framed } as const;
/** Pages that share the id `app.events` by design (E1404 otherwise): one project each. */
export const GROW = { grow, growcut, growout } as const;

const mark = (name: string, body: string): string =>
  `import type { Infer } from '@keel/schema'\nimport { hostCode } from '@keel/ui'\nimport type { HostIn } from './HostIn.schema.ts'\nexport const ${name} = hostCode<Infer<typeof HostIn>, never, undefined>({\n  mount(node) {\n    const doc = node.ownerDocument\n${body
    .split("\n")
    .map((l) => `    ${l}`)
    .join("\n")}\n    return undefined\n  },\n})\n`;
/** The host codes the pages above name, under module `a`. */
export const EXTRA_FILES: Tree = {
  "modules/a/removeThird.ts": mark(
    "removeThird",
    "const items = doc.querySelectorAll('[id=\"recipes.list\"] > *')\nitems[2]?.remove()",
  ),
  "modules/a/addOutside.ts": mark(
    "addOutside",
    "const extra = doc.createElement('p')\nextra.textContent = 'extra'\nnode.closest('[data-k-island]')?.append(extra)",
  ),
  "modules/a/appendInside.ts": mark(
    "appendInside",
    "const li = doc.createElement('li')\nli.textContent = 'grown'\ndoc.getElementById('app.events')?.append(li)",
  ),
  "modules/a/removeInside.ts": mark("removeInside", "doc.getElementById('app.events')?.firstElementChild?.remove()"),
  "modules/a/fileMark.ts": mark(
    "fileMark",
    `const input = doc.createElement('input')
input.type = 'file'
input.id = 'a.file'
const out = doc.createElement('p')
out.id = 'a.file.out'
out.textContent = 'none'
input.addEventListener('change', () => {
  const files = Array.from(input.files ?? [])
  out.textContent = files.length + ' ' + (files[0]?.name ?? '') + ' ' + (files[0]?.size ?? 0)
})
node.parentElement?.append(input, out)`,
  ),
  "modules/a/exportMark.ts": mark(
    "exportMark",
    `const link = doc.createElement('a')
link.id = 'a.export'
link.href = ['https:/', 'api.example.com', 'export.csv'].join('/')
link.download = ''
link.textContent = 'Export'
node.parentElement?.append(link)`,
  ),
  "modules/a/wallsMark.ts": mark(
    "wallsMark",
    `const alerter = doc.createElement('button')
alerter.id = 'a.alert'
alerter.textContent = 'Alert'
alerter.addEventListener('click', () => doc.defaultView?.alert('hi'))
const blank = doc.createElement('a')
blank.id = 'a.blank'
blank.href = '/status'
blank.target = '_blank'
blank.textContent = 'Blank'
const hover = doc.createElement('div')
hover.id = 'a.hover'
hover.textContent = 'Hover me'
const out = doc.createElement('p')
out.id = 'a.hover.out'
out.textContent = 'idle'
hover.addEventListener('mouseover', () => {
  out.textContent = 'hovered'
})
node.parentElement?.append(alerter, blank, hover, out)`,
  ),
  "modules/a/offsiteMark.ts": mark(
    "offsiteMark",
    `const go = doc.createElement('button')
go.id = 'a.offsite.go'
go.textContent = 'Go'
const out = doc.createElement('p')
out.id = 'a.offsite.out'
out.textContent = 'idle'
go.addEventListener('click', () => {
  void doc.defaultView?.fetch(['https:/', 'example.org', 'x'].join('/')).then(
    () => {
      out.textContent = 'reached'
    },
    () => {
      out.textContent = 'failed'
    },
  )
})
node.parentElement?.append(go, out)`,
  ),
  "modules/a/frameMark.ts": mark(
    "frameMark",
    `const frame = doc.createElement('iframe')
node.parentElement?.append(frame)
const inner = frame.contentDocument
const inside = inner?.createElement('p')
if (inside !== undefined) {
  inside.id = 'a.inframe'
  inside.textContent = 'inside'
  inner?.body.append(inside)
}`,
  ),
};
