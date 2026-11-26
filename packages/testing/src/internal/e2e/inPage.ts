// The page script of `@keel/testing/e2e` (k.e2e-page): bundled once per test process (pageScript.ts) and evaluated in
// each document a tab loads, through Playwright, outside the page's content security policy. It reads the live DOM with
// the harness's own role, name and state rules, so `find`, `findAll` and `a11y` say what the harness says, and runs
// axe-core over the document as the browser renders it. It changes nothing in the page but the `hold` record.
import axe from "axe-core";
import type { A11yNode } from "../../types/A11yNode.ts";
import type { Found } from "../../types/Found.ts";
import { DOCUMENT_RULES } from "../DOCUMENT_RULES.ts";
import type { Violation } from "../Violation.ts";
import { WCAG_TAGS } from "../WCAG_TAGS.ts";
import { controlValue } from "../controlValue.ts";
import { focusOrder } from "../focusOrder.ts";
import { nameOf } from "../nameOf.ts";
import { nodeOf } from "../nodeOf.ts";
import { roleOf } from "../roleOf.ts";
import { stateOf } from "../stateOf.ts";
import { treeOf } from "../treeOf.ts";
import type { HeldCheck, PageApi, PageMatch } from "./PageApi.ts";

const shown = (el: Element): boolean =>
  el.isConnected && el.checkVisibility({ visibilityProperty: true, contentVisibilityAuto: true });

const byId = (id: string): Element | null => {
  const el = document.getElementById(id);
  return el !== null && shown(el) ? el : null;
};

const foundOf = (el: Element): Found => {
  const role = roleOf(el);
  // A host element's node is outside code's, and its value lives in the runtime, which a page does not expose.
  if (el.hasAttribute("data-k-host")) return { id: el.id, role, name: nameOf(el, role), text: "", state: {} };
  const found: Found = {
    id: el.id,
    role,
    name: nameOf(el, role),
    text: (el.textContent ?? "").trim(),
    state: stateOf(el, role),
  };
  const value = controlValue(el);
  return value === undefined ? found : { ...found, value };
};

const squash = (s: string): string => s.replace(/\s+/g, " ").trim();

/** Whether `match` holds of what `id` shows now. */
function holds(id: string, match: PageMatch): boolean {
  const el = byId(id);
  if (match.gone === true) return el === null;
  if (el === null) return false;
  const f = foundOf(el);
  const text = squash(el.textContent ?? "");
  if (match.text !== undefined && text !== match.text) return false;
  if (match.pattern !== undefined && !new RegExp(match.pattern.source, match.pattern.flags).test(text)) return false;
  if (match.name !== undefined && f.name !== match.name) return false;
  if (match.role !== undefined && f.role !== match.role) return false;
  for (const [k, v] of Object.entries(match.state ?? {})) if (Reflect.get(f.state, k) !== v) return false;
  return true;
}

/** Counts DOM changes since the page script ran; each `calm` and `until` reads it. */
let changes = 0;
const listeners = new Set<() => void>();
new MutationObserver(() => {
  changes++;
  for (const l of [...listeners]) l();
}).observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
// A control's value moves without a DOM change; a person's typing is an `input` event.
document.addEventListener(
  "input",
  () => {
    for (const l of [...listeners]) l();
  },
  true,
);

/** Every DOM change `fn` is called, until it returns true or `ms` passes. */
function watch(fn: () => boolean, ms: number): Promise<boolean> {
  if (fn()) return Promise.resolve(true);
  return new Promise((done) => {
    const check = (): void => {
      if (!fn()) return;
      finish(true);
    };
    const timer = setTimeout(() => finish(false), ms);
    function finish(ok: boolean): void {
      listeners.delete(check);
      clearTimeout(timer);
      done(ok);
    }
    listeners.add(check);
  });
}

const where = (el: Element): string => `<${el.tagName.toLowerCase()}${el.id === "" ? "" : ` id="${el.id}"`}>`;

/** The rules `a11y()` runs: the harness's page rules, and those a DOM with layout and colour can run. */
function ruleIds(): string[] {
  const ids: string[] = [];
  const extra = new Set(["color-contrast", "label-content-name-mismatch", "link-in-text-block", "landmark-unique"]);
  for (const r of axe.getRules()) {
    const wcag = r.tags.some((t) => WCAG_TAGS.includes(t)) && !r.tags.includes("experimental");
    if (wcag || extra.has(r.ruleId) || DOCUMENT_RULES.has(r.ruleId)) ids.push(r.ruleId);
  }
  return ids;
}

type Snapshot = {
  readonly elements: readonly (readonly [Element, string])[];
  readonly focus: Element | null;
  readonly values: readonly (readonly [Element, string, number | null, number | null])[];
  readonly scroll: readonly [number, number];
};
let snapshot: Snapshot | undefined;

