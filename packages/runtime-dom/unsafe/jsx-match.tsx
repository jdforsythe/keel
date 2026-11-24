// Type-only fixture (in unsafe/ because it needs expected-error directives): checked by tsc and by test/match.test.ts.
import { Case, Match } from "../src/index.ts";
import { unsafe } from "./unsafe.ts";

type State =
  | { readonly state: "loading" }
  | { readonly state: "error"; readonly error: string }
  | { readonly state: "ready"; readonly value: number[] };
declare const s: State;

/** Narrowed: `v` is the variant the tag selects. */
export const ok: Node = (
  <Match on={s}>
    <Case<State> tag="loading">{() => document.createElement("p")}</Case>
    <Case<State> tag="error">{(v) => document.createTextNode(v.error)}</Case>
    <Case<State> tag="ready">{(v) => document.createTextNode(String(v.value.length))}</Case>
  </Match>
);

/** `Case` is a JSX element: usable wherever a Node is. */
export const node: Node = <Case tag="x">{() => document.createElement("i")}</Case>;

export const wrongVariant: Node = unsafe(
  "type-level negative: `v.value` on the loading variant is a type error",
  () => (
    <Match on={s}>
      {/* @ts-expect-error `value` does not exist on the loading variant */}
      <Case<State> tag="loading">{(v) => document.createTextNode(String(v.value))}</Case>
    </Match>
  ),
);

export const unknownTag: Node = unsafe("type-level negative: a tag that is no variant of State is a type error", () => (
  <Match on={s}>
    {/* @ts-expect-error "done" is not a variant of State */}
    <Case<State> tag="done">{() => document.createElement("p")}</Case>
  </Match>
));

export const notACase: Node = unsafe("type-level negative: text as a child of Match is a type error", () => (
  // @ts-expect-error children of Match are Case elements, not text
  <Match on={s}>{"text"}</Match>
));
