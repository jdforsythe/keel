// Mutation-killing tests for the first half of lowerFile.ts: exact lowered output and dependency edges.
import { compile } from "@keel/compiler";
import { describe, expect, it } from "vitest";

type Fixture = { name: string; source: string; code: string; deps: unknown };

const FIXTURES: readonly Fixture[] = [
  {
    name: "slots",
    source:
      "export default function T(props, slots) { return <div>{slots.head()}{props.children?.()}{props.body()}{slots.a?.()}{slots.x() ?? 1}{children()}{foo()}{slots[k]()}{props[k]()}{o.slots()}{a.b.slots()}{s.slots.y()}{slots.x() || 1}{(slots.p())}{props.foo?.bar()}</div> }",
    code: 'import * as __k from "@keel/runtime-dom/ops";\nconst __kt0 = __k.template("<div id=\\"T.0\\"><!----><!----> <!----><!----><!----> <!----> <!----> <!----> <!----> <!----> <!----> <!----> </div>");\nexport default function T(props, slots) { return (() => { const __kr0 = __k.clone(__kt0); const __kn1 = __kr0.childNodes[0]; const __kn2 = __kr0.childNodes[1]; const __kn3 = __kr0.childNodes[2]; const __kn4 = __kr0.childNodes[3]; const __kn5 = __kr0.childNodes[4]; const __kn6 = __kr0.childNodes[5]; const __kn7 = __kr0.childNodes[6]; const __kn8 = __kr0.childNodes[8]; const __kn9 = __kr0.childNodes[10]; const __kn10 = __kr0.childNodes[12]; const __kn11 = __kr0.childNodes[14]; const __kn12 = __kr0.childNodes[16]; const __kn13 = __kr0.childNodes[18]; const __kn14 = __kr0.childNodes[19]; const __kn15 = __kr0.childNodes[20]; __kn1.replaceWith((slots.head()) ?? ""); __kn2.replaceWith((props.children?.()) ?? ""); __k.text(__kn3, () => (props.body())); __kn4.replaceWith((slots.a?.()) ?? ""); __kn5.replaceWith((slots.x() ?? 1) ?? ""); __kn6.replaceWith((children()) ?? ""); __k.text(__kn7, () => (foo())); __k.text(__kn8, () => (slots[k]())); __k.text(__kn9, () => (props[k]())); __k.text(__kn10, () => (o.slots())); __k.text(__kn11, () => (a.b.slots())); __k.text(__kn12, () => (s.slots.y())); __k.text(__kn13, () => (slots.x() || 1)); __kn14.replaceWith((slots.p()) ?? ""); __k.text(__kn15, () => (props.foo?.bar())); return __kr0; })() }',
    deps: {
      edges: [
        { from: "T.tsx#props.body", to: "T.0:text:#text" },
        { from: "T.tsx#props.foo", to: "T.0:text:#text:8" },
      ],
      nodes: [
        { id: "T.0:text:#text", kind: "binding", name: "text #text", file: "T.tsx" },
        { id: "T.0:text:#text:1", kind: "binding", name: "text #text", file: "T.tsx" },
        { id: "T.0:text:#text:2", kind: "binding", name: "text #text", file: "T.tsx" },
        { id: "T.0:text:#text:3", kind: "binding", name: "text #text", file: "T.tsx" },
        { id: "T.0:text:#text:4", kind: "binding", name: "text #text", file: "T.tsx" },
        { id: "T.0:text:#text:5", kind: "binding", name: "text #text", file: "T.tsx" },
        { id: "T.0:text:#text:6", kind: "binding", name: "text #text", file: "T.tsx" },
        { id: "T.0:text:#text:7", kind: "binding", name: "text #text", file: "T.tsx" },
        { id: "T.0:text:#text:8", kind: "binding", name: "text #text", file: "T.tsx" },
        { id: "T.tsx#props.body", kind: "prop", name: "body", file: "T.tsx" },
        { id: "T.tsx#props.foo", kind: "prop", name: "foo", file: "T.tsx" },
      ],
    },
  },
  {
    name: "frag",
    source:
      "export default function T({ a, b }) { return <div><>x{a}</>{...b}<span>{a} {b}</span>{\"q\"}{'r'}{7}{true}{null} lead <em>1</em> mid</div> }",
    code: 'import * as __k from "@keel/runtime-dom/ops";\nconst __kt0 = __k.template("<div id=\\"T.0\\">x<!----> <!----> <span id=\\"T.1\\"> <!---->  <!----> </span>qr7 lead <em id=\\"T.2\\">1</em> mid</div>");\nexport default function T(props) { return (() => { const __kr0 = __k.clone(__kt0); const __kn1 = __kr0.childNodes[2]; const __kn2 = __kr0.childNodes[4]; const __ke3 = __kr0.querySelector("[id=\\"T.1\\"]"); const __kn4 = __ke3.childNodes[0]; const __kn5 = __ke3.childNodes[4]; __k.text(__kn1, () => (props.a)); __k.text(__kn2, () => (props.b)); __k.text(__kn4, () => (props.a)); __k.text(__kn5, () => (props.b)); return __kr0; })() }',
    deps: {
      edges: [],
      nodes: [
        { id: "T.0:text:#text", kind: "binding", name: "text #text", file: "T.tsx" },
        { id: "T.0:text:#text:1", kind: "binding", name: "text #text", file: "T.tsx" },
        { id: "T.1:text:#text", kind: "binding", name: "text #text", file: "T.tsx" },
        { id: "T.1:text:#text:1", kind: "binding", name: "text #text", file: "T.tsx" },
      ],
    },
  },
  {
    name: "ns",
    source: "const __k = 1;\nexport default function T() { return <div>{__k}</div> }",
    code: 'import * as __k_ from "@keel/runtime-dom/ops";\nconst __k_t0 = __k_.template("<div id=\\"T.0\\"> </div>");\nconst __k = 1;\nexport default function T() { return (() => { const __k_r0 = __k_.clone(__k_t0); const __k_n1 = __k_r0.childNodes[0]; __k_.text(__k_n1, () => (__k)); return __k_r0; })() }',
    deps: { edges: [], nodes: [{ id: "T.0:text:#text", kind: "binding", name: "text #text", file: "T.tsx" }] },
  },
  {
    name: "attrs",
    source:
      'export default function T(props) { return <div>\n<a className="x" htmlFor="y" onClick={props.c} onDoubleClick={props.d} ONCLICK={props.e} onKeyDown={props.k} key="z" dangerouslySetInnerHTML={{ __html: "x" }} {...props.s} {...props.t} />\n<i title="a&quot;b" alt="a&amp;b" lang=\'say "hi"\' data-x="<>&" src="data:text/html,x" href="  JavaScript:1" action="java&#115;cript:1" formAction="/ok" disabled hidden={true} count={3} name={`n`} />\n<img src="/a.png" width={props.w} />\n<select value={props.v} selected={props.s2} muted={props.m} indeterminate={props.i} />\n<button onClick>x</button>\n</div> }',
    code: 'import * as __k from "@keel/runtime-dom/ops";\nconst __kt0 = __k.template("<div id=\\"T.0\\"><a id=\\"T.1\\" class=\\"x\\" for=\\"y\\"></a><i id=\\"T.2\\" title=\\"a&quot;b\\" alt=\\"a&amp;b\\" lang=\\"say &quot;hi&quot;\\" data-x=\\"<>&\\" src=\\"about:blank\\" href=\\"about:blank\\" action=\\"about:blank\\" formAction=\\"/ok\\" disabled=\\"\\" count=\\"3\\" name=\\"n\\"></i><img id=\\"T.3\\" src=\\"/a.png\\"><select id=\\"T.4\\"></select><button id=\\"T.5\\">x</button></div>");\nexport default function T(props) { return (() => { const __kr0 = __k.clone(__kt0); const __ke3 = __kr0.querySelector("[id=\\"T.1\\"]"); const __ke6 = __kr0.querySelector("[id=\\"T.2\\"]"); const __ke7 = __kr0.querySelector("[id=\\"T.3\\"]"); const __ke8 = __kr0.querySelector("[id=\\"T.4\\"]"); __k.on("T.1", "click", (props.c)); __k.on("T.1", "dblclick", (props.d)); __k.on("T.1", "click", (props.e)); __k.on("T.1", "keydown", (props.k)); { const __ks1 = (props.s); for (const __kk2 in __ks1) __k.attr(__ke3, __kk2, () => __ks1[__kk2]); } { const __ks4 = (props.t); for (const __kk5 in __ks4) __k.attr(__ke3, __kk5, () => __ks4[__kk5]); } __k.attr(__ke6, "hidden", () => (true)); __k.attr(__ke7, "width", () => (props.w)); __k.prop(__ke8, "value", () => (props.v)); __k.prop(__ke8, "selected", () => (props.s2)); __k.prop(__ke8, "muted", () => (props.m)); __k.prop(__ke8, "indeterminate", () => (props.i)); return __kr0; })() }',
    deps: {
      edges: [
        { from: "T.tsx#props.i", to: "T.4:prop:indeterminate" },
        { from: "T.tsx#props.m", to: "T.4:prop:muted" },
        { from: "T.tsx#props.s", to: "T.1:attr:..." },
        { from: "T.tsx#props.s2", to: "T.4:prop:selected" },
        { from: "T.tsx#props.t", to: "T.1:attr:...:1" },
        { from: "T.tsx#props.v", to: "T.4:prop:value" },
        { from: "T.tsx#props.w", to: "T.3:attr:width" },
      ],
      nodes: [
        { id: "T.1:attr:...", kind: "binding", name: "attr ...", file: "T.tsx" },
        { id: "T.1:attr:...:1", kind: "binding", name: "attr ...", file: "T.tsx" },
        { id: "T.1:on:click", kind: "binding", name: "on click", file: "T.tsx" },
        { id: "T.1:on:click:1", kind: "binding", name: "on click", file: "T.tsx" },
        { id: "T.1:on:dblclick", kind: "binding", name: "on dblclick", file: "T.tsx" },
        { id: "T.1:on:keydown", kind: "binding", name: "on keydown", file: "T.tsx" },
        { id: "T.2:attr:hidden", kind: "binding", name: "attr hidden", file: "T.tsx" },
        { id: "T.3:attr:width", kind: "binding", name: "attr width", file: "T.tsx" },
        { id: "T.4:prop:indeterminate", kind: "binding", name: "prop indeterminate", file: "T.tsx" },
        { id: "T.4:prop:muted", kind: "binding", name: "prop muted", file: "T.tsx" },
        { id: "T.4:prop:selected", kind: "binding", name: "prop selected", file: "T.tsx" },
        { id: "T.4:prop:value", kind: "binding", name: "prop value", file: "T.tsx" },
        { id: "T.tsx#props.i", kind: "prop", name: "i", file: "T.tsx" },
        { id: "T.tsx#props.m", kind: "prop", name: "m", file: "T.tsx" },
        { id: "T.tsx#props.s", kind: "prop", name: "s", file: "T.tsx" },
        { id: "T.tsx#props.s2", kind: "prop", name: "s2", file: "T.tsx" },
        { id: "T.tsx#props.t", kind: "prop", name: "t", file: "T.tsx" },
        { id: "T.tsx#props.v", kind: "prop", name: "v", file: "T.tsx" },
        { id: "T.tsx#props.w", kind: "prop", name: "w", file: "T.tsx" },
      ],
    },
  },
  {
    name: "nest",
    source:
      "export default function T(props) { return <ul><li>a</li><p>t<div>d1</div><div>d2{props.x}</div></p><a><a>n</a></a><table><tr><td>c</td></tr></table><button><button>b</button></button><li><li>i</li></li></ul> }",
    code: 'import * as __k from "@keel/runtime-dom/ops";\nconst __kt0 = __k.template("<div id=\\"T.3\\">d1</div>");\nconst __kt1 = __k.template("<div id=\\"T.4\\">d2<!----> </div>");\nconst __kt2 = __k.template("<a id=\\"T.6\\">n</a>");\nconst __kt3 = __k.template("<tr id=\\"T.8\\"><td id=\\"T.9\\">c</td></tr>");\nconst __kt4 = __k.template("<button id=\\"T.11\\">b</button>");\nconst __kt5 = __k.template("<li id=\\"T.13\\">i</li>");\nconst __kt6 = __k.template("<ul id=\\"T.0\\"><li id=\\"T.1\\">a</li><p id=\\"T.2\\">t<!----><!----></p><a id=\\"T.5\\"><!----></a><table id=\\"T.7\\"><!----></table><button id=\\"T.10\\"><!----></button><li id=\\"T.12\\"><!----></li></ul>");\nexport default function T(props) { return (() => { const __kr0 = __k.clone(__kt6); const __ke1 = __kr0.querySelector("[id=\\"T.2\\"]"); const __kn2 = __ke1.childNodes[1]; const __kn4 = __ke1.childNodes[2]; const __ke7 = __kr0.querySelector("[id=\\"T.5\\"]"); const __kn8 = __ke7.childNodes[0]; const __ke10 = __kr0.querySelector("[id=\\"T.7\\"]"); const __kn11 = __ke10.childNodes[0]; const __ke13 = __kr0.querySelector("[id=\\"T.10\\"]"); const __kn14 = __ke13.childNodes[0]; const __ke16 = __kr0.querySelector("[id=\\"T.12\\"]"); const __kn17 = __ke16.childNodes[0]; __kn2.replaceWith(__k.clone(__kt0)); __kn4.replaceWith((() => { const __kr5 = __k.clone(__kt1); const __kn6 = __kr5.childNodes[2]; __k.text(__kn6, () => (props.x)); return __kr5; })()); __kn8.replaceWith(__k.clone(__kt2)); __kn11.replaceWith(__k.clone(__kt3)); __kn14.replaceWith(__k.clone(__kt4)); __kn17.replaceWith(__k.clone(__kt5)); return __kr0; })() }',
    deps: {
      edges: [{ from: "T.tsx#props.x", to: "T.4:text:#text" }],
      nodes: [
        { id: "T.4:text:#text", kind: "binding", name: "text #text", file: "T.tsx" },
        { id: "T.tsx#props.x", kind: "prop", name: "x", file: "T.tsx" },
      ],
    },
  },
  {
    name: "a",
    source:
      'import { signal } from \'@keel/reactive\'\nconst n = signal(0)\nexport default function T(props) { return <div className="a" htmlFor="x" onDoubleClick={() => 1} {...props.rest}><span key="k" dangerouslySetInnerHTML={{__html:\'x\'}}/>{"lit"}{5}{<b/>}{props.children()}{slots.head()}{n.get()} t<i>a</i> <input value={n.get()} disabled href="javascript:alert(1)" /><a href="javascript:x" title="a&amp;b &quot;">z</a><p><div>bad</div></p>{}</div> }',
    code: 'import * as __k from "@keel/runtime-dom/ops";\nimport { scope as __kscope } from "@keel/reactive";\nconst __kroot = (f) => { let v; __kscope(() => { v = f(); }); return v; };\nconst __kt0 = __k.template("<b id=\\"T.2\\"></b>");\nconst __kt1 = __k.template("<div id=\\"T.7\\">bad</div>");\nconst __kt2 = __k.template("<div id=\\"T.0\\" class=\\"a\\" for=\\"x\\"><span id=\\"T.1\\"></span>lit5<!----><!----><!----> <!----> t<i id=\\"T.3\\">a</i>  <input id=\\"T.4\\" disabled=\\"\\" href=\\"about:blank\\"><a id=\\"T.5\\" href=\\"about:blank\\" title=\\"a&amp;b &quot;\\">z</a><p id=\\"T.6\\"><!----></p></div>");\nimport { signal } from \'@keel/reactive\'\nconst n = __kroot(() => signal(0))\nexport default function T(props) { return (() => { const __kr0 = __k.clone(__kt2); const __kn3 = __kr0.childNodes[2]; const __kn5 = __kr0.childNodes[3]; const __kn6 = __kr0.childNodes[4]; const __kn7 = __kr0.childNodes[5]; const __ke8 = __kr0.querySelector("[id=\\"T.4\\"]"); const __ke9 = __kr0.querySelector("[id=\\"T.6\\"]"); const __kn10 = __ke9.childNodes[0]; __k.on("T.0", "dblclick", (() => 1)); { const __ks1 = (props.rest); for (const __kk2 in __ks1) __k.attr(__kr0, __kk2, () => __ks1[__kk2]); } __kn3.replaceWith(__k.clone(__kt0)); __kn5.replaceWith((props.children()) ?? ""); __kn6.replaceWith((slots.head()) ?? ""); __k.text(__kn7, () => (n.get())); __k.prop(__ke8, "value", () => (n.get())); __kn10.replaceWith(__k.clone(__kt1)); return __kr0; })() }',
    deps: {
      edges: [
        { from: "T.tsx#n", to: "T.0:text:#text" },
        { from: "T.tsx#n", to: "T.4:prop:value" },
        { from: "T.tsx#props.rest", to: "T.0:attr:..." },
      ],
      nodes: [
        { id: "T.0:attr:...", kind: "binding", name: "attr ...", file: "T.tsx" },
        { id: "T.0:on:dblclick", kind: "binding", name: "on dblclick", file: "T.tsx" },
        { id: "T.0:text:#text", kind: "binding", name: "text #text", file: "T.tsx" },
        { id: "T.4:prop:value", kind: "binding", name: "prop value", file: "T.tsx" },
        { id: "T.tsx#n", kind: "signal", name: "n", file: "T.tsx" },
        { id: "T.tsx#props.rest", kind: "prop", name: "rest", file: "T.tsx" },
      ],
    },
  },
  {
    name: "b",
    source:
      'import { signal } from \'@keel/reactive\'\nconst n = signal(0)\nconst m = signal(1)\nexport default function T(props) { return <div>a{"b"}c{1}{n.get()}{m.get()} <p onClick={() => n.set(m.get())} title={props.t} value={n.get()} className={m.get()} id="q" y=<b/> >x &lt; y {"<&"} {} </p><textarea checked={n.get()}/>{props.a?.b}{(props.children)?.()}</div> }',
    code: 'import * as __k from "@keel/runtime-dom/ops";\nimport { scope as __kscope } from "@keel/reactive";\nconst __kroot = (f) => { let v; __kscope(() => { v = f(); }); return v; };\nconst __kt0 = __k.template("<b id=\\"T.2\\"></b>");\nconst __kt1 = __k.template("<div id=\\"T.0\\">abc1<!----> <!----> <!---->  <p id=\\"q\\">x &lt; y &lt;&amp;    </p><textarea id=\\"T.3\\"></textarea> <!----> </div>");\nimport { signal } from \'@keel/reactive\'\nconst n = __kroot(() => signal(0))\nconst m = __kroot(() => signal(1))\nexport default function T(props) { return (() => { const __kr0 = __k.clone(__kt1); const __kn1 = __kr0.childNodes[2]; const __kn2 = __kr0.childNodes[4]; const __ke3 = __kr0.querySelector("[id=\\"q\\"]"); const __ke5 = __kr0.querySelector("[id=\\"T.3\\"]"); const __kn6 = __kr0.childNodes[9]; const __kn7 = __kr0.childNodes[11]; __k.text(__kn1, () => (n.get())); __k.text(__kn2, () => (m.get())); __k.on("q", "click", (() => n.set(m.get()))); __k.attr(__ke3, "title", () => (props.t)); __k.prop(__ke3, "value", () => (n.get())); __k.attr(__ke3, "class", () => (m.get())); __k.attr(__ke3, "y", () => (__k.clone(__kt0))); __k.prop(__ke5, "checked", () => (n.get())); __k.text(__kn6, () => (props.a?.b)); __k.text(__kn7, () => ((props.children)?.())); return __kr0; })() }',
    deps: {
      edges: [
        { from: "T.tsx#m", to: "T.0:text:#text:1" },
        { from: "T.tsx#m", to: "q:attr:class" },
        { from: "T.tsx#n", to: "T.0:text:#text" },
        { from: "T.tsx#n", to: "T.3:prop:checked" },
        { from: "T.tsx#n", to: "q:prop:value" },
        { from: "T.tsx#props.a", to: "T.0:text:#text:2" },
        { from: "T.tsx#props.children", to: "T.0:text:#text:3" },
        { from: "T.tsx#props.t", to: "q:attr:title" },
      ],
      nodes: [
        { id: "T.0:text:#text", kind: "binding", name: "text #text", file: "T.tsx" },
        { id: "T.0:text:#text:1", kind: "binding", name: "text #text", file: "T.tsx" },
        { id: "T.0:text:#text:2", kind: "binding", name: "text #text", file: "T.tsx" },
        { id: "T.0:text:#text:3", kind: "binding", name: "text #text", file: "T.tsx" },
        { id: "T.3:prop:checked", kind: "binding", name: "prop checked", file: "T.tsx" },
        { id: "T.tsx#m", kind: "signal", name: "m", file: "T.tsx" },
        { id: "T.tsx#n", kind: "signal", name: "n", file: "T.tsx" },
        { id: "T.tsx#props.a", kind: "prop", name: "a", file: "T.tsx" },
        { id: "T.tsx#props.children", kind: "prop", name: "children", file: "T.tsx" },
        { id: "T.tsx#props.t", kind: "prop", name: "t", file: "T.tsx" },
        { id: "q:attr:class", kind: "binding", name: "attr class", file: "T.tsx" },
        { id: "q:attr:title", kind: "binding", name: "attr title", file: "T.tsx" },
        { id: "q:attr:y", kind: "binding", name: "attr y", file: "T.tsx" },
        { id: "q:on:click", kind: "binding", name: "on click", file: "T.tsx" },
        { id: "q:prop:value", kind: "binding", name: "prop value", file: "T.tsx" },
      ],
    },
  },
  {
    name: "c",
    source:
      "export function A(props) { return <a title={props.x + props.y} data-z={props.z.q}>{props.x}</a> }\nexport function B(p) { return <br title={p.k} /> }\nexport default function T(props) { return <div><A x={1}/><B/><A x={props.x}>hi</A></div> }",
    code: 'import * as __k from "@keel/runtime-dom/ops";\nconst __kt0 = __k.template("<a id=\\"T.0\\"> </a>");\nconst __kt1 = __k.template("<br id=\\"T.1\\">");\nconst __kt2 = __k.template("<div id=\\"T.2\\"><!----><!----><!----></div>");\nexport function A(props) { return (() => { const __kr0 = __k.clone(__kt0); const __kn1 = __kr0.childNodes[0]; __k.attr(__kr0, "title", () => (props.x + props.y)); __k.attr(__kr0, "data-z", () => (props.z.q)); __k.text(__kn1, () => (props.x)); return __kr0; })() }\nexport function B(p) { return (() => { const __kr2 = __k.clone(__kt1); __k.attr(__kr2, "title", () => (p.k)); return __kr2; })() }\nexport default function T(props, __kslots, __kctx) { return (() => { const __kr3 = __k.clone(__kt2); const __kn4 = __kr3.childNodes[0]; const __kn5 = __kr3.childNodes[1]; const __kn6 = __kr3.childNodes[2]; __kn4.replaceWith(A({ x: 1 }, undefined, __kctx)); __kn5.replaceWith(B({}, undefined, __kctx)); __kn6.replaceWith(A({ get x() { return (props.x); }, children: () => "hi" }, undefined, __kctx)); return __kr3; })() }',
    deps: {
      edges: [
        { from: "T.tsx#props.k", to: "T.1:attr:title" },
        { from: "T.tsx#props.x", to: "T.0:attr:title" },
        { from: "T.tsx#props.x", to: "T.0:text:#text" },
        { from: "T.tsx#props.y", to: "T.0:attr:title" },
        { from: "T.tsx#props.z", to: "T.0:attr:data-z" },
      ],
      nodes: [
        { id: "T.0:attr:data-z", kind: "binding", name: "attr data-z", file: "T.tsx" },
        { id: "T.0:attr:title", kind: "binding", name: "attr title", file: "T.tsx" },
        { id: "T.0:text:#text", kind: "binding", name: "text #text", file: "T.tsx" },
        { id: "T.1:attr:title", kind: "binding", name: "attr title", file: "T.tsx" },
        { id: "T.tsx#props.k", kind: "prop", name: "k", file: "T.tsx" },
        { id: "T.tsx#props.x", kind: "prop", name: "x", file: "T.tsx" },
        { id: "T.tsx#props.y", kind: "prop", name: "y", file: "T.tsx" },
        { id: "T.tsx#props.z", kind: "prop", name: "z", file: "T.tsx" },
      ],
    },
  },
  {
    name: "d",
    source:
      'export default function T(props) { return <form id="z" onSubmit={(e) => e.preventDefault()}><input id="a" onChange={props.f} onFocus/></form> }',
    code: 'import * as __k from "@keel/runtime-dom/ops";\nconst __kt0 = __k.template("<form id=\\"z\\"><input id=\\"a\\"></form>");\nexport default function T(props) { return (() => { const __kr0 = __k.clone(__kt0); __k.on("z", "submit", ((e) => e.preventDefault())); __k.on("a", "change", (props.f)); return __kr0; })() }',
    deps: {
      edges: [],
      nodes: [
        { id: "a:on:change", kind: "binding", name: "on change", file: "T.tsx" },
        { id: "z:on:submit", kind: "binding", name: "on submit", file: "T.tsx" },
      ],
    },
  },
  {
    name: "reads",
    source:
      "import { signal } from '@keel/reactive'\nconst b2 = signal(1)\nconst a1 = signal(2)\nexport default function T($p) { return <div title={b2.get() + a1.get() + $p?.q + other.$p.z + $p.w + x$p.v}>{a1.get()}</div> }",
    code: 'import * as __k from "@keel/runtime-dom/ops";\nimport { scope as __kscope } from "@keel/reactive";\nconst __kroot = (f) => { let v; __kscope(() => { v = f(); }); return v; };\nconst __kt0 = __k.template("<div id=\\"T.0\\"> </div>");\nimport { signal } from \'@keel/reactive\'\nconst b2 = __kroot(() => signal(1))\nconst a1 = __kroot(() => signal(2))\nexport default function T($p) { return (() => { const __kr0 = __k.clone(__kt0); const __kn1 = __kr0.childNodes[0]; __k.attr(__kr0, "title", () => (b2.get() + a1.get() + $p?.q + other.$p.z + $p.w + x$p.v)); __k.text(__kn1, () => (a1.get())); return __kr0; })() }',
    deps: {
      edges: [
        { from: "T.tsx#a1", to: "T.0:attr:title" },
        { from: "T.tsx#a1", to: "T.0:text:#text" },
        { from: "T.tsx#b2", to: "T.0:attr:title" },
        { from: "T.tsx#props.q", to: "T.0:attr:title" },
        { from: "T.tsx#props.w", to: "T.0:attr:title" },
      ],
      nodes: [
        { id: "T.0:attr:title", kind: "binding", name: "attr title", file: "T.tsx" },
        { id: "T.0:text:#text", kind: "binding", name: "text #text", file: "T.tsx" },
        { id: "T.tsx#a1", kind: "signal", name: "a1", file: "T.tsx" },
        { id: "T.tsx#b2", kind: "signal", name: "b2", file: "T.tsx" },
        { id: "T.tsx#props.q", kind: "prop", name: "q", file: "T.tsx" },
        { id: "T.tsx#props.w", kind: "prop", name: "w", file: "T.tsx" },
      ],
    },
  },
  {
    name: "for1",
    source:
      "import { For } from '@keel/runtime-dom'\nexport default function T(props) { return <ul><For each={props.rows} key=\"id\">{(item, i, extra) => <li>{item.id}{i}{extra}</li>}</For></ul> }",
    code: 'import * as __k from "@keel/runtime-dom/ops";\nconst __kt0 = __k.template("<li id=\\"T.1\\"> <!----> <!----> </li>");\nconst __kt1 = __k.template("<ul id=\\"T.0\\"><!----></ul>");\n\nexport default function T(props) { return (() => { const __kr0 = __k.clone(__kt1); const __kn1 = __kr0.childNodes[0]; __k.list(__kn1, () => (props.rows), (__kv2) => __kv2["id"], (item, i, extra) => (() => { const __kr3 = __k.clone(__kt0); const __kn4 = __kr3.childNodes[0]; const __kn5 = __kr3.childNodes[2]; const __kn6 = __kr3.childNodes[4]; __k.text(__kn4, () => (item().id)); __k.text(__kn5, () => (i())); __k.text(__kn6, () => (extra)); return __kr3; })()); return __kr0; })() }',
    deps: {
      edges: [{ from: "T.tsx#props.rows", to: "T.0:list:each" }],
      nodes: [
        { id: "T.0:list:each", kind: "binding", name: "list each", file: "T.tsx" },
        { id: "T.1:text:#text", kind: "binding", name: "text #text", file: "T.tsx" },
        { id: "T.1:text:#text:1", kind: "binding", name: "text #text", file: "T.tsx" },
        { id: "T.1:text:#text:2", kind: "binding", name: "text #text", file: "T.tsx" },
        { id: "T.tsx#props.rows", kind: "prop", name: "rows", file: "T.tsx" },
      ],
    },
  },
  {
    name: "for2",
    source:
      "import { For } from '@keel/runtime-dom'\nexport default function T(props) { return <ul><For each={props.rows} key=\"id\">{({ id }) => <li>{id}</li>}</For></ul> }",
    code: 'import * as __k from "@keel/runtime-dom/ops";\nconst __kt0 = __k.template("<li id=\\"T.1\\"> </li>");\nconst __kt1 = __k.template("<ul id=\\"T.0\\"><!----></ul>");\n\nexport default function T(props) { return (() => { const __kr0 = __k.clone(__kt1); const __kn1 = __kr0.childNodes[0]; __k.list(__kn1, () => (props.rows), (__kv2) => __kv2["id"], (__kx3, __ku5, __kp4 = ({ id }) => ({ id })) => (() => { const __kr6 = __k.clone(__kt0); const __kn7 = __kr6.childNodes[0]; __k.text(__kn7, () => (__kp4(__kx3()).id)); return __kr6; })()); return __kr0; })() }',
    deps: {
      edges: [{ from: "T.tsx#props.rows", to: "T.0:list:each" }],
      nodes: [
        { id: "T.0:list:each", kind: "binding", name: "list each", file: "T.tsx" },
        { id: "T.1:text:#text", kind: "binding", name: "text #text", file: "T.tsx" },
        { id: "T.tsx#props.rows", kind: "prop", name: "rows", file: "T.tsx" },
      ],
    },
  },
  {
    name: "for3",
    source:
      "import { For } from '@keel/runtime-dom'\nexport default function T(props) { return <ul><For each={props.rows} key=\"id\">{(a, { b = a }) => <li>{a.id}{b}</li>}</For></ul> }",
    code: 'import * as __k from "@keel/runtime-dom/ops";\nconst __kt0 = __k.template("<li id=\\"T.1\\"> <!----> </li>");\nconst __kt1 = __k.template("<ul id=\\"T.0\\"><!----></ul>");\n\nexport default function T(props) { return (() => { const __kr0 = __k.clone(__kt1); const __kn1 = __kr0.childNodes[0]; __k.list(__kn1, () => (props.rows), (__kv2) => __kv2["id"], (a, __kx3, __kp4 = ({ b = a }) => ({ b })) => (() => { const __kr5 = __k.clone(__kt0); const __kn6 = __kr5.childNodes[0]; const __kn7 = __kr5.childNodes[2]; __k.text(__kn6, () => (a().id)); __k.text(__kn7, () => (__kp4(__kx3()).b)); return __kr5; })()); return __kr0; })() }',
    deps: {
      edges: [{ from: "T.tsx#props.rows", to: "T.0:list:each" }],
      nodes: [
        { id: "T.0:list:each", kind: "binding", name: "list each", file: "T.tsx" },
        { id: "T.1:text:#text", kind: "binding", name: "text #text", file: "T.tsx" },
        { id: "T.1:text:#text:1", kind: "binding", name: "text #text", file: "T.tsx" },
        { id: "T.tsx#props.rows", kind: "prop", name: "rows", file: "T.tsx" },
      ],
    },
  },
  {
    name: "for4",
    source:
      "import { For } from '@keel/runtime-dom'\nexport default function T(props) { return <ul><For each={props.rows} key=\"id\">{function (a) { return <li>{a}</li> }}</For></ul> }",
    code: 'import * as __k from "@keel/runtime-dom/ops";\nconst __kt0 = __k.template("<li id=\\"T.1\\"> </li>");\nconst __kt1 = __k.template("<ul id=\\"T.0\\"><!----></ul>");\n\nexport default function T(props) { return (() => { const __kr0 = __k.clone(__kt1); const __kn1 = __kr0.childNodes[0]; __k.list(__kn1, () => (props.rows), (__kv2) => __kv2["id"], function (a) { return (() => { const __kr3 = __k.clone(__kt0); const __kn4 = __kr3.childNodes[0]; __k.text(__kn4, () => (a())); return __kr3; })() }); return __kr0; })() }',
    deps: {
      edges: [{ from: "T.tsx#props.rows", to: "T.0:list:each" }],
      nodes: [
        { id: "T.0:list:each", kind: "binding", name: "list each", file: "T.tsx" },
        { id: "T.1:text:#text", kind: "binding", name: "text #text", file: "T.tsx" },
        { id: "T.tsx#props.rows", kind: "prop", name: "rows", file: "T.tsx" },
      ],
    },
  },
];

describe("lowerFile exact output (first half)", () => {
  it.each(FIXTURES)("lowers $name byte for byte", ({ source, code, deps }) => {
    const r = compile([{ path: "T.tsx", source }]);
    expect(r.outputs[0]?.code).toBe(code);
    expect(r.artifacts["deps.json"]).toEqual(deps);
  });
});
