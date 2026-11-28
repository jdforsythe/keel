// Negative type test (k.unsafe): type-checked by the package's `check`, never run, imported by no file. Its run-time
// half is `render-callback-props.test.ts`, which renders the same component with its callback.
import { createCtx } from "@keel/ctx";
import { s } from "@keel/schema";
import { render } from "@keel/testing";

const Props = s.object({ label: s.string() });
const Pick = Object.assign(
  (props: { label: string; onPick: (l: string) => void }): Node => document.createTextNode(props.label),
  {
    Props,
  },
);
const ctx = createCtx({ mode: "sim", seed: 1 });

// @ts-expect-error a callback prop the schema cannot hold must be given
render(Pick, { props: { label: "a" }, ctx });

// @ts-expect-error a callback prop is given with its own type
render(Pick, { props: { label: "a", onPick: 1 }, ctx });

render(Pick, { props: { label: "a", onPick: (l: string) => void l }, ctx });