const api: PageApi = {
  found: (id) => {
    const el = byId(id);
    return el === null ? null : foundOf(el);
  },
  findAll: (prefix) =>
    [...document.querySelectorAll("[id]")].filter((el) => el.id.startsWith(`${prefix}.`) && shown(el)).map(foundOf),
  tree: (id) => {
    if (id === null)
      return { id: "", role: "document", name: document.title, state: {}, children: treeOf(document.documentElement) };
    const el = byId(id);
    return el === null ? null : nodeOf(el);
  },
  focusOrder: () => focusOrder(document.documentElement),
  axe: async () => {
    const r = await axe.run(document, { runOnly: { type: "rule", values: ruleIds() }, resultTypes: ["violations"] });
    const out: Violation[] = [];
    for (const v of r.violations)
      for (const n of v.nodes) {
        const target = n.target[0];
        const el = typeof target === "string" ? document.querySelector(target) : null;
        out.push({
          rule: v.id,
          element: el?.id ?? "",
          at: el === null ? n.html.slice(0, 60) : where(el),
          help: v.help,
        });
      }
    return out;
  },
  layout: (id) => {
    const el = id === null ? document.documentElement : byId(id);
    if (el === null) return null;
    const box = el.getBoundingClientRect();
    return {
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    };
  },
  style: (id, names) => {
    const el = byId(id);
    if (el === null) return null;
    const css = getComputedStyle(el);
    return Object.fromEntries(names.map((n) => [n, css.getPropertyValue(n)]));
  },
  until: (id, match, ms) => watch(() => holds(id, match), ms),
  seen: (id, match) => {
    const el = byId(id);
    if (match.gone === true) return el === null ? "gone" : "still shown";
    if (el === null) return "not shown";
    const f = foundOf(el);
    const text = squash(el.textContent ?? "");
    if (match.text !== undefined || match.pattern !== undefined)
      return `text was ${JSON.stringify(text)}, not ${match.text === undefined ? `/${match.pattern?.source ?? ""}/` : JSON.stringify(match.text)}`;
    if (match.name !== undefined) return `name was ${JSON.stringify(f.name)}, not ${JSON.stringify(match.name)}`;
    if (match.role !== undefined) return `role was ${f.role}, not ${match.role}`;
    return `state was ${JSON.stringify(f.state)}, not ${JSON.stringify(match.state ?? {})}`;
  },
  calm: (ms) =>
    new Promise((done) => {
      const end = performance.now() + ms;
      let seen = changes;
      const frame = (): void => {
        if (changes === seen || performance.now() > end) {
          done(changes === seen);
          return;
        }
        seen = changes;
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    }),
  hold: () => {
    const controls = [...document.querySelectorAll("input, textarea, select")];
    snapshot = {
      elements: [...document.querySelectorAll("[id]")]
        .filter(shown)
        .map((el): readonly [Element, string] => [el, el.id]),
      focus: document.activeElement,
      values: controls.map((el): readonly [Element, string, number | null, number | null] => {
        const value = controlValue(el) ?? "";
        const caret = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ? el : undefined;
        let start: number | null = null;
        let end: number | null = null;
        try {
          start = caret?.selectionStart ?? null;
          end = caret?.selectionEnd ?? null;
        } catch {
          // an input type with no selection
        }
        return [el, value, start, end];
      }),
      scroll: [scrollX, scrollY],
    };
  },
  held: (): HeldCheck => {
    const s = snapshot;
    if (s === undefined) return { ok: false, why: "the page was not held" };
    // A served element the claim removed, hid behind the client's own nodes, or gave another id, was replaced.
    const replaced = s.elements.find(([el, id]) => !shown(el) || el.id !== id);
    if (replaced !== undefined)
      return {
        ok: false,
        why: `the claim replaced <${replaced[0].tagName.toLowerCase()} id="${replaced[1]}"> the server sent`,
      };
    if (document.activeElement !== s.focus)
      return { ok: false, why: `the claim moved focus off ${s.focus === null ? "the page" : where(s.focus)}` };
    for (const [el, value, start, end] of s.values) {
      if ((controlValue(el) ?? "") !== value) return { ok: false, why: `the claim changed the value of ${where(el)}` };
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        let now: readonly [number | null, number | null] = [null, null];
        try {
          now = [el.selectionStart, el.selectionEnd];
        } catch {
          // an input type with no selection
        }
        if (now[0] !== start || now[1] !== end) return { ok: false, why: `the claim moved the caret of ${where(el)}` };
      }
    }
    if (scrollX !== s.scroll[0] || scrollY !== s.scroll[1])
      return { ok: false, why: "the claim moved the scroll position" };
    return { ok: true };
  },
};

globalThis.__keelE2e = api;
