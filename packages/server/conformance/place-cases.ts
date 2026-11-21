// The island pages of the k.place suites (not a test file): one page per way a component places a prop call. Every page has
// a counter (`<k>.inc`, `<k>.out`); the icon a case passes carries a button `<k>.hit` that counts too, so a handler on a
// moved or re-made element shows. The component under test sits in `<k>.card`.
export type Case = {
  /** The key: route id `<key>.page`, path `/<key>`, element ids `<key>.*`. */
  readonly key: string;
  readonly title: string;
  readonly source: string;
  /** Selectors, each matching one element inside `<key>.card` of the served document. */
  readonly inside: readonly string[];
  /** The text of `<key>.card` when it has no element to look for. */
  readonly cardText?: RegExp;
  /** The ids of the buttons whose click adds one to `<key>.out`. */
  readonly hits: readonly string[];
};

const HEAD = `import { signal } from "@keel/reactive";
import { For, If } from "@keel/runtime-dom";
import { Box, Text } from "@keel/ui";
`;

const page = (k: string, defs: string, body: string): string => `${HEAD}${defs}
export default function Page() {
  const n = signal(0);
  const ok = signal(true);
  const rows = signal([{ id: "r1" }, { id: "r2" }, { id: "r3" }]);
  const hit = () => n.set(n.get() + 1);
  return <div id="${k}.root">
    <button id="${k}.inc" onClick={() => n.set(n.get() + 1)}>+</button><span id="${k}.out">{n.get()}</span>
    ${body}
  </div>
}
`;

const HIT = (k: string): string => `<button id="${k}.hit" onClick={hit}>hit</button>`;

export const CASES: readonly Case[] = [
  {
    key: "p1",
    title: "`{props.icon()}` with `icon: () => Node`",
    source: page(
      "p1",
      `function Card(props: { icon: () => Node }) { return <Box id="p1.card">{props.icon()}</Box> }\n`,
      `<Card icon={() => ${HIT("p1")}} />`,
    ),
    inside: ['[id="p1.hit"]'],
    hits: ["p1.hit"],
  },
  {
    key: "p2",
    title: "`{props.icon?.()}` with `icon` given",
    source: page(
      "p2",
      `function Card(props) { return <Box id="p2.card">{props.icon?.()}</Box> }\n`,
      `<Card icon={() => ${HIT("p2")}} />`,
    ),
    inside: ['[id="p2.hit"]'],
    hits: ["p2.hit"],
  },
  {
    key: "p3",
    title: "`{props.icon?.() ?? 'none'}` with `icon` absent",
    source: page(
      "p3",
      `function Card(props) { return <Box id="p3.card">{props.icon?.() ?? 'none'}</Box> }\n`,
      "<Card />",
    ),
    inside: [],
    cardText: /^\s*none\s*$/,
    hits: [],
  },
  {
    key: "p4",
    title: "`icon` returning two elements, with static text and `{count}` beside them",
    source: page(
      "p4",
      `function Card(props) { return <Box id="p4.card">lead {props.count} {props.icon()} tail</Box> }\n`,
      `<Card count={n.get()} icon={() => [<b id="p4.a">a</b>, ${HIT("p4")}]} />`,
    ),
    inside: ['[id="p4.a"]', '[id="p4.hit"]'],
    cardText: /lead\s*0\s*a\s*hit\s*tail/,
    hits: ["p4.hit"],
  },
  {
    key: "p5",
    title: "`icon` returning a fragment, with static text and `{count}` beside it",
    source: page(
      "p5",
      `function Card(props) { return <Box id="p5.card">lead {props.count} {props.icon()} tail</Box> }\n`,
      `<Card count={n.get()} icon={() => <><b id="p5.a">a</b>${HIT("p5")}</>} />`,
    ),
    inside: ['[id="p5.a"]', '[id="p5.hit"]'],
    cardText: /lead\s*0\s*a\s*hit\s*tail/,
    hits: ["p5.hit"],
  },
  {
    key: "p6",
    title: "`{props.icon()}` inside `If` content, with the branch shown",
    source: page(
      "p6",
      `function Card(props) { return <Box id="p6.card"><If when={props.ok}>{props.icon()}</If></Box> }\n`,
      `<Card ok={ok.get()} icon={() => ${HIT("p6")}} />`,
    ),
    inside: ['[id="p6.hit"]'],
    hits: ["p6.hit"],
  },
  {
    key: "p7",
    title: "`{props.icon()}` in the content of each of three `For` rows",
    source: page(
      "p7",
      `function Card(props) { return <ul id="p7.card"><For each={props.rows} key="id">{(r) => <li id={"p7.row." + r.id}>{props.icon()}</li>}</For></ul> }\n`,
      `<Card rows={rows.get()} icon={() => <b class="ic">i</b>} />`,
    ),
    inside: ['[id="p7.row.r1"] > .ic', '[id="p7.row.r2"] > .ic', '[id="p7.row.r3"] > .ic'],
    hits: [],
  },
  {
    key: "p8",
    title: "`{props.label()}` with `label: () => 'Hi'`",
    source: page(
      "p8",
      `function Card(props) { return <Box id="p8.card">{props.label()}</Box> }\n`,
      `<Card label={() => 'Hi'} />`,
    ),
    inside: [],
    cardText: /^\s*Hi\s*$/,
    hits: [],
  },
];
