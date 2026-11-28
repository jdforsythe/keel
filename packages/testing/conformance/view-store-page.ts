// The page module of the k.store view-store suites (not a test file). Seed for every property: 1337.
// A page whose component creates its store in the body from the loader's data, `store(S, { items: props.data.items }, { id: 'v.list' })`,
// with one transaction `v.add` that a button's handler `tx`es. Compiled from TSX, so the one module runs under `renderRoute`, is served by
// `createApp` and is resumed by `resumeDocument`. ASSUMPTION: the page's loader answers `{ items }` from `control.items`.
import { compile } from "@keel/compiler";
import { evaluate } from "@keel/compiler/testing";
import { loader, manifest } from "@keel/router";
import type { RouteProps } from "@keel/router";
import * as router from "@keel/router";
import { contract } from "@keel/router/contract";
import * as schema from "@keel/schema";
import { ok, s } from "@keel/schema";
import * as store from "@keel/store";
import * as ui from "@keel/ui";

export const SEED = 1337;
export const control: { items: readonly string[] } = { items: [] };

const SOURCE = `import { store, transaction, tx } from "@keel/store";
import { s } from "@keel/schema";
import { Box, Button, Text } from "@keel/ui";
const List = s.object({ items: s.array(s.string()) });
const Add = s.object({ text: s.string() });
export default function ViewList(props) {
  const list = store(List, { items: props.data.items }, { id: "v.list" });
  const add = transaction(list, "v.add", Add, (st, p) => ({ items: [...st.items, p.text] }));
  return <Box id="v.root">
    <Text id="v.items">{list.get("items").join(",")}</Text>
    <Button id="v.add" onClick={() => tx(add, { text: "new" })}>Add</Button>
  </Box>
}
`;

function page(): (props: RouteProps) => Node {
  const result = compile([{ path: "ViewList.tsx", source: SOURCE }]);
  if (result.diagnostics.length > 0)
    throw new Error(`fixture: does not compile: ${JSON.stringify(result.diagnostics)}`);
  const out = result.outputs[0];
  if (out === undefined) throw new Error("fixture: no compiler output");
  const fn = evaluate(out.code, {
    "@keel/ui": ui,
    "@keel/router": router,
    "@keel/schema": schema,
    "@keel/store": store,
  });
  if (typeof fn !== "function") throw new Error("fixture: default export is not a component");
  return (props) => {
    const node: unknown = fn(props);
    if (!(node instanceof Node)) throw new Error("fixture: component did not return a Node");
    return node;
  };
}

const v = contract("v", { "v.page": { path: "/v" } });
const List = s.object({ items: s.array(s.string()) });
const read = loader(v, "v.page", { output: List }, async () => ok({ items: [...control.items] }));
export const routes = manifest(v, { "v.page": { loader: read, component: page() } });
