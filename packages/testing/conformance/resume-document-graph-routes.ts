// The routes module of the fresh-graph case (not a test file): a module store `gd.count` and one island page that reads and writes it.
// The test imports it for its own copy; `resumeDocument` imports it again with `routes: () => import(...)`, which evaluates it anew.
import { compile } from "@keel/compiler";
import { evaluate } from "@keel/compiler/testing";
import { scope } from "@keel/reactive";
import { manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { s } from "@keel/schema";
import { store, transaction, tx } from "@keel/store";

const Count = s.object({ n: s.int() });

function make() {
  // `store()` runs inside a reactive scope (E1203); this one is not isolated, so the store sits in the module registry.
  const count = store(Count, { n: 0 }, { id: "gd.count" });
  const inc = transaction(count, "gd.inc", s.object({}), (state) => ({ n: state.n + 1 }));
  return { count, inc };
}

let made: ReturnType<typeof make> | undefined;
scope(
  () => {
    made = make();
  },
  { detached: true },
);
if (made === undefined) throw new Error("fixture: store scope did not run");
export const { count, inc } = made;

const SOURCE = `export default function Counter(props) {
  return <div id="gd.root"><button id="gd.go" onClick={() => props.bump()}>go</button><p id="gd.n">{props.n}</p></div>
}
`;

function build(): (props: object) => Node {
  const out = compile([{ path: "Counter.tsx", source: SOURCE }]).outputs[0];
  if (out === undefined) throw new Error("fixture: no compiler output");
  const fn = evaluate(out.code);
  if (typeof fn !== "function") throw new Error("fixture: default export is not a component");
  return (props) => {
    const node: unknown = fn(props);
    if (!(node instanceof Node)) throw new Error("fixture: component did not return a Node");
    return node;
  };
}

const inner = build();

/** The island: shows the count it reads at build and bumps the store of its own module graph. */
export function Island(props: object): Node {
  return inner(Object.assign({}, props, { n: String(count.get("n")), bump: () => void tx(inc, {}) }));
}

const gdContract = contract("gd", {
  "gd.page": { path: "/gd" },
});

export const routes = manifest(gdContract, {
  "gd.page": { component: Island },
});

export default routes;
