// The pages of the k.claim "In place" suites (not a test file): one island page per kind of multi-item content.
// Every page has a counter (`<k>.inc`, `<k>.out`) and a button inside the content under test (`<k>.hit`) that counts too,
// so a handler on a moved or re-made element shows. Text sits beside the elements in every case.
import { compilePage } from "./claim-support.ts";
import type { Page } from "./claim-support.ts";

export type Case = {
  /** The key: route id `<key>.page`, path `/<key>`, element ids `<key>.*`. */
  readonly key: string;
  /** What the case puts in several items. */
  readonly title: string;
  readonly source: string;
  /** The ids of the elements the content under test serves, in document order, `hit` included. */
  readonly content: readonly string[];
};

const HEAD = `import { effect, signal } from "@keel/reactive";
import { Boundary, Case, For, If, Match } from "@keel/runtime-dom";
import { Form } from "@keel/router";
import { Button, Text } from "@keel/ui";
import { Part } from "@keel/ui/aria";
`;

const page = (k: string, defs: string, body: string): string => `${HEAD}${defs}
export default function Page() {
  const n = signal(0);
  const on = signal(true);
  const view = signal({ tag: "a" });
  const rows = signal([{ id: "r1" }, { id: "r2" }, { id: "r3" }]);
  const hit = () => n.set(n.get() + 1);
  return <div id="${k}.root">
    <button id="${k}.inc" onClick={() => n.set(n.get() + 1)}>+</button><span id="${k}.out">{n.get()}</span>
    ${body}
  </div>
}
`;

const A = (k: string): string => `<b id="${k}.a">a</b>`;
const B = (k: string): string => `<i id="${k}.b">b</i>`;
const HIT = (k: string): string => `<button id="${k}.hit" onClick={hit}>hit</button>`;
const WRAP = (k: string): string =>
  `function Wrap(props) { return <section id="${k}.wrap">{props.children()}</section> }\n`;
const INNER = (k: string): string =>
  `function Inner(props) { return <article id="${k}.inner">{props.children()}</article> }\n`;

