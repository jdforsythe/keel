// The routes module of the "In place" cases (not a test file). A test imports it for the server side; `resumeDocument`
// imports it again for the client side, where every module it reaches is evaluated anew.
import { manifest } from "@keel/router";
import { CASES, effectPage } from "./claim-cases.ts";
import { compilePage } from "./claim-support.ts";

const entries = Object.fromEntries(
  CASES.map((c) => [`${c.key}.page`, { path: `/${c.key}`, component: compilePage(`${c.key}.page`, c.source) }]),
);

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

export const routes = manifest({
  ...entries,
  "ef.page": { path: "/ef", component: compilePage("ef.page", effectPage("ef", HIDDEN_BRANCH, HIDE)) },
  "eg.page": { path: "/eg", component: compilePage("eg.page", effectPage("ef", STATIC_BRANCH, "", PUT_BACK)) },
  "eh.page": { path: "/eh", component: compilePage("eh.page", effectPage("ef", STATIC_BRANCH, "", TAKE_OUT)) },
  "er.page": { path: "/er", component: compilePage("er.page", ROWS) },
  "ek.page": { path: "/ek", component: compilePage("ek.page", effectPage("ef", STATIC_BRANCH, "")) },
});

export default routes;
