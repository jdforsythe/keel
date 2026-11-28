// Shared fixtures for the k.test-run disposal cases (not a test file). Property seed: 1337.
// A page with a `<main>` landmark, a view component with one element, and a seedable store whose transaction is
// declared inside a module-level scope (as fixtures.ts does), so a write after a hand `dispose()` reaches the store.
import { createCtx } from "@keel/ctx";
import { scope } from "@keel/reactive";
import { manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { clone, template } from "@keel/runtime-dom/ops";
import { s } from "@keel/schema";
import { store, transaction } from "@keel/store";

export const SEED = 1337;
export const simCtx = () => createCtx({ mode: "sim", seed: SEED });

export const VIEW_ID = "tr.view";

/** A component with one element `tr.view`. */
export const View = Object.assign((): Node => clone(template(`<p id="${VIEW_ID}" data-k="${VIEW_ID}">view</p>`)), {
  Props: s.object({}),
});

const Counter = s.object({ n: s.int() });
const make = () => {
  const box = store(Counter, { n: 0 }, { id: "tr.box" });
  const bump = transaction(box, "tr.bump", s.object({}), (state) => ({ n: state.n + 1 }));
  box.uses([bump]);
  return { box, bump };
};
let made: ReturnType<typeof make> | undefined;
scope(
  () => {
    made = make();
  },
  { detached: true },
);
if (made === undefined) throw new Error("fixture: store scope did not run");
export const { box, bump } = made;

const trContract = contract("tr", { "tr.page": { path: "/tr" } });
/** A route table of one page whose component is a `<main>` landmark. */
export const routes = manifest(trContract, {
  "tr.page": {
    component: () => {
      const main = document.createElement("main");
      main.id = "tr.main";
      const h = document.createElement("h1");
      h.textContent = "Page";
      main.append(h);
      return main;
    },
  },
});
