// Fixture for the RFC 0186 `renderRoute` suites (k.guards 6 and 7); not a test file. Seed 1337.
// Module `cg` on one `node` deployable `web`. Pages are TSX through `compilePage`, and both import `identity`:
//   `cg.signin` (`/signin`, unguarded): a `Form` (`cg.signin.go`) to the identity mount's `/in`.
//   `cg.page` (`/p`): guarded by `user !== ''` (redirect `cg.signin`); a `Form` (`cg.signout`) to the mount's `/out`.
// `identify` answers `'u1'` for a request whose `cookie` holds `s=1`, else `''`. The mount's `/in` answers 303 `/p` with `set-cookie: s=1`, `/out` 303 `/signin` with `s=; Max-Age=0`.
import { compile } from "@keel/compiler";
import { evaluate } from "@keel/compiler/testing";
import { type Ctx, createCtx } from "@keel/ctx";
import * as forms from "@keel/forms";
import * as reactive from "@keel/reactive";
import * as router from "@keel/router";
import { Form, guard, identityMount, loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { err, ok, s } from "@keel/schema";
import * as schema from "@keel/schema";
import { createApp, identity, topology } from "@keel/server";
import * as ui from "@keel/ui";
import * as aria from "@keel/ui/aria";

export const SEED = 1337;
export const mount = identityMount("/api/auth");
type Page = (props: router.RouteProps, ctx: Ctx) => Node;
const MODULES: Record<string, unknown> = {
  "@keel/ui": ui,
  "@keel/ui/aria": aria,
  "@keel/router": router,
  "@keel/forms": forms,
  "@keel/schema": schema,
  "@keel/reactive": reactive,
  identity: { __esModule: true, default: mount },
};
function compilePage(name: string, source: string): Page {
  const r = compile([{ path: `${name}.tsx`, source }]);
  if (r.diagnostics.length > 0) throw new Error(`fixture: ${name} does not compile: ${JSON.stringify(r.diagnostics)}`);
  const out = r.outputs[0];
  if (out === undefined) throw new Error("fixture: no compiler output");
  const fn = evaluate(out.code, MODULES);
  if (typeof fn !== "function") throw new Error("fixture: default export is not a component");
  return (props, ctx) => {
    const node: unknown = fn(props, ctx);
    if (!(node instanceof Node)) throw new Error("fixture: component did not return a Node");
    return node;
  };
}
const PAGE = `import { Form } from "@keel/router";
import { form } from "@keel/forms";
import { s } from "@keel/schema";
import { Box, Button } from "@keel/ui";
import mount from "identity";
const Empty = s.object({});
export default function Page() {
  const f = form(Empty);
  return <Box id="cg.root">
    <Form method="POST" action={mount.href("/out")} form={f}>
      <Button id="cg.signout" type="submit">sign out</Button>
    </Form>
  </Box>
}
`;
const SIGN_IN = `import { Form } from "@keel/router";
import { form } from "@keel/forms";
import { s } from "@keel/schema";
import { Box, Button } from "@keel/ui";
import mount from "identity";
const Empty = s.object({});
export default function SignIn() {
  const f = form(Empty);
  return <Box id="cg.signin.root">
    <Form method="POST" action={mount.href("/in")} form={f}>
      <Button id="cg.signin.go" type="submit">sign in</Button>
    </Form>
  </Box>
}
`;
export { Form };
const Empty = s.object({});
const Next = s.object({ next: s.string().optional() });
export const cc = contract("cg", {
  "cg.signin": { path: "/signin", search: Next },
  "cg.page": { path: "/p" },
});
/** What each guard and loader of `cg.page` got as `user`, in order. */
export const rec: { guard: string[]; loader: string[]; identified: (string | null)[] } = {
  guard: [],
  loader: [],
  identified: [],
};
export const reset = (): void => {
  rec.guard.length = 0;
  rec.loader.length = 0;
  rec.identified.length = 0;
};
export const routes = manifest(cc, {
  "cg.signin": { component: compilePage("cg.signin", SIGN_IN) },
  "cg.page": {
    component: compilePage("cg.page", PAGE),
    guard: guard({ redirect: "cg.signin" }, async ({ user }) => {
      rec.guard.push(user);
      return user !== "" ? ok(null) : err({ code: "keel.denied", message: "sign in first", data: null });
    }),
    loader: loader(cc, "cg.page", { output: Empty }, async ({ user }) => {
      rec.loader.push(user);
      return ok({});
    }),
  },
});

export async function boot(ctx: Ctx = createCtx({ mode: "sim", seed: SEED })) {
  const app = await createApp({
    topology: topology({ web: { modules: ["cg"], adapter: "node" } }),
    routes,
    ctx,
    mode: "production",
    identity: identity({
      identify: async ({ request }) => {
        const cookie = request.headers.get("cookie");
        rec.identified.push(cookie);
        return cookie !== null && cookie.split(/;\s*/).includes("s=1") ? "u1" : "";
      },
      handle: {
        path: mount.path,
        fn: (request) => {
          const out = new URL(request.url).pathname.endsWith("/out");
          return new Response(null, {
            status: 303,
            headers: { location: out ? "/signin" : "/p", "set-cookie": out ? "s=; Max-Age=0" : "s=1; HttpOnly" },
          });
        },
      },
    }),
  });
  return { app, ctx };
}
