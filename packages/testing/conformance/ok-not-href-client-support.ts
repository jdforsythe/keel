// Shared fixture of the rfc:0157 client conformance files (not a test file). Seed 1337.
// Page `cl.form` holds a `Form` to its own POST action, a submit button `cl.go` and an error slot `cl.err`; the action answers
// `ok(next)`, `next` a raw string typed as an `Href` through a type predicate. `cl.home` is the page a valid link goes to.
import { compile } from "@keel/compiler";
import { evaluate } from "@keel/compiler/testing";
import { createCtx } from "@keel/ctx";
import * as router from "@keel/router";
import { type Href, type RouteProps, action, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import * as schema from "@keel/schema";
import { renderRoute } from "@keel/testing";
import * as ui from "@keel/ui";
import * as aria from "@keel/ui/aria";

export const SEED = 1337;
export const BAD = [
  "//evil.example/x",
  "/\\evil.example",
  "https://evil.example/",
  "javascript:alert(1)",
  "/a\u0085b",
  "/a\u0000b",
  "/a\nb",
  "/a\u007fb",
] as const;

const c = contract("cl", {
  "cl.home": { path: "/" },
  "cl.form": { path: "/form" },
});
const isHref = (v: string): v is Href => true;
export const raw = (v: string): Href => {
  if (!isHref(v)) throw new Error("unreachable");
  return v;
};
export let next: string | null = null;
export const setNext = (v: string | null): void => {
  next = v;
};
let acts = 0;
export const acted = (): number => acts;
const act = action(c, "cl.form", { input: s.object({}) }, async () => {
  acts += 1;
  return ok(next === null ? null : raw(next));
});
const SOURCE = `import { Form } from "@keel/router";
import { Box, Button, Text } from "@keel/ui";
import { here } from "links";
export default function FormPage() {
  return <Box id="cl.form.root">
    <Form method="POST" action={here()} error={(e) => <Text id="cl.err">{e.code}</Text>}>
      <Button id="cl.go" type="submit">Go</Button>
    </Form>
  </Box>
}
`;
const HOME_SOURCE = `import { Box, Text } from "@keel/ui";
export default function Home() {
  return <Box id="cl.home.root"><Text id="cl.home.title">home</Text></Box>
}
`;
const modules: Record<string, unknown> = {
  "@keel/ui": ui,
  "@keel/ui/aria": aria,
  "@keel/router": router,
  "@keel/schema": schema,
  links: { here: () => c.href("cl.form") },
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
const Home = page("home", HOME_SOURCE);
const FormPage = page("form", SOURCE);
export const routes = manifest(c, {
  "cl.home": { component: Home },
  "cl.form": { component: FormPage, POST: act },
});
export const homeHref = c.href("cl.home");
export const formHref = c.href("cl.form");

export async function open(to: string | null) {
  next = to;
  acts = 0;
  return renderRoute("cl.form", { routes, ctx: createCtx({ mode: "sim", seed: SEED }) });
}
