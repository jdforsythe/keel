// @vitest-environment node
// The node adapter renders documents with no DOM global: createApp installs the DOM-free server tree (backlog 0073).
import { createCtx } from "@keel/ctx";
import { loader, manifest } from "@keel/router";
import { ok, s } from "@keel/schema";
import { describe, expect, it } from "vitest";
import { createApp, topology } from "../src/index.ts";
import { ServerDocument } from "../src/internal/dom/ServerDocument.ts";
import { parseHtml } from "../src/internal/dom/parseHtml.ts";

const BASE = "http://localhost";
const Lists = s.object({ names: s.array(s.string()) });

function Board(props: { readonly data: { readonly names: readonly string[] } }): Node {
  const ul = document.createElement("ul");
  ul.setAttribute("id", "api.lists");
  for (const n of props.data.names) {
    const li = document.createElement("li");
    li.appendChild(document.createTextNode(n));
    ul.appendChild(li);
  }
  return ul;
}

const build = () =>
  createApp({
    topology: topology({ web: { modules: ["api"], adapter: "node" } }),
    routes: manifest({
      "api.lists": {
        path: "/api/lists",
        loader: loader({ output: Lists }, async () => ok({ names: ["a<b", "c & d"] })),
        component: Board,
      },
      "api.tpl": {
        path: "/api/tpl",
        component: () => {
          const t = document.createElement("template");
          t.innerHTML = '<p class="x" data-a=\'1\'>hi <b>there</b><br><!--c--><input value="v"></p>';
          return document.importNode(t.content.firstElementChild ?? t, true);
        },
      },
      "api.frag": {
        path: "/api/frag",
        component: () => {
          const f = document.createDocumentFragment();
          f.append("a<", document.createElement("i"));
          return f;
        },
      },
    }),
    ctx: createCtx({ mode: "sim", seed: 1 }),
  });

const get = async (path: string) =>
  (await build()).fetch(new Request(`${BASE}${path}`, { headers: { accept: "text/html" } }));

describe("document rendering in plain node (no DOM global)", () => {
  it("has no DOM before createApp and a text/html request returns 200 and HTML", async () => {
    expect(typeof document).toBe("undefined");
    const res = await get("/api/lists");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const html = await res.text();
    expect(html).toContain('<ul id="api.lists"><li>a&lt;b</li><li>c &amp; d</li></ul>');
    expect(html).toContain('id="k-state"');
  });

  it("serializes templates, clones, comments and void elements", async () => {
    const html = await (await get("/api/tpl")).text();
    expect(html).toContain('<p class="x" data-a="1">hi <b>there</b><br><!--c--><input value="v"></p>');
  });

  it("serializes a fragment's children", async () => {
    expect(await (await get("/api/frag")).text()).toContain("<main>a&lt;<i></i></main>");
  });
});

describe("server DOM tree", () => {
  it("decodes character references and keeps script text raw", () => {
    const doc = new ServerDocument();
    const div = doc.createElement("div");
    parseHtml(doc, '<p title="a&amp;b">x &lt; y &#65;</p><script>if (a < b && c) {}</script>', div);
    expect(div.innerHTML).toBe('<p title="a&amp;b">x &lt; y A</p><script>if (a < b && c) {}</script>');
    expect(div.children).toHaveLength(2);
  });

  it("moves nodes between parents and edits siblings", () => {
    const doc = new ServerDocument();
    const a = doc.createElement("div");
    const b = doc.createElement("div");
    const x = doc.createElement("i");
    a.append(x, "t");
    b.appendChild(x);
    expect(a.innerHTML).toBe("t");
    expect(b.innerHTML).toBe("<i></i>");
    x.replaceWith("r", doc.createElement("u"));
    expect(b.innerHTML).toBe("r<u></u>");
    expect(b.firstChild?.nextSibling?.previousSibling).toBe(b.firstChild);
    b.textContent = "z";
    expect(b.innerHTML).toBe("z");
    expect(a.contains(x)).toBe(false);
  });
});
