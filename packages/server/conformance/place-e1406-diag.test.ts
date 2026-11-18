// @vitest-environment happy-dom
// Spec: k.place, Runtime "A text binding whose value is a node, an array holding one, or a function renders `''`, in every mode (a function's source is never written). In `'dev'` mode the client writes one `console.warn` line per binding, starting `E1406` and holding the element id and `renders nothing`; a dev server's `createApp` logs one `diag` record with E1406 and the route id the first time a route renders one (k.server Log). Production writes nothing."
// Spec: k.place, Conformance "In `'dev'` mode a mounted text binding given a node, an array holding one and a function each writes one `console.warn` starting `E1406` with the element id, once over two updates, and renders `''`; in production, `''` and no line. A dev `createApp` serving such a route twice logs one `diag` E1406 with its route id; production none."
// Seed: 1337 (no generated inputs). Each page binds a function-valued prop as text, which renders nothing; it is served
// by `createApp` and the log lines are read (k.server Log: one line per record).
import { manifest } from "@keel/router";
import { describe, expect, it } from "vitest";
import { compilePage } from "./claim-support.ts";
import { type Lines, appOf } from "./resume-graph-app.ts";

const HEAD = `import { Box } from "@keel/ui";\n`;
const BINDS = (k: string): string => `${HEAD}function Card(props) { return <Box id="${k}.card">{props.icon}</Box> }
export default function Page() { return <div id="${k}.root"><Card icon={() => <b>i</b>} /></div> }
`;
const CLEAN = (k: string): string => `${HEAD}function Card(props) { return <Box id="${k}.card">{props.icon()}</Box> }
export default function Page() { return <div id="${k}.root"><Card icon={() => <b>i</b>} /></div> }
`;
const TEXTY = (k: string): string => `${HEAD}function Card(props) { return <Box id="${k}.card">{props.label}</Box> }
export default function Page() { return <div id="${k}.root"><Card label="Hi" /></div> }
`;

const routes = manifest({
  "d1.page": { path: "/d1", component: compilePage("d1.page", BINDS("d1")) },
  "d2.page": { path: "/d2", component: compilePage("d2.page", BINDS("d2")) },
  "d3.page": { path: "/d3", component: compilePage("d3.page", CLEAN("d3")) },
  "d4.page": { path: "/d4", component: compilePage("d4.page", TEXTY("d4")) },
});
const MODULES = ["d1", "d2", "d3", "d4"];

const e1406 = (lines: readonly string[], routeId?: string): string[] =>
  lines.filter((l) => l.includes("E1406") && (routeId === undefined || l.includes(routeId)));

async function get(app: Awaited<ReturnType<typeof appOf>>, path: string): Promise<{ status: number; text: string }> {
  const res = await app.fetch(new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }));
  return { status: res.status, text: await res.text() };
}

describe("k.place Runtime: a dev createApp logs one diag E1406 with the route id the first time a route renders a binding that renders nothing", () => {
  it("a route binding `{props.icon}` as text, served twice in dev, logs one `diag` E1406 naming its route id", async () => {
    const log: Lines = { lines: [] };
    const app = await appOf(routes, MODULES, { mode: "dev", log });
    const first = await get(app, "/d1");
    const second = await get(app, "/d1");
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(e1406(log.lines)).toHaveLength(1);
    expect(e1406(log.lines, "d1.page")).toHaveLength(1);
    expect(e1406(log.lines)[0]?.startsWith("E1406 ")).toBe(true);
  });

  it("two such routes log one line each, each naming its own route id", async () => {
    const log: Lines = { lines: [] };
    const app = await appOf(routes, MODULES, { mode: "dev", log });
    for (const path of ["/d1", "/d2", "/d1", "/d2"]) await get(app, path);
    expect(e1406(log.lines)).toHaveLength(2);
    expect(e1406(log.lines, "d1.page")).toHaveLength(1);
    expect(e1406(log.lines, "d2.page")).toHaveLength(1);
  });

  it("the card of a route binding `{props.icon}` is served with no text: a function's source is never written", async () => {
    const log: Lines = { lines: [] };
    const app = await appOf(routes, MODULES, { mode: "dev", log });
    const { text } = await get(app, "/d1");
    const card = new DOMParser().parseFromString(text, "text/html").querySelector('[id="d1.card"]');
    expect(card).not.toBeNull();
    expect(card?.textContent).toBe("");
  });

  it("a route that places its prop call (`{props.icon()}`) and a route binding a string log no E1406", async () => {
    const log: Lines = { lines: [] };
    const app = await appOf(routes, MODULES, { mode: "dev", log });
    for (const path of ["/d3", "/d4", "/d3", "/d4"]) await get(app, path);
    expect(e1406(log.lines)).toEqual([]);
  });

  it("in production mode the same routes log no E1406, over two requests each", async () => {
    const log: Lines = { lines: [] };
    const app = await appOf(routes, MODULES, { mode: "production", log });
    for (const path of ["/d1", "/d2", "/d1", "/d2"]) {
      const { status } = await get(app, path);
      expect(status).toBe(200);
    }
    expect(e1406(log.lines)).toEqual([]);
  });

  it("the dev and production documents of a route binding `{props.icon}` are the same", async () => {
    const dev = await appOf(routes, MODULES, { mode: "dev", log: { lines: [] } });
    const prod = await appOf(routes, MODULES, { mode: "production", log: { lines: [] } });
    const strip = (t: string): string => t.replace(/nonce="[^"]*"/g, 'nonce=""');
    const a = await get(dev, "/d1");
    const b = await get(prod, "/d1");
    expect(a.status).toBe(b.status);
    expect(strip(a.text).includes('id="d1.card"')).toBe(true);
    expect(strip(b.text).includes('id="d1.card"')).toBe(true);
  });
});
