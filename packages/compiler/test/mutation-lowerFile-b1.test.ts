// Golden-output tests for the second half of lowerFile.ts (control-flow lowering, component calls,
// ctx parameters, `uses` scope, module scope, attached exports). Each case pins the exact emitted module.
import { compile } from "@keel/compiler";
import { describe, expect, it } from "vitest";

type Case = { name: string; path: string; source: string; code: string; edges: { from: string; to: string }[] };

const cases: Case[] = [
  {
    name: "if",
    path: "modules/t/C.tsx",
    source:
      'import { If, For, Match, Case, Boundary } from "@keel/runtime-dom";\nexport default function C() { return <section><If when="x">{() => <b>y</b>}</If><If when={a}><i>q</i></If><If when>t</If></section>; }',
    code: 'import * as __k from "@keel/runtime-dom/ops";\nimport { scope as __kscope } from "@keel/reactive";\nconst __kscoped = (f) => { let v; __kscope(() => { v = f(); }); return v; };\nconst __kt0 = __k.template("<b id=\\"modules.t.C.1\\">y</b>");\nconst __kt1 = __k.template("<i id=\\"modules.t.C.2\\">q</i>");\nconst __kt2 = __k.template("<section id=\\"modules.t.C.0\\"><!----><!----><!----></section>");\n\nexport default function C() { return __kscoped(() => {  return (() => { const __kr0 = __k.clone(__kt2); const __kn1 = __kr0.childNodes[0]; const __kn3 = __kr0.childNodes[1]; const __kn5 = __kr0.childNodes[2]; __k.cond(__kn1, () => ("x"), () => __k.clone(__kt0)); __k.cond(__kn3, () => (a), () => __k.clone(__kt1)); __k.cond(__kn5, () => (true), () => __k.frag((__kf6) => { __kf6.append("t"); })); return __kr0; })();  }); }',
    edges: [],
  },
  {
    name: "for",
    path: "C.tsx",
    source:
      'import { If, For, Match, Case, Boundary } from "@keel/runtime-dom";\nexport default function C(p) { return <ul><For each={p.xs} key="id" empty="none">{(x, i) => <li>{x.id}{i}</li>}</For><For each="a&amp;b" key>{(x) => x}</For><For each={p.ys} key="k&amp;" empty={() => <i/>}>{(x) => <li>{x.id}</li>}</For></ul>; }',
    code: 'import * as __k from "@keel/runtime-dom/ops";\nimport { scope as __kscope } from "@keel/reactive";\nconst __kscoped = (f) => { let v; __kscope(() => { v = f(); }); return v; };\nconst __kt0 = __k.template("<li id=\\"C.1\\"> <!----> </li>");\nconst __kt1 = __k.template("<i id=\\"C.2\\"></i>");\nconst __kt2 = __k.template("<li id=\\"C.3\\"> </li>");\nconst __kt3 = __k.template("<ul id=\\"C.0\\"><!----><!----><!----></ul>");\n\nexport default function C(p) { return __kscoped(() => {  return (() => { const __kr0 = __k.clone(__kt3); const __kn1 = __kr0.childNodes[0]; const __kn6 = __kr0.childNodes[1]; const __kn8 = __kr0.childNodes[2]; __k.list(__kn1, () => (p.xs), (__kv2) => __kv2["id"], (x, i) => (() => { const __kr3 = __k.clone(__kt0); const __kn4 = __kr3.childNodes[0]; const __kn5 = __kr3.childNodes[2]; __k.text(__kn4, () => (x().id)); __k.text(__kn5, () => (i())); return __kr3; })(), "none"); __k.list(__kn6, () => ("a&b"), (__kv7) => __kv7, (x) => x()); __k.list(__kn8, () => (p.ys), (__kv9) => __kv9["k&amp;"], (x) => (() => { const __kr11 = __k.clone(__kt2); const __kn12 = __kr11.childNodes[0]; __k.text(__kn12, () => (x().id)); return __kr11; })(), () => __k.clone(__kt1)); return __kr0; })();  }); }',
    edges: [],
  },
  {
    name: "forbare",
    path: "C.tsx",
    source:
      'import { If, For, Match, Case, Boundary } from "@keel/runtime-dom";\nexport default function C(p) { return <ul><For>{(x) => x}</For></ul>; }',
    code: 'import * as __k from "@keel/runtime-dom/ops";\nimport { scope as __kscope } from "@keel/reactive";\nconst __kscoped = (f) => { let v; __kscope(() => { v = f(); }); return v; };\nconst __kt0 = __k.template("<ul id=\\"C.0\\"><!----></ul>");\n\nexport default function C(p) { return __kscoped(() => {  return (() => { const __kr0 = __k.clone(__kt0); const __kn1 = __kr0.childNodes[0]; __k.list(__kn1, () => ([]), (__kv2) => __kv2, (x) => x()); return __kr0; })();  }); }',
    edges: [],
  },
  {
    name: "match",
    path: "C.tsx",
    source:
      'import { If, For, Match, Case, Boundary } from "@keel/runtime-dom";\nexport default function C(p) { return <div><Match on={p.s}><Case tag="a">{(v) => <b>{v.x}</b>}</Case><Case tag="b&amp;c">x</Case><Case tag>z</Case><Case>q</Case><p/>text</Match></div>; }',
    code: 'import * as __k from "@keel/runtime-dom/ops";\nimport { scope as __kscope } from "@keel/reactive";\nconst __kscoped = (f) => { let v; __kscope(() => { v = f(); }); return v; };\nconst __kt0 = __k.template("<b id=\\"C.1\\"> </b>");\nconst __kt1 = __k.template("<div id=\\"C.0\\"><!----></div>");\n\nexport default function C(p) { return __kscoped(() => {  return (() => { const __kr0 = __k.clone(__kt1); const __kn1 = __kr0.childNodes[0]; __k.match(__kn1, () => (p.s), "tag", { "a": (v) => (() => { const __kr2 = __k.clone(__kt0); const __kn3 = __kr2.childNodes[0]; __k.text(__kn3, () => (v().x)); return __kr2; })(), "b&c": () => __k.frag((__kf4) => { __kf4.append("x"); }) }); return __kr0; })();  }); }',
    edges: [],
  },
  {
    name: "matchkey",
    path: "C.tsx",
    source:
      'import { If, For, Match, Case, Boundary } from "@keel/runtime-dom";\nexport default function C(p) { return <div><Match on={p.s} key="kind"><Case tag="loading">x</Case></Match><Match on={p.s}><Case tag="loading">x</Case><Case tag="ready">y</Case></Match><Match on={p.s} key=""><Case tag="loading">x</Case></Match><Match><Case tag="a">x</Case></Match></div>; }',
    code: 'import * as __k from "@keel/runtime-dom/ops";\nimport { scope as __kscope } from "@keel/reactive";\nconst __kscoped = (f) => { let v; __kscope(() => { v = f(); }); return v; };\nconst __kt0 = __k.template("<div id=\\"C.0\\"><!----><!----><!----><!----></div>");\n\nexport default function C(p) { return __kscoped(() => {  return (() => { const __kr0 = __k.clone(__kt0); const __kn1 = __kr0.childNodes[0]; const __kn3 = __kr0.childNodes[1]; const __kn6 = __kr0.childNodes[2]; const __kn8 = __kr0.childNodes[3]; __k.match(__kn1, () => (p.s), "kind", { "loading": () => __k.frag((__kf2) => { __kf2.append("x"); }) }); __k.match(__kn3, () => (p.s), "state", { "loading": () => __k.frag((__kf4) => { __kf4.append("x"); }), "ready": () => __k.frag((__kf5) => { __kf5.append("y"); }) }); __k.match(__kn6, () => (p.s), "state", { "loading": () => __k.frag((__kf7) => { __kf7.append("x"); }) }); __k.match(__kn8, () => (undefined), "tag", { "a": () => __k.frag((__kf9) => { __kf9.append("x"); }) }); return __kr0; })();  }); }',
    edges: [],
  },
  {
    name: "matchprops",
    path: "C.tsx",
    source:
      'import { If, For, Match, Case, Boundary } from "@keel/runtime-dom";\ntype P = { s: { kind: "a"; x: number } | { kind: "b" } };\nexport default function C(p: P) { return <div><Match on={p.s}><Case tag="a">x</Case></Match></div>; }',
    code: 'import * as __k from "@keel/runtime-dom/ops";\nimport { scope as __kscope } from "@keel/reactive";\nconst __kscoped = (f) => { let v; __kscope(() => { v = f(); }); return v; };\nconst __kt0 = __k.template("<div id=\\"C.0\\"><!----></div>");\n\ntype P = { s: { kind: "a"; x: number } | { kind: "b" } };\nexport default function C(p: P) { return __kscoped(() => {  return (() => { const __kr0 = __k.clone(__kt0); const __kn1 = __kr0.childNodes[0]; __k.match(__kn1, () => (p.s), "tag", { "a": () => __k.frag((__kf2) => { __kf2.append("x"); }) }); return __kr0; })();  }); }',
    edges: [],
  },
  {
    name: "boundary",
    path: "C.tsx",
    source:
      'import { If, For, Match, Case, Boundary } from "@keel/runtime-dom";\nexport default function C() { return <div><Boundary><b>x</b></Boundary><Boundary fallback={(e) => <i>f</i>}>{() => <b>y</b>}</Boundary></div>; }',
    code: 'import * as __k from "@keel/runtime-dom/ops";\nimport { scope as __kscope } from "@keel/reactive";\nconst __kscoped = (f) => { let v; __kscope(() => { v = f(); }); return v; };\nconst __kt0 = __k.template("<b id=\\"C.1\\">x</b>");\nconst __kt1 = __k.template("<b id=\\"C.3\\">y</b>");\nconst __kt2 = __k.template("<i id=\\"C.2\\">f</i>");\nconst __kt3 = __k.template("<div id=\\"C.0\\"><!----><!----></div>");\n\nexport default function C() { return __kscoped(() => {  return (() => { const __kr0 = __k.clone(__kt3); const __kn1 = __kr0.childNodes[0]; const __kn3 = __kr0.childNodes[1]; __k.boundary(__kn1, () => __k.clone(__kt0), () => document.createComment("")); __k.boundary(__kn3, () => __k.clone(__kt1), (e) => __k.clone(__kt2)); return __kr0; })();  }); }',
    edges: [],
  },
  {
    name: "rootflow",
    path: "C.tsx",
    source:
      'import { If, For, Match, Case, Boundary } from "@keel/runtime-dom";\nexport default function C() { return <Boundary>{"a"}{x}</Boundary>; }',
    code: 'import * as __k from "@keel/runtime-dom/ops";\nimport { scope as __kscope } from "@keel/reactive";\nconst __kscoped = (f) => { let v; __kscope(() => { v = f(); }); return v; };\n\nexport default function C() { return __kscoped(() => {  return __k.frag((__kf0) => { const __ka1 = __kf0.appendChild(document.createComment("")); __k.boundary(__ka1, () => __k.frag((__kf2) => { __kf2.append("a"); const __kt3 = document.createTextNode(""); __k.text(__kt3, () => (x)); __kf2.append(__kt3); }), () => document.createComment("")); });  }); }',
    edges: [],
  },
  {
    name: "case",
    path: "C.tsx",
    source:
      'import { If, For, Match, Case, Boundary } from "@keel/runtime-dom";\nexport default function C() { return <div><Case tag="a">x</Case></div>; }',
    code: 'import * as __k from "@keel/runtime-dom/ops";\nimport { scope as __kscope } from "@keel/reactive";\nconst __kscoped = (f) => { let v; __kscope(() => { v = f(); }); return v; };\nconst __kt0 = __k.template("<div id=\\"C.0\\"><!----></div>");\n\nexport default function C() { return __kscoped(() => {  return (() => { const __kr0 = __k.clone(__kt0); const __kn1 = __kr0.childNodes[0]; __kn1.replaceWith(__k.frag((__kf2) => { __kf2.append("x"); })); return __kr0; })();  }); }',
    edges: [],
  },
  {
    name: "render",
    path: "C.tsx",
    source:
      'import { If, For, Match, Case, Boundary } from "@keel/runtime-dom";\nexport default function C() { return <div><If when={a}>{(  )=>1}</If><If when={a}>{function () { return 1 }}</If><If when={a}> {(x) => 1} </If><If when={a}>{(x) => 1}{2}</If><If when={a}>{((x) => 1)}</If><If when={a}>{ }</If><If when={a}>{x}</If></div>; }',
    code: 'import * as __k from "@keel/runtime-dom/ops";\nimport { scope as __kscope } from "@keel/reactive";\nconst __kscoped = (f) => { let v; __kscope(() => { v = f(); }); return v; };\nconst __kt0 = __k.template("<div id=\\"C.0\\"><!----><!----><!----><!----><!----><!----><!----></div>");\n\nexport default function C() { return __kscoped(() => {  return (() => { const __kr0 = __k.clone(__kt0); const __kn1 = __kr0.childNodes[0]; const __kn2 = __kr0.childNodes[1]; const __kn3 = __kr0.childNodes[2]; const __kn6 = __kr0.childNodes[3]; const __kn9 = __kr0.childNodes[4]; const __kn10 = __kr0.childNodes[5]; const __kn12 = __kr0.childNodes[6]; __k.cond(__kn1, () => (a), (  )=>1); __k.cond(__kn2, () => (a), function () { return 1 }); __k.cond(__kn3, () => (a), () => __k.frag((__kf4) => { __kf4.append("  "); const __kt5 = document.createTextNode(""); __k.text(__kt5, () => ((x) => 1)); __kf4.append(__kt5); __kf4.append("  "); })); __k.cond(__kn6, () => (a), () => __k.frag((__kf7) => { const __kt8 = document.createTextNode(""); __k.text(__kt8, () => ((x) => 1)); __kf7.append(__kt8); __kf7.append("2"); })); __k.cond(__kn9, () => (a), (x) => 1); __k.cond(__kn10, () => (a), () => __k.frag((__kf11) => {  })); __k.cond(__kn12, () => (a), () => __k.frag((__kf13) => { const __kt14 = document.createTextNode(""); __k.text(__kt14, () => (x)); __kf13.append(__kt14); })); return __kr0; })();  }); }',
    edges: [],
  },
  {
    name: "acc",
    path: "C.tsx",
    source:
      'import { If, For, Match, Case, Boundary } from "@keel/runtime-dom";\nexport default function C(p) { return <ul><For each={p.xs} key="id">{(item, i) => <li>{item.a}{i}{(() => { const item = 1; return item; })()}{item}</li>}</For><For each={p.xs}>{(item = 1, j, k) => item}</For><For each={p.xs}>{({a, b}) => a + b}</For><For each={p.xs}>{({a}, [b]) => <i>{a}{b}</i>}</For><For each={p.xs}>{(x) => ({x})}</For><For each={p.xs}>{(x, y, z) => x}</For><For each={p.xs}>{function (x) { return x; }}</For><For each={p.xs}>{(x) => y + x}</For></ul>; }',
    code: 'import * as __k from "@keel/runtime-dom/ops";\nimport { scope as __kscope } from "@keel/reactive";\nconst __kscoped = (f) => { let v; __kscope(() => { v = f(); }); return v; };\nconst __kt0 = __k.template("<li id=\\"C.1\\"> <!----> <!----> <!----> </li>");\nconst __kt1 = __k.template("<i id=\\"C.2\\"> <!----> </i>");\nconst __kt2 = __k.template("<ul id=\\"C.0\\"><!----><!----><!----><!----><!----><!----><!----><!----></ul>");\n\nexport default function C(p) { return __kscoped(() => {  return (() => { const __kr0 = __k.clone(__kt2); const __kn1 = __kr0.childNodes[0]; const __kn8 = __kr0.childNodes[1]; const __kn12 = __kr0.childNodes[2]; const __kn17 = __kr0.childNodes[3]; const __kn26 = __kr0.childNodes[4]; const __kn28 = __kr0.childNodes[5]; const __kn30 = __kr0.childNodes[6]; const __kn32 = __kr0.childNodes[7]; __k.list(__kn1, () => (p.xs), (__kv2) => __kv2["id"], (item, i) => (() => { const __kr3 = __k.clone(__kt0); const __kn4 = __kr3.childNodes[0]; const __kn5 = __kr3.childNodes[2]; const __kn6 = __kr3.childNodes[4]; const __kn7 = __kr3.childNodes[6]; __k.text(__kn4, () => (item().a)); __k.text(__kn5, () => (i())); __k.text(__kn6, () => ((() => { const item = 1; return item; })())); __k.text(__kn7, () => (item())); return __kr3; })()); __k.list(__kn8, () => (p.xs), (__kv9) => __kv9, (__kx10, j, __kp11 = (item = 1) => ({ item }), k) => __kp11(__kx10()).item); __k.list(__kn12, () => (p.xs), (__kv13) => __kv13, (__kx14, __ku16, __kp15 = ({a, b}) => ({ a, b })) => __kp15(__kx14()).a + __kp15(__kx14()).b); __k.list(__kn17, () => (p.xs), (__kv18) => __kv18, (__kx19, __kx21, __kp20 = ({a}) => ({ a }), __kp22 = ([b]) => ({ b })) => (() => { const __kr23 = __k.clone(__kt1); const __kn24 = __kr23.childNodes[0]; const __kn25 = __kr23.childNodes[2]; __k.text(__kn24, () => (__kp20(__kx19()).a)); __k.text(__kn25, () => (__kp22(__kx21()).b)); return __kr23; })()); __k.list(__kn26, () => (p.xs), (__kv27) => __kv27, (x) => ({x: x()})); __k.list(__kn28, () => (p.xs), (__kv29) => __kv29, (x, y, z) => x()); __k.list(__kn30, () => (p.xs), (__kv31) => __kv31, function (x) { return x(); }); __k.list(__kn32, () => (p.xs), (__kv33) => __kv33, (x) => y + x()); return __kr0; })();  }); }',
    edges: [],
  },
  {
    name: "acc2",
    path: "C.tsx",
    source:
      'import { If, For, Match, Case, Boundary } from "@keel/runtime-dom";\nexport default function C(p) { return <ul><For each={p.xs}>{({a, b}) => ({ a, b })}</For><For each={p.xs}>{({a}, i) => a + i}</For></ul>; }',
    code: 'import * as __k from "@keel/runtime-dom/ops";\nimport { scope as __kscope } from "@keel/reactive";\nconst __kscoped = (f) => { let v; __kscope(() => { v = f(); }); return v; };\nconst __kt0 = __k.template("<ul id=\\"C.0\\"><!----><!----></ul>");\n\nexport default function C(p) { return __kscoped(() => {  return (() => { const __kr0 = __k.clone(__kt0); const __kn1 = __kr0.childNodes[0]; const __kn6 = __kr0.childNodes[1]; __k.list(__kn1, () => (p.xs), (__kv2) => __kv2, (__kx3, __ku5, __kp4 = ({a, b}) => ({ a, b })) => ({ a: __kp4(__kx3()).a, b: __kp4(__kx3()).b })); __k.list(__kn6, () => (p.xs), (__kv7) => __kv7, (__kx8, i, __kp9 = ({a}) => ({ a })) => __kp9(__kx8()).a + i()); return __kr0; })();  }); }',
    edges: [],
  },
  {
    name: "comp",
    path: "C.tsx",
    source:
      'function K(p) { return <i/> }\nexport default function C(p) { return <div><K a /><K a="x&amp;y" b={1} c={"s"} d={/re/} e={f(x)} f={<b/>} g={<></>} i={(1)} {...p} data-x="1" /></div>; }',
    code: 'import * as __k from "@keel/runtime-dom/ops";\nimport { scope as __kscope } from "@keel/reactive";\nconst __kscoped = (f) => { let v; __kscope(() => { v = f(); }); return v; };\nconst __kt0 = __k.template("<i id=\\"C.0\\"></i>");\nconst __kt1 = __k.template("<b id=\\"C.2\\"></b>");\nconst __kt2 = __k.template("<div id=\\"C.1\\"><!--+--><!--+--></div>");\nfunction K(p) { return __kscoped(() => {  return __k.clone(__kt0)  }); }\nexport default function C(p, __kctx) { return __kscoped(() => {  return (() => { const __kr1 = __k.clone(__kt2); const __kn2 = __kr1.childNodes[0]; const __kn3 = __kr1.childNodes[1]; __k.slot(__kn2, () => K({ a: true }, __kctx)); __k.slot(__kn3, () => K({ a: "x&y", b: 1, c: "s", get d() { return (/re/); }, get e() { return (f(x)); }, get f() { return (__k.clone(__kt1)); }, get g() { return (__k.frag((__kf5) => {  })); }, i: 1, ...(p), "data-x": "1" }, __kctx)); return __kr1; })();  }); }',
    edges: [],
  },
  {
    name: "compkids",
    path: "C.tsx",
    source:
      "function K(p) { return <i/> }\nexport default function C(p) { return <div><K>hello</K><K><b/></K><K>a{p.x}</K><K></K></div>; }",
    code: 'import * as __k from "@keel/runtime-dom/ops";\nimport { scope as __kscope } from "@keel/reactive";\nconst __kscoped = (f) => { let v; __kscope(() => { v = f(); }); return v; };\nconst __kt0 = __k.template("<i id=\\"C.0\\"></i>");\nconst __kt1 = __k.template("<b id=\\"C.2\\"></b>");\nconst __kt2 = __k.template("<div id=\\"C.1\\"><!--+--><!--+--><!--+--><!--+--></div>");\nfunction K(p) { return __kscoped(() => {  return __k.clone(__kt0)  }); }\nexport default function C(p, __kctx) { return __kscoped(() => {  return (() => { const __kr1 = __k.clone(__kt2); const __kn2 = __kr1.childNodes[0]; const __kn3 = __kr1.childNodes[1]; const __kn5 = __kr1.childNodes[2]; const __kn8 = __kr1.childNodes[3]; __k.slot(__kn2, () => K({ children: () => "hello" }, __kctx)); __k.slot(__kn3, () => K({ children: () => __k.clone(__kt1) }, __kctx)); __k.slot(__kn5, () => K({ children: () => __k.frag((__kf6) => { __kf6.append("a"); const __kt7 = document.createTextNode(""); __k.text(__kt7, () => (p.x)); __kf6.append(__kt7); }) }, __kctx)); __k.slot(__kn8, () => K({}, __kctx)); return __kr1; })();  }); }',
    edges: [],
  },
  {
    name: "compctx",
    path: "C.tsx",
    source: "function K(p) { return <i/> }\nexport default function C(p, c) { return <div><K /></div>; }",
    code: 'import * as __k from "@keel/runtime-dom/ops";\nimport { scope as __kscope } from "@keel/reactive";\nconst __kscoped = (f) => { let v; __kscope(() => { v = f(); }); return v; };\nconst __kt0 = __k.template("<i id=\\"C.0\\"></i>");\nconst __kt1 = __k.template("<div id=\\"C.1\\"><!--+--></div>");\nfunction K(p) { return __kscoped(() => {  return __k.clone(__kt0)  }); }\nexport default function C(p, c) { return __kscoped(() => {  return (() => { const __kr1 = __k.clone(__kt1); const __kn2 = __kr1.childNodes[0]; __k.slot(__kn2, () => K({}, c)); return __kr1; })();  }); }',
    edges: [],
  },
  {
    name: "compctx2",
    path: "C.tsx",
    source:
      "function K(p) { return <i/> }\nexport function A() { return <K/> }\nexport function B(p) { return <K/> }\nexport const D = p => <K/>;\nexport const E = (p) => <K/>;\nexport const F = async p => <K/>;\nexport function G(p, s) { return <K/> }\nexport function H(...r) { return <K/> }\nexport function I(p, c = 1) { return <K/> }\nexport function J(p, {c}) { return <K/> }\nexport const L = () => <K/>;\nexport const M = <T,>() => <K/>;\nexport function N<T>() { return <K/> }\nexport const O = async () => <K/>;\nexport function P(p,) { return <K/> }",
    code: 'import * as __k from "@keel/runtime-dom/ops";\nimport { scope as __kscope } from "@keel/reactive";\nconst __kscoped = (f) => { let v; __kscope(() => { v = f(); }); return v; };\nconst __kt0 = __k.template("<i id=\\"C.0\\"></i>");\nfunction K(p) { return __kscoped(() => {  return __k.clone(__kt0)  }); }\nexport function A(__kprops, __kctx) { return __kscoped(() => {  return K({}, __kctx)  }); }\nexport function B(p, __kctx) { return __kscoped(() => {  return K({}, __kctx)  }); }\nexport const D = (p, __kctx) => __kscoped(() => (K({}, __kctx)));\nexport const E = (p, __kctx) => __kscoped(() => (K({}, __kctx)));\nexport const F = async (p, __kctx) => __kscoped(() => (K({}, __kctx)));\nexport function G(p, s) { return __kscoped(() => {  return K({}, s)  }); }\nexport function H(...r) { return __kscoped(() => {  return K({})  }); }\nexport function I(p, c = 1) { return __kscoped(() => {  return K({}, c)  }); }\nexport function J(p, {c}) { return __kscoped(() => {  return K({})  }); }\nexport const L = (__kprops, __kctx) => __kscoped(() => (K({}, __kctx)));\nexport const M = <T,>(__kprops, __kctx) => __kscoped(() => (K({}, __kctx)));\nexport function N<T>(__kprops, __kctx) { return __kscoped(() => {  return K({}, __kctx)  }); }\nexport const O = async (__kprops, __kctx) => __kscoped(() => (K({}, __kctx)));\nexport function P(p, __kctx,) { return __kscoped(() => {  return K({}, __kctx)  }); }',
    edges: [],
  },
  {
    name: "compctx3",
    path: "C.tsx",
    source:
      "function K(p) { return <i/> }\nexport function A() { return <K/>; return <K/> }\nexport const B = ( p ) => <K/>;\nexport const C2 = (p: number) => <K/>;\nexport default function () { return <K/> }",
    code: 'import * as __k from "@keel/runtime-dom/ops";\nimport { scope as __kscope } from "@keel/reactive";\nconst __kscoped = (f) => { let v; __kscope(() => { v = f(); }); return v; };\nconst __kt0 = __k.template("<i id=\\"C.0\\"></i>");\nfunction K(p) { return __kscoped(() => {  return __k.clone(__kt0)  }); }\nexport function A(__kprops, __kctx) { return __kscoped(() => {  return K({}, __kctx); return K({}, __kctx)  }); }\nexport const B = ( p, __kctx ) => __kscoped(() => (K({}, __kctx)));\nexport const C2 = (p: number, __kctx) => __kscoped(() => (K({}, __kctx)));\nexport default function (__kprops, __kctx) { return __kscoped(() => {  return K({}, __kctx)  }); }',
    edges: [],
  },
  {
    name: "uses",
    path: "modules/t/C.tsx",
    source: "export const uses = [a];\nexport default function C() { return <p/>; }",
    code: 'import * as __k from "@keel/runtime-dom/ops";\nimport { scope as __kscope } from "@keel/reactive";\nconst __kscoped = (f) => { let v; __kscope(() => { v = f(); }); return v; };\nconst __kt0 = __k.template("<p id=\\"modules.t.C.0\\"></p>");\nexport const uses = [a];\nexport default function C() { return __kscoped(() => { for (const __ku of uses) __ku.store.uses([__ku]);  return __k.clone(__kt0);  }); }\nC.uses = uses;\n',
    edges: [],
  },
  {
    name: "uses2",
    path: "modules/t/C.tsx",
    source: "const u = [a];\nexport { u as uses };\nconst C = () => <p/>;\nexport default C;",
    code: 'import * as __k from "@keel/runtime-dom/ops";\nimport { scope as __kscope } from "@keel/reactive";\nconst __kscoped = (f) => { let v; __kscope(() => { v = f(); }); return v; };\nconst __kt0 = __k.template("<p id=\\"modules.t.C.0\\"></p>");\nconst u = [a];\nexport { u as uses };\nconst C = () => __kscoped(() => { for (const __ku of u) __ku.store.uses([__ku]); return (__k.clone(__kt0)); });\nexport default C;\nC.uses = u;\n',
    edges: [],
  },
  {
    name: "uses3",
    path: "modules/t/C.tsx",
    source:
      'const u = [a];\nexport { u as "uses" };\nfunction C() { return <p/>; }\nfunction C2() { return <p/>; return 1 }\nexport default C;',
    code: 'import * as __k from "@keel/runtime-dom/ops";\nimport { scope as __kscope } from "@keel/reactive";\nconst __kscoped = (f) => { let v; __kscope(() => { v = f(); }); return v; };\nconst __kt0 = __k.template("<p id=\\"modules.t.C.0\\"></p>");\nconst __kt1 = __k.template("<p id=\\"modules.t.C.1\\"></p>");\nconst u = [a];\nexport { u as "uses" };\nfunction C() { return __kscoped(() => { for (const __ku of u) __ku.store.uses([__ku]);  return __k.clone(__kt0);  }); }\nfunction C2() { return __kscoped(() => {  return __k.clone(__kt1); return 1  }); }\nexport default C;\nC.uses = u;\n',
    edges: [],
  },
  {
    name: "uses4",
    path: "C.tsx",
    source:
      "export const uses = 1;\nexport const Props = 2;\nexport default function C() { return <p/>; }\nC.uses = uses;",
    code: 'import * as __k from "@keel/runtime-dom/ops";\nimport { scope as __kscope } from "@keel/reactive";\nconst __kscoped = (f) => { let v; __kscope(() => { v = f(); }); return v; };\nconst __kt0 = __k.template("<p id=\\"C.0\\"></p>");\nexport const uses = 1;\nexport const Props = 2;\nexport default function C() { return __kscoped(() => { for (const __ku of uses) __ku.store.uses([__ku]);  return __k.clone(__kt0);  }); }\nC.uses = uses;\nC.Props = Props;\n',
    edges: [],
  },
  {
    name: "uses5",
    path: "C.tsx",
    source:
      'export type uses = 1;\nexport { x as uses } from "./m";\nexport const Props = 2;\nexport default function () { return <p/>; }',
    code: 'import * as __k from "@keel/runtime-dom/ops";\nimport { scope as __kscope } from "@keel/reactive";\nconst __kscoped = (f) => { let v; __kscope(() => { v = f(); }); return v; };\nconst __kt0 = __k.template("<p id=\\"C.0\\"></p>");\nexport type uses = 1;\nexport { x as uses } from "./m";\nexport const Props = 2;\nexport default function () { return __kscoped(() => {  return __k.clone(__kt0);  }); }',
    edges: [],
  },
  {
    name: "uses6",
    path: "C.tsx",
    source: "export const uses = [];\nexport default () => <p/>;",
    code: 'import * as __k from "@keel/runtime-dom/ops";\nimport { scope as __kscope } from "@keel/reactive";\nconst __kscoped = (f) => { let v; __kscope(() => { v = f(); }); return v; };\nconst __kt0 = __k.template("<p id=\\"C.0\\"></p>");\nexport const uses = [];\nexport default () => __kscoped(() => { for (const __ku of uses) __ku.store.uses([__ku]); return (__k.clone(__kt0)); });',
    edges: [],
  },
  {
    name: "uses7",
    path: "C.tsx",
    source: "export const uses = [];\nexport default function C() { return <p/>; }\nC.Props = 1;\nC.uses = 3;",
    code: 'import * as __k from "@keel/runtime-dom/ops";\nimport { scope as __kscope } from "@keel/reactive";\nconst __kscoped = (f) => { let v; __kscope(() => { v = f(); }); return v; };\nconst __kt0 = __k.template("<p id=\\"C.0\\"></p>");\nexport const uses = [];\nexport default function C() { return __kscoped(() => { for (const __ku of uses) __ku.store.uses([__ku]);  return __k.clone(__kt0);  }); }\nC.Props = 1;\nC.uses = 3;',
    edges: [],
  },
  {
    name: "uses8",
    path: "C.tsx",
    source:
      "const Props = 1; const uses = [];\nexport { Props, uses };\nconst D = 1;\nexport default D;\nfunction D2() { return <p/>}",
    code: 'import * as __k from "@keel/runtime-dom/ops";\nimport { scope as __kscope } from "@keel/reactive";\nconst __kscoped = (f) => { let v; __kscope(() => { v = f(); }); return v; };\nconst __kt0 = __k.template("<p id=\\"C.0\\"></p>");\nconst Props = 1; const uses = [];\nexport { Props, uses };\nconst D = 1;\nexport default D;\nfunction D2() { return __kscoped(() => {  return __k.clone(__kt0) }); }',
    edges: [],
  },
  {
    name: "uses9",
    path: "C.tsx",
    source:
      "export const uses = [];\nexport function C() { return <p/>; }\nexport default C;\nfunction C() { return <i/>; }",
    code: 'import * as __k from "@keel/runtime-dom/ops";\nimport { scope as __kscope } from "@keel/reactive";\nconst __kscoped = (f) => { let v; __kscope(() => { v = f(); }); return v; };\nconst __kt0 = __k.template("<p id=\\"C.0\\"></p>");\nconst __kt1 = __k.template("<i id=\\"C.1\\"></i>");\nexport const uses = [];\nexport function C() { return __kscoped(() => { for (const __ku of uses) __ku.store.uses([__ku]);  return __k.clone(__kt0);  }); }\nexport default C;\nfunction C() { return __kscoped(() => {  return __k.clone(__kt1);  }); }\nC.uses = uses;\n',
    edges: [],
  },
  {
    name: "uses10",
    path: "C.tsx",
    source: "const $a = 1; export const Props = 1; export default function $a2() { return <p/>}\n$a2.Props = 1;",
    code: 'import * as __k from "@keel/runtime-dom/ops";\nimport { scope as __kscope } from "@keel/reactive";\nconst __kscoped = (f) => { let v; __kscope(() => { v = f(); }); return v; };\nconst __kt0 = __k.template("<p id=\\"C.0\\"></p>");\nconst $a = 1; export const Props = 1; export default function $a2() { return __kscoped(() => {  return __k.clone(__kt0) }); }\n$a2.Props = 1;',
    edges: [],
  },
  {
    name: "mod",
    path: "modules/inbox/s.ts",
    source:
      'import { store } from "@keel/store";\nimport { signal, computed, resource } from "@keel/reactive";\nimport { s } from "@keel/schema";\nexport const a = store(s.object({}), {});\nexport const b = store(s.object({}), {}, {});\nexport const c = store(s.object({}), {}, { id: "x" });\nexport const d = store(s.object({}), {}, { foo: 1 });\nexport const e = store(s.object({}), {}, { ...z });\nexport const f = store(s.object({}), {}, { [k]: 1 });\nexport const g = store(s.object({}), {}, { "id": 1 });\nconst h = store(s.object({}), {});\nexport const i = signal(1);\nexport const { j } = store(s.object({}), {});\nexport const k2 = foo(1);\nexport const k3 = a.b(1);\nconst l = computed(() => 1);\nexport const m = store(...args);\nexport const n = store(s.object({}), ...args);\nexport const o = store(s.object({}));\nexport function f2() {}\nexport const p = resource(() => 1), q2 = signal(2);',
    code: 'import { moduleRoot as __kmoduleRoot } from "@keel/reactive/internal";\nimport { store } from "@keel/store";\nimport { signal, computed, resource } from "@keel/reactive";\nimport { s } from "@keel/schema";\nexport const a = __kmoduleRoot(() => (store(s.object({}), {}, { id: "inbox.a" })));\nexport const b = __kmoduleRoot(() => (store(s.object({}), {}, { id: "inbox.b",})));\nexport const c = __kmoduleRoot(() => (store(s.object({}), {}, { id: "x" })));\nexport const d = __kmoduleRoot(() => (store(s.object({}), {}, { id: "inbox.d", foo: 1 })));\nexport const e = __kmoduleRoot(() => (store(s.object({}), {}, { ...z })));\nexport const f = __kmoduleRoot(() => (store(s.object({}), {}, { [k]: 1 })));\nexport const g = __kmoduleRoot(() => (store(s.object({}), {}, { "id": 1 })));\nconst h = __kmoduleRoot(() => (store(s.object({}), {})));\nexport const i = __kmoduleRoot(() => (signal(1)));\nexport const { j } = __kmoduleRoot(() => (store(s.object({}), {})));\nexport const k2 = __kmoduleRoot(() => (foo(1)));\nexport const k3 = __kmoduleRoot(() => (a.b(1)));\nconst l = __kmoduleRoot(() => (computed(() => 1)));\nexport const m = __kmoduleRoot(() => (store(...args)));\nexport const n = __kmoduleRoot(() => (store(s.object({}), ...args)));\nexport const o = __kmoduleRoot(() => (store(s.object({}))));\nexport function f2() {}\nexport const p = __kmoduleRoot(() => (resource(() => 1))), q2 = __kmoduleRoot(() => (signal(2)));',
    edges: [],
  },
  {
    name: "mod2",
    path: "modules/s.ts",
    source: 'import { store } from "@keel/store";\nexport const a = store(1, 2);',
    code: 'import { moduleRoot as __kmoduleRoot } from "@keel/reactive/internal";\nimport { store } from "@keel/store";\nexport const a = __kmoduleRoot(() => (store(1, 2)));',
    edges: [],
  },
  {
    name: "mod3",
    path: "modules/x/s.ts",
    source: 'import { store } from "@keel/store";\nexport const a = store(1, 2);',
    code: 'import { moduleRoot as __kmoduleRoot } from "@keel/reactive/internal";\nimport { store } from "@keel/store";\nexport const a = __kmoduleRoot(() => (store(1, 2, { id: "x.a" })));',
    edges: [],
  },
  {
    name: "mod4",
    path: "modules\\inbox\\s.ts",
    source: 'import { store } from "@keel/store";\nexport const a = store(1, 2);',
    code: 'import { moduleRoot as __kmoduleRoot } from "@keel/reactive/internal";\nimport { store } from "@keel/store";\nexport const a = __kmoduleRoot(() => (store(1, 2, { id: "inbox.a" })));',
    edges: [],
  },
  {
    name: "mod5",
    path: "src/s.ts",
    source: 'import { store } from "@keel/store";\nexport const a = store(1, 2);',
    code: 'import { moduleRoot as __kmoduleRoot } from "@keel/reactive/internal";\nimport { store } from "@keel/store";\nexport const a = __kmoduleRoot(() => (store(1, 2)));',
    edges: [],
  },
  {
    name: "mod6",
    path: "src/s.ts",
    source:
      'import { signal as sg, computed } from "@keel/reactive";\nimport type { resource } from "@keel/reactive";\nimport { store as st } from "@keel/other";\nexport const a = sg(1);\nconst b = computed(2)',
    code: 'import { moduleRoot as __kmoduleRoot } from "@keel/reactive/internal";\nimport { signal as sg, computed } from "@keel/reactive";\nimport type { resource } from "@keel/reactive";\nimport { store as st } from "@keel/other";\nexport const a = __kmoduleRoot(() => (sg(1)));\nconst b = __kmoduleRoot(() => (computed(2)))',
    edges: [],
  },
  {
    name: "mod7",
    path: "src/s.ts",
    source:
      'import type { signal } from "@keel/reactive";\nimport { type computed, resource as r } from "@keel/reactive";\nimport { store } from "@keel/store";\nconst a = signal(1); const b = computed(1); const c = other(1); const d = r(1); const e = store(1,2);',
    code: 'import { moduleRoot as __kmoduleRoot } from "@keel/reactive/internal";\nimport type { signal } from "@keel/reactive";\nimport { type computed, resource as r } from "@keel/reactive";\nimport { store } from "@keel/store";\nconst a = __kmoduleRoot(() => (signal(1))); const b = __kmoduleRoot(() => (computed(1))); const c = __kmoduleRoot(() => (other(1))); const d = __kmoduleRoot(() => (r(1))); const e = __kmoduleRoot(() => (store(1,2)));',
    edges: [],
  },
  {
    name: "mod8",
    path: "src/s.ts",
    source: 'import { "signal" as sg } from "@keel/reactive";\nconst a = sg(1);',
    code: 'import { moduleRoot as __kmoduleRoot } from "@keel/reactive/internal";\nimport { "signal" as sg } from "@keel/reactive";\nconst a = __kmoduleRoot(() => (sg(1)));',
    edges: [],
  },
  {
    name: "imp",
    path: "C.tsx",
    source:
      'import { If } from "@keel/runtime-dom";\nimport {} from "@keel/runtime-dom";\nimport { x } from "@keel/runtime-dom";\nexport default function C() { return <If when={a}>x</If>; }',
    code: 'import * as __k from "@keel/runtime-dom/ops";\nimport { scope as __kscope } from "@keel/reactive";\nconst __kscoped = (f) => { let v; __kscope(() => { v = f(); }); return v; };\n\nimport {} from "@keel/runtime-dom";\nimport { x } from "@keel/runtime-dom";\nexport default function C() { return __kscoped(() => {  return __k.frag((__kf0) => { const __ka1 = __kf0.appendChild(document.createComment("")); __k.cond(__ka1, () => (a), () => __k.frag((__kf2) => { __kf2.append("x"); })); });  }); }',
    edges: [],
  },
  {
    name: "imp2",
    path: "C.tsx",
    source: 'import { If, x } from "@keel/runtime-dom";\nexport default function C() { return <If when={a}>x</If>; }',
    code: 'import * as __k from "@keel/runtime-dom/ops";\nimport { scope as __kscope } from "@keel/reactive";\nconst __kscoped = (f) => { let v; __kscope(() => { v = f(); }); return v; };\nimport { If, x } from "@keel/runtime-dom";\nexport default function C() { return __kscoped(() => {  return __k.frag((__kf0) => { const __ka1 = __kf0.appendChild(document.createComment("")); __k.cond(__ka1, () => (a), () => __k.frag((__kf2) => { __kf2.append("x"); })); });  }); }',
    edges: [],
  },
  {
    name: "imp3",
    path: "C.tsx",
    source:
      'import { If, For as F } from "@keel/runtime-dom";\nimport D from "@keel/runtime-dom";\nexport default function C() { return <F each={a}>{(x)=>x}</F>; }',
    code: 'import * as __k from "@keel/runtime-dom/ops";\nimport { scope as __kscope } from "@keel/reactive";\nconst __kscoped = (f) => { let v; __kscope(() => { v = f(); }); return v; };\n\nimport D from "@keel/runtime-dom";\nexport default function C() { return __kscoped(() => {  return __k.frag((__kf0) => { const __ka1 = __kf0.appendChild(document.createComment("")); __k.list(__ka1, () => (a), (__kv2) => __kv2, (x)=>x()); });  }); }',
    edges: [],
  },
  {
    name: "imp4",
    path: "C.tsx",
    source:
      'import "@keel/runtime-dom";\nimport * as R from "@keel/runtime-dom";\nimport { If } from "other";\nexport default function C() { return <p/>; }',
    code: 'import * as __k from "@keel/runtime-dom/ops";\nimport { scope as __kscope } from "@keel/reactive";\nconst __kscoped = (f) => { let v; __kscope(() => { v = f(); }); return v; };\nconst __kt0 = __k.template("<p id=\\"C.0\\"></p>");\nimport "@keel/runtime-dom";\nimport * as R from "@keel/runtime-dom";\nimport { If } from "other";\nexport default function C() { return __kscoped(() => {  return __k.clone(__kt0);  }); }',
    edges: [],
  },
  {
    name: "noops",
    path: "C.tsx",
    source: "export default function C() { return 1; }",
    code: "export default function C() { return 1; }",
    edges: [],
  },
  {
    name: "ns",
    path: "C.tsx",
    source: "const __k = 1; const __k_ = 2; export default function C() { return <p/>; }",
    code: 'import * as __k__ from "@keel/runtime-dom/ops";\nimport { scope as __k__scope } from "@keel/reactive";\nconst __k__scoped = (f) => { let v; __k__scope(() => { v = f(); }); return v; };\nconst __k__t0 = __k__.template("<p id=\\"C.0\\"></p>");\nconst __k = 1; const __k_ = 2; export default function C() { return __k__scoped(() => {  return __k__.clone(__k__t0);  }); }',
    edges: [],
  },
  {
    name: "slot",
    path: "C.tsx",
    source:
      'export default function C(p, slots) { return <div>{p.children()}{slots.a()}{children()}{p?.children?.()}{x.y()}{slots[a]()}{a ?? b}{p.children() ?? 1}{slots.a?.()}{f()}{x.slots.a()}{"s"}{5}{"<"}{true}{<b/>}{<></>}{...z}</div>; }',
    code: 'import * as __k from "@keel/runtime-dom/ops";\nimport { scope as __kscope } from "@keel/reactive";\nconst __kscoped = (f) => { let v; __kscope(() => { v = f(); }); return v; };\nconst __kt0 = __k.template("<b id=\\"C.1\\"></b>");\nconst __kt1 = __k.template("<div id=\\"C.0\\"><!----> <!----><!----> <!----> <!----> <!----> <!----> <!----> <!---->s5&lt;<!----><!----> </div>");\nexport default function C(p, slots) { return __kscoped(() => {  return (() => { const __kr0 = __k.clone(__kt1); const __kn1 = __kr0.childNodes[0]; const __kn2 = __kr0.childNodes[1]; const __kn3 = __kr0.childNodes[2]; const __kn4 = __kr0.childNodes[3]; const __kn5 = __kr0.childNodes[4]; const __kn6 = __kr0.childNodes[6]; const __kn7 = __kr0.childNodes[8]; const __kn8 = __kr0.childNodes[9]; const __kn9 = __kr0.childNodes[10]; const __kn10 = __kr0.childNodes[12]; const __kn11 = __kr0.childNodes[14]; const __kn12 = __kr0.childNodes[17]; const __kn14 = __kr0.childNodes[18]; const __kn16 = __kr0.childNodes[19]; __k.slot(__kn1, () => (p.children()) ?? ""); __k.text(__kn2, () => (slots.a())); __k.slot(__kn3, () => (children()) ?? ""); __k.slot(__kn4, () => (p?.children?.()) ?? ""); __k.text(__kn5, () => (x.y())); __k.text(__kn6, () => (slots[a]())); __k.text(__kn7, () => (a ?? b)); __k.slot(__kn8, () => (p.children() ?? 1) ?? ""); __k.text(__kn9, () => (slots.a?.())); __k.text(__kn10, () => (f())); __k.text(__kn11, () => (x.slots.a())); __k.slot(__kn12, () => __k.clone(__kt0)); __k.slot(__kn14, () => __k.frag((__kf15) => {  })); __k.text(__kn16, () => (z)); return __kr0; })();  }); }',
    edges: [],
  },
  {
    name: "slot2",
    path: "C.tsx",
    source:
      'export default function C(p) { return <div>{"a"}{"b"} text {p.x}<></><p>{1}</p>{(p.children())}{m.children}</div>; }',
    code: 'import * as __k from "@keel/runtime-dom/ops";\nimport { scope as __kscope } from "@keel/reactive";\nconst __kscoped = (f) => { let v; __kscope(() => { v = f(); }); return v; };\nconst __kt0 = __k.template("<div id=\\"C.0\\">ab text <!----> <p id=\\"C.1\\">1</p><!----> </div>");\nexport default function C(p) { return __kscoped(() => {  return (() => { const __kr0 = __k.clone(__kt0); const __kn1 = __kr0.childNodes[2]; const __kn2 = __kr0.childNodes[4]; const __kn3 = __kr0.childNodes[5]; __k.text(__kn1, () => (p.x)); __k.slot(__kn2, () => (p.children()) ?? ""); __k.text(__kn3, () => (m.children)); return __kr0; })();  }); }',
    edges: [],
  },
  {
    name: "nest",
    path: "C.tsx",
    source:
      "function K(p) { return <i/> }\nexport default function C(p) { const inner = (q) => <K a={q}/>; return <div>{inner(1)}</div>; }\nexport function D(p) { return <K/> }",
    code: 'import * as __k from "@keel/runtime-dom/ops";\nimport { scope as __kscope } from "@keel/reactive";\nconst __kscoped = (f) => { let v; __kscope(() => { v = f(); }); return v; };\nconst __kt0 = __k.template("<i id=\\"C.0\\"></i>");\nconst __kt1 = __k.template("<div id=\\"C.1\\"></div>");\nfunction K(p) { return __kscoped(() => {  return __k.clone(__kt0)  }); }\nexport default function C(p, __kctx) { return __kscoped(() => {  const inner = (q) => K({ get a() { return (q); } }, __kctx); return __k.clone(__kt1);  }); }\nexport function D(p, __kctx) { return __kscoped(() => {  return K({}, __kctx)  }); }',
    edges: [],
  },
  {
    name: "nest2",
    path: "C.tsx",
    source:
      "function K(p) { return <i/> }\nexport function A(p, s, ctxA) { return <p/> }\nexport function B(p) { function Inner(z) { return <K/> } return <K/> }",
    code: 'import * as __k from "@keel/runtime-dom/ops";\nimport { scope as __kscope } from "@keel/reactive";\nconst __kscoped = (f) => { let v; __kscope(() => { v = f(); }); return v; };\nconst __kt0 = __k.template("<i id=\\"C.0\\"></i>");\nconst __kt1 = __k.template("<p id=\\"C.1\\"></p>");\nfunction K(p) { return __kscoped(() => {  return __k.clone(__kt0)  }); }\nexport function A(p, s, ctxA) { return __kscoped(() => {  return __k.clone(__kt1)  }); }\nexport function B(p, __kctx) { return __kscoped(() => {  function Inner(z, __kctx) { return __kscoped(() => {  return K({}, __kctx)  }); } return K({}, __kctx)  }); }',
    edges: [],
  },
  {
    name: "deps",
    path: "D.tsx",
    source:
      'import { If, For, Match, Case, Boundary } from "@keel/runtime-dom";\nimport { signal } from "@keel/reactive";\nconst xs = signal([]); const on = signal(1); const st = signal(1); const fb = signal(1); const e = signal(1);\nexport default function D(props) { return <section><If when={on.get() && props.w}><b>{xs.get().length}</b></If><For each={xs.get()} key="id" empty={fb.get()}>{(x) => <i>{x.id}</i>}</For><Match on={st.get()}><Case tag="a">x</Case></Match><Boundary fallback={e.get()}>y</Boundary><p>{props.t}<span {...props.rest} onClick={props.h}>{xs.get()}</span></p></section>; }',
    code: 'import * as __k from "@keel/runtime-dom/ops";\nimport { scope as __kscope } from "@keel/reactive";\nconst __kscoped = (f) => { let v; __kscope(() => { v = f(); }); return v; };\nimport { moduleRoot as __kmoduleRoot } from "@keel/reactive/internal";\nconst __kt0 = __k.template("<b id=\\"D.1\\" data-k=\\"D.1\\"> </b>");\nconst __kt1 = __k.template("<i id=\\"D.2\\"> </i>");\nconst __kt2 = __k.template("<section id=\\"D.0\\" data-k=\\"D.0\\"><!----><!----><!----><!----><p id=\\"D.3\\"> <span id=\\"D.4\\" data-k=\\"D.4\\"> </span></p></section>");\n\nimport { signal } from "@keel/reactive";\nconst xs = __kmoduleRoot(() => (signal([]))); const on = __kmoduleRoot(() => (signal(1))); const st = __kmoduleRoot(() => (signal(1))); const fb = __kmoduleRoot(() => (signal(1))); const e = __kmoduleRoot(() => (signal(1)));\nexport default function D(props) { return __kscoped(() => {  return (() => { const __kr0 = __k.clone(__kt2); const __kn1 = __kr0.childNodes[0]; const __kn4 = __kr0.childNodes[1]; const __kn8 = __kr0.childNodes[2]; const __kn10 = __kr0.childNodes[3]; const __ke12 = __kr0.querySelector("[id=\\"D.3\\"]"); const __kn13 = __ke12.childNodes[0]; const __ke16 = __kr0.querySelector("[id=\\"D.4\\"]"); const __kn17 = __ke16.childNodes[0]; __k.cond(__kn1, () => (on.get() && props.w), () => (() => { const __kr2 = __k.clone(__kt0); const __kn3 = __kr2.childNodes[0]; __k.text(__kn3, () => (xs.get().length)); return __kr2; })()); __k.list(__kn4, () => (xs.get()), (__kv5) => __kv5["id"], (x) => (() => { const __kr6 = __k.clone(__kt1); const __kn7 = __kr6.childNodes[0]; __k.text(__kn7, () => (x().id)); return __kr6; })(), fb.get()); __k.match(__kn8, () => (st.get()), "tag", { "a": () => __k.frag((__kf9) => { __kf9.append("x"); }) }); __k.boundary(__kn10, () => __k.frag((__kf11) => { __kf11.append("y"); }), e.get()); __k.text(__kn13, () => (props.t)); { const __ks14 = (props.rest); for (const __kk15 in __ks14) __k.attr(__ke16, __kk15, () => __ks14[__kk15]); } __k.on("D.4", "click", (props.h)); __k.text(__kn17, () => (xs.get())); return __kr0; })();  }); }',
    edges: [
      { from: "D.tsx#on", to: "D.0:cond:when" },
      { from: "D.tsx#props.rest", to: "D.4:attr:..." },
      { from: "D.tsx#props.t", to: "D.3:text:#text" },
      { from: "D.tsx#props.w", to: "D.0:cond:when" },
      { from: "D.tsx#st", to: "D.0:match:on" },
      { from: "D.tsx#xs", to: "D.0:list:each" },
      { from: "D.tsx#xs", to: "D.1:text:#text" },
      { from: "D.tsx#xs", to: "D.4:text:#text" },
    ],
  },
  {
    name: "deps2",
    path: "D.tsx",
    source:
      'import { If, For, Match, Case, Boundary } from "@keel/runtime-dom";\nexport default function D(props) { return <><If when={props.a}>{props.b}</If><p>{props.c}</p></>; }',
    code: 'import * as __k from "@keel/runtime-dom/ops";\nimport { scope as __kscope } from "@keel/reactive";\nconst __kscoped = (f) => { let v; __kscope(() => { v = f(); }); return v; };\nconst __kt0 = __k.template("<p id=\\"D.0\\"> </p>");\n\nexport default function D(props) { return __kscoped(() => {  return __k.frag((__kf0) => { const __ka1 = __kf0.appendChild(document.createComment("")); __k.cond(__ka1, () => (props.a), () => __k.frag((__kf2) => { const __kt3 = document.createTextNode(""); __k.text(__kt3, () => (props.b)); __kf2.append(__kt3); })); __kf0.append((() => { const __kr4 = __k.clone(__kt0); const __kn5 = __kr4.childNodes[0]; __k.text(__kn5, () => (props.c)); return __kr4; })()); });  }); }',
    edges: [
      { from: "D.tsx#props.a", to: "D:cond:when" },
      { from: "D.tsx#props.b", to: "D:text:#text" },
      { from: "D.tsx#props.c", to: "D.0:text:#text" },
    ],
  },
];

describe("lowerFile golden output (second half)", () => {
  it.each(cases)("emits the exact module for $name", ({ path, source, code, edges }) => {
    const r = compile([{ path, source }]);
    expect(r.outputs[0]?.code).toBe(code);
    if (edges.length > 0) expect(r.artifacts["deps.json"].edges).toEqual(edges);
  });
});
