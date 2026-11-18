// The pure parts of tooling/smoke/shell.mjs: a recorded session's inputs as shell actions, a stored board with its
// minted ids normalized, and a compact diff of two boards.

/** WebDriver key codes for the `keydown` keys a session can hold. */
const KEYS = {
  Enter: "",
  Escape: "",
  Tab: "",
  Backspace: "",
  ArrowUp: "",
  ArrowDown: "",
  ArrowLeft: "",
  ArrowRight: "",
  Home: "",
  End: "",
  " ": " ",
};

const isInput = (e) => e.kind === "fire" || e.kind === "nav" || e.kind === "net";

/**
 * The inputs of `session` (std.sessions: `fire`, `nav` and `net` events) as the actions a person takes in the shell,
 * in recorded order: `{ kind: 'nav', href }` follows a link to `href`; `{ kind: 'click', id }` clicks element `id`
 * (a `click`, and a `change`, which a click on a checkbox makes); `{ kind: 'type', id, value }` clears element `id`
 * and types `value`; `{ kind: 'keys', id, keys }` presses a key in it. A `submit` or `nav` recorded at the same `at`
 * as the `fire` before it is that input's effect (the submit a click on a submit button dispatches, the route an
 * action ends on) and is left out, since the real input makes it again. An input no person can make through the
 * page (`net`, `focus`, `blur`, a `submit` of its own, an unknown key) is `{ kind: 'unsupported', event }`.
 */
export function actionsOf(session) {
  const actions = [];
  let before;
  for (const e of Array.isArray(session?.events) ? session.events : []) {
    if (!isInput(e)) continue;
    const effect = before?.kind === "fire" && e.at === before.at && (e.kind === "nav" || e.event?.type === "submit");
    before = e;
    if (!effect) actions.push(actionOf(e));
  }
  return actions;
}

function actionOf(e) {
  if (e.kind === "nav") return { kind: "nav", href: String(e.href) };
  if (e.kind !== "fire") return { kind: "unsupported", event: e };
  const type = e.event?.type;
  if (type === "click" || type === "change") return { kind: "click", id: String(e.id) };
  if (type === "input") return { kind: "type", id: String(e.id), value: String(e.event.value) };
  if (type === "keydown" && Object.hasOwn(KEYS, e.event.key) && !e.event.shift && !e.event.alt && !e.event.mod)
    return { kind: "keys", id: String(e.id), keys: KEYS[e.event.key] };
  return { kind: "unsupported", event: e };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * `board` (a stored `api.board` snapshot: `state`, `log`, `initial`, `head`, `keys`) with what differs between two
 * runs of one session left out or renamed: each log entry's `at` (the clock at the write) is dropped, and every UUID
 * (a minted todo id, a write key) and every `caller` becomes `id#<n>` or `caller#<n>` by order of first appearance.
 * Object keys come out sorted, so two equal boards serialize equally.
 */
export function normalized(board) {
  const names = new Map();
  const rename = (kind, v) => {
    const k = `${kind}:${v}`;
    if (!names.has(k)) names.set(k, `${kind}#${[...names.keys()].filter((n) => n.startsWith(`${kind}:`)).length + 1}`);
    return names.get(k);
  };
  const walk = (v, key, inLog) => {
    if (typeof v === "string") return key === "caller" ? rename("caller", v) : UUID.test(v) ? rename("id", v) : v;
    if (Array.isArray(v)) return v.map((x) => walk(x, undefined, key === "log"));
    if (typeof v !== "object" || v === null) return v;
    const out = {};
    for (const k of Object.keys(v)) {
      if (inLog && k === "at") continue;
      out[k] = walk(v[k], k, false);
    }
    return out;
  };
  // Names are given in document order: state, then log, then the rest.
  const ordered = typeof board === "object" && board !== null && !Array.isArray(board) ? board : { value: board };
  const keys = Object.keys(ordered).sort((a, b) => rank(a) - rank(b) || (a < b ? -1 : a > b ? 1 : 0));
  const out = {};
  for (const k of keys) out[k] = walk(ordered[k], k, false);
  return sortKeys(out);
}

const rank = (k) => (k === "state" ? 0 : k === "log" ? 1 : 2);

function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (typeof v !== "object" || v === null) return v;
  const out = {};
  for (const k of Object.keys(v).sort()) out[k] = sortKeys(v[k]);
  return out;
}

/**
 * The differences between two normalized boards as `path: shell <a> sim <b>` lines (paths dotted, array indexes as
 * numbers), at most `cap` of them, then `... +<n> more` when more differ. Empty when the boards are equal.
 */
export function boardDiff(shell, sim, cap = 10) {
  const lines = [];
  const show = (v) => (v === undefined ? "(none)" : JSON.stringify(v));
  const walk = (a, b, path) => {
    const both = (x) => typeof x === "object" && x !== null;
    if (both(a) && both(b) && Array.isArray(a) === Array.isArray(b)) {
      const keys = Array.isArray(a)
        ? Array.from({ length: Math.max(a.length, b.length) }, (_, i) => String(i))
        : [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
      for (const k of keys) walk(a[k], b[k], path === "" ? k : `${path}.${k}`);
      return;
    }
    if (JSON.stringify(a) !== JSON.stringify(b))
      lines.push(`${path === "" ? "(board)" : path}: shell ${show(a)} sim ${show(b)}`);
  };
  walk(shell, sim, "");
  return lines.length > cap ? [...lines.slice(0, cap), `... +${lines.length - cap} more`] : lines;
}