const cases = (p: string, text: boolean): readonly Case[] => {
  const L = text ? "lead {n.get()} " : "";
  const T = text ? " tail" : "";
  const mk = (n: number): string => `${p}${n}`;
  const how = text ? ", with text beside the elements" : "";
  const k1 = mk(1);
  const k2 = mk(2);
  const k3 = mk(3);
  const k4 = mk(4);
  const k5 = mk(5);
  const k6 = mk(6);
  const k7 = mk(7);
  const k8 = mk(8);
  const k9 = mk(9);
  const k10 = mk(10);
  const k11 = mk(11);
  const k12 = mk(12);
  const k13 = mk(13);
  const k14 = mk(14);
  return [
    {
      key: k1,
      title: `a component with one child${how}`,
      source: page(k1, WRAP(k1), `<Wrap>${L}<button id="${k1}.hit" onClick={hit}>hit</button>${T}</Wrap>`),
      content: [`${k1}.hit`],
    },
    {
      key: k2,
      title: `a component with two children${how}`,
      source: page(k2, WRAP(k2), `<Wrap>${L}${A(k2)}${T} ${HIT(k2)}</Wrap>`),
      content: [`${k2}.a`, `${k2}.hit`],
    },
    {
      key: k3,
      title: `a component whose children thunk returns an array${how}`,
      source: page(
        k3,
        `import { Box } from "@keel/ui";\nfunction Wrap(props) { return Box({ id: "${k3}.wrap", children: props.children }) }\nfunction Mid(props) { return Wrap({ children: () => [${text ? '"lead ", ' : ""}Text({ id: "${k3}.a", children: "a" }), Button({ id: "${k3}.hit", onClick: props.onHit, children: "hit" })${text ? ', " tail"' : ""}] }) }\n`,
        "<Mid onHit={hit} />",
      ),
      content: [`${k3}.a`, `${k3}.hit`],
    },
    {
      key: k4,
      title: `nested components each with two children${how}`,
      source: page(k4, WRAP(k4) + INNER(k4), `<Wrap>${A(k4)} ${L}<Inner>${B(k4)}${T} ${HIT(k4)}</Inner></Wrap>`),
      content: [`${k4}.a`, `${k4}.b`, `${k4}.hit`],
    },
    {
      key: k5,
      title: `Form with one child${how}`,
      source: page(k5, "", `<Form method="POST" action="/${k5}/save">${L}${HIT(k5)}${T}</Form>`),
      content: [`${k5}.hit`],
    },
    {
      key: k6,
      title: `Form with several children${how}`,
      source: page(
        k6,
        "",
        `<Form method="POST" action="/${k6}/save">${L}<label id="${k6}.a" for="${k6}.b">name</label> <input id="${k6}.b" name="x" />${T} ${HIT(k6)}</Form>`,
      ),
      content: [`${k6}.a`, `${k6}.b`, `${k6}.hit`],
    },
    {
      key: k7,
      title: `Part with several children${how}`,
      source: page(k7, "", `<Part id="${k7}.part" role="generic">${L}${A(k7)}${T} ${HIT(k7)}</Part>`),
      content: [`${k7}.a`, `${k7}.hit`],
    },
    {
      key: k8,
      title: `an If branch with several elements${how}`,
      source: page(k8, "", `<If when={on.get()}>${L}${A(k8)}${T} ${B(k8)} ${HIT(k8)}</If>`),
      content: [`${k8}.a`, `${k8}.b`, `${k8}.hit`],
    },
    {
      key: k9,
      title: `For rows of two elements each, three rows${how}`,
      source: page(
        k9,
        "",
        `<div id="${k9}.list"><For each={rows.get()} key="id">{(r) => <>${L}<b class="row">{r.id}</b><button id={"${k9}.hit." + r.id} onClick={hit}>hit</button>${T}</>}</For></div>`,
      ),
      content: [`${k9}.hit.r1`, `${k9}.hit.r2`, `${k9}.hit.r3`],
    },
    {
      key: k10,
      title: `a Match case with several elements${how}`,
      source: page(
        k10,
        "",
        `<Match on={view.get()}><Case tag="a">${L}${A(k10)}${T} ${HIT(k10)}</Case><Case tag="b"><p id="${k10}.other">other</p></Case></Match>`,
      ),
      content: [`${k10}.a`, `${k10}.hit`],
    },
    {
      key: k11,
      title: `a Boundary body with several elements${how}`,
      source: page(
        k11,
        "",
        `<Boundary fallback={(e, reset) => <p id="${k11}.err">err</p>}>${L}${A(k11)}${T} ${HIT(k11)}</Boundary>`,
      ),
      content: [`${k11}.a`, `${k11}.hit`],
    },
    {
      key: k12,
      title: `a fragment in a template slot${how}`,
      source: page(k12, "", `<div id="${k12}.slot">{<>${L}${A(k12)}${T} ${HIT(k12)}</>}</div>`),
      content: [`${k12}.a`, `${k12}.hit`],
    },
    {
      key: k13,
      title: `a fragment returned by a component${how}`,
      source: page(
        k13,
        `function Pair(props) { return <>${A(k13)}${text ? " lead" : ""}${T} ${B(k13)}<button id="${k13}.hit" onClick={props.onHit}>hit</button></> }\n`,
        "<Pair n={n.get()} onHit={hit} />",
      ),
      content: [`${k13}.a`, `${k13}.b`, `${k13}.hit`],
    },
    {
      key: k14,
      title: `a slot prop thunk placed by the receiving component${how}`,
      source: page(
        k14,
        `import { Box } from "@keel/ui";\nfunction Frame(props) { return Box({ id: "${k14}.frame", children: props.icon }) }\n`,
        `<Frame icon={() => <>${L}<button id="${k14}.hit" onClick={hit}>hit</button>${T}</>} />`,
      ),
      content: [`${k14}.hit`],
    },
  ];
};

export const CASES: readonly Case[] = [...cases("ip", false), ...cases("it", true)];

/** The compiled page of a case. */
export const pageOf = (c: Case): Page => compilePage(`${c.key}.page`, c.source);

/** A page for the exception cases: `hide` is the body of an `effect` made before the template (it may write `on`) and `late` the body of one made after `branch` is built. */
export const effectPage = (k: string, branch: string, hide: string, late = ""): string =>
  `${HEAD}
function Late() { effect(() => { ${late} }); return <span id="${k}.late">late</span> }
export default function Page() {
  const n = signal(0);
  const on = signal(true);
  const rows = signal([{ id: "a" }, { id: "b" }, { id: "c" }]);
  effect(() => { ${hide} }, { writes: [on] });
  return <div id="${k}.root">
    <button id="${k}.inc" onClick={() => n.set(n.get() + 1)}>+</button><span id="${k}.out">{n.get()}</span>
    ${branch}
    <Late />
  </div>
}
`;
