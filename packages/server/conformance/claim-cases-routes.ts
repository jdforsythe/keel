// The routes module of the "In place" cases (not a test file). A test imports it for the server side; `resumeDocument`
// imports it again for the client side, where every module it reaches is evaluated anew.
import { manifest, routeTable } from "@keel/router";
import { contract } from "@keel/router/contract";
import { CASES, effectPage } from "./claim-cases.ts";
import { compilePage } from "./claim-support.ts";

/** One module of one page, `<key>.page` at `/<key>`. */
const modulePage = (key: string, source: string) => {
  const id = `${key}.page`;
  const c = contract(key, { [id]: { path: `/${key}` } });
  return manifest(c, { [id]: { component: compilePage(id, source) } });
};

const HIDDEN_BRANCH = `<If when={on.get()}><b id="ef.a">a</b><i id="ef.b">b</i></If>`;
// At resume the served elements are in the document; while the server renders the document holds none, so the branch is served shown.
const HIDE = `if (document.getElementById("ef.a") !== null) on.set(false);`;
const PUT_BACK = `const el = document.getElementById("ef.a"); const parent = el?.parentNode; if (el && parent) { parent.removeChild(el); parent.appendChild(el); }`;
const TAKE_OUT = `document.getElementById("ef.a")?.remove();`;
const STATIC_BRANCH = `<b id="ef.a">a</b><i id="ef.b">b</i>`;

const ROWS = effectPage(
  "er",
  `<ul id="er.list"><For each={rows.get()} key="id">{(r) => <li class="row">{r.id}</li>}</For></ul><button id="er.rm" onClick={() => rows.set(rows.get().slice(1))}>rm</button>`,
  "",
);

export const routes = routeTable(
  ...CASES.map((c) => modulePage(c.key, c.source)),
  modulePage("ef", effectPage("ef", HIDDEN_BRANCH, HIDE)),
  modulePage("eg", effectPage("ef", STATIC_BRANCH, "", PUT_BACK)),
  modulePage("eh", effectPage("ef", STATIC_BRANCH, "", TAKE_OUT)),
  modulePage("er", ROWS),
  modulePage("ek", effectPage("ef", STATIC_BRANCH, "")),
);

export default routes;
