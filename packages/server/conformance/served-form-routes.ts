// The routes module of the served-form suite (not a test file): one page of a bound `Form` over a schema with a number and a string.
// A test imports it for the server side; `resumeDocument` imports it again for the client side.
import { compile } from "@keel/compiler";
import { evaluate } from "@keel/compiler/testing";
import * as forms from "@keel/forms";
import * as router from "@keel/router";
import type { RouteProps } from "@keel/router";
import * as ui from "@keel/ui";
import * as aria from "@keel/ui/aria";
import { action, manifest, routeTable } from "@keel/router";
import { contract } from "@keel/router/contract";
import { err, ok, s } from "@keel/schema";
import * as schema from "@keel/schema";

const modules: Record<string, unknown> = {
  "@keel/ui": ui,
  "@keel/ui/aria": aria,
  "@keel/router": router,
  "@keel/forms": forms,
  "@keel/schema": schema,
};

function page(name: string, source: string): (props: RouteProps) => Node {
  const result = compile([{ path: `${name}.tsx`, source }]);
  if (result.diagnostics.length > 0)
    throw new Error(`fixture: ${name} does not compile: ${JSON.stringify(result.diagnostics)}`);
  const out = result.outputs[0];
  if (out === undefined) throw new Error("fixture: no compiler output");
  const fn = evaluate(out.code, modules);
  if (typeof fn !== "function") throw new Error("fixture: default export is not a component");
  return (props) => {
    const node: unknown = fn(props);
    if (!(node instanceof Node)) throw new Error("fixture: component did not return a Node");
    return node;
  };
}

const rf = contract("rf", { "rf.page": { path: "/rf" } });

export const Input = s.object({ qty: s.number(), note: s.string() });

/** The text an action's `keel.fields` answer puts on `note`. */
export const REFUSED = "That note is not allowed";

const save = action(rf, "rf.page", { input: Input }, (input) =>
  Promise.resolve(
    input.note === "bad" ? err({ code: "keel.fields", message: REFUSED, data: { note: REFUSED } }) : ok(null),
  ),
);

const PAGE = `import { form } from "@keel/forms";
import { Form } from "@keel/router";
import { s } from "@keel/schema";
import { Box, Input } from "@keel/ui";
const Values = s.object({ qty: s.number(), note: s.string() });
export default function Page() {
  const f = form(Values, { id: "rf" });
  return <Box as="main" id="rf.root">
    <Form method="POST" action="/rf" form={f}>
      <Input field={f.field("qty")} label="Quantity" />
      <Input field={f.field("note")} label="Note" />
    </Form>
  </Box>
}
`;

export const routes = routeTable(
  manifest(rf, {
    "rf.page": { component: page("rf.page", PAGE), POST: save },
  }),
);

export default routes;
