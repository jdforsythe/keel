// The routes module of the labelled-summary suites (not a test file): one page, a bound `Form` over an `amount` string with an `Input`
// whose label is a parameter and whose `styles` name a `label` and an `error` part. Fixtures are TSX through the compiler, as an author writes them.
import { compile } from "@keel/compiler";
import { evaluate } from "@keel/compiler/testing";
import { createCtx } from "@keel/ctx";
import * as forms from "@keel/forms";
import * as router from "@keel/router";
import type { RouteProps } from "@keel/router";
import { action, manifest, routeTable } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import * as schema from "@keel/schema";
import { createApp, topology } from "@keel/server";
import * as ui from "@keel/ui";
import * as aria from "@keel/ui/aria";

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

/** The id of the `Input` the page binds to `amount`. */
export const FIELD_ID = "lb.amount";

const Values = s.object({ amount: s.string({ min: 1 }) });

const source = (label: string): string => `import { form } from "@keel/forms";
import { Form } from "@keel/router";
import { s } from "@keel/schema";
import { Box, Input } from "@keel/ui";
const Values = s.object({ amount: s.string({ min: 1 }) });
export default function Page() {
  const f = form(Values, { id: "lb" });
  return <Box as="main" id="lb.root">
    <Form method="POST" action="/lb" form={f}>
      <Input id="${FIELD_ID}" field={f.field("amount")} label=${JSON.stringify(label)} styles={{ label: { fg: 'accent' }, error: { fg: 'error' } }} />
    </Form>
  </Box>
}
`;

/** An app serving the page, its input labelled `label`; a post of `amount` empty fails the schema. */
export async function appFor(label: string): Promise<{ fetch: (req: Request) => Promise<Response> }> {
  const lb = contract("lb", { "lb.page": { path: "/lb" } });
  const save = action(lb, "lb.page", { input: Values }, () => Promise.resolve(ok(null)));
  const routes = routeTable(manifest(lb, { "lb.page": { component: page("lb.page", source(label)), POST: save } }));
  return createApp({
    topology: topology({ web: { modules: ["lb"], adapter: "node" } }),
    routes,
    ctx: createCtx({ mode: "sim", seed: 1337 }),
    mode: "production",
  });
}

/** A no-script post of an empty `amount`, answered as a document. */
export const postEmpty = (): Request =>
  new Request("http://localhost/lb", {
    method: "POST",
    headers: { accept: "text/html", "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ amount: "" }).toString(),
  });
