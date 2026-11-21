// The page module of the k.mount suites (not a test file). Seed for every property: 1337.
// A sign-in page, a navigation page and the routes around them, compiled from TSX so the one module runs under `renderRoute`,
// is served by `createApp` and is resumed by `resumeDocument`, which imports this file again for its own graph.
// `identity` is what a project's `identity.ts` default-exports: the identity mount at `/api/auth`.
import { compile } from "@keel/compiler";
import { evaluate } from "@keel/compiler/testing";
import { createCtx } from "@keel/ctx";
import * as forms from "@keel/forms";
import * as router from "@keel/router";
import { Form, action, identityMount, loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import type { RouteProps } from "@keel/router";
import { ok, s } from "@keel/schema";
import * as schema from "@keel/schema";
import { renderRoute } from "@keel/testing";
import * as ui from "@keel/ui";
import * as aria from "@keel/ui/aria";

export const SEED = 1337;
export const MOUNT_PATH = "/api/auth";
export const mount = identityMount(MOUNT_PATH);

/** Valid and invalid sign-in input. */
export const VALID = { email: "a@b.example", password: "pw" } as const;
export const INVALID = { email: "", password: "pw" } as const;

/** What the loaders and the action of this module graph ran. */
export const seen = { loads: 0, acts: 0 };

const ob = contract("ob", {
  "ob.billing": { path: "/billing" },
});

const other = manifest(ob, {
  "ob.billing": { component: () => document.createElement("main") },
});
const mtContract = contract("mt", {
  "mt.about": { path: "/about" },
  "mt.act": { path: "/act" },
});

const links = manifest(mtContract, {
  "mt.about": { component: () => document.createElement("main") },
  "mt.act": { component: () => document.createElement("main") },
});
/** A page of another deployable's manifest, which this module's router table does not hold. */
export const elsewhere = ob.href("ob.billing");

const modules: Record<string, unknown> = {
  "@keel/ui": ui,
  "@keel/ui/aria": aria,
  "@keel/router": router,
  "@keel/forms": forms,
  "@keel/schema": schema,
  identity: { __esModule: true, default: mount },
  links: {
    about: () => mtContract.href("mt.about"),
    act: () => mtContract.href("mt.act"),
  },
};

const SIGN_IN = `import { Form } from "@keel/router";
import { form } from "@keel/forms";
import { s } from "@keel/schema";
import { Box, Button, Input, Text } from "@keel/ui";
import mount from "identity";
const Credentials = s.object({
  email: s.string({ min: 3 }).pii("contact"),
  password: s.secret(s.string({ min: 2 })),
});
export default function SignIn() {
  const f = form(Credentials);
  return <Box id="mt.signin.root">
    <Form method="POST" action={mount.href("/sign-in/email")} form={f}>
      <Input id="mt.signin.email" field={f.field("email")} label="Email" autocomplete="email" />
      <Input id="mt.signin.password" field={f.field("password")} label="Password" autocomplete="current-password" />
      <Button id="mt.signin.submit" type="submit">Sign in</Button>
    </Form>
    <Text id="mt.signin.pending">{String(f.pending())}</Text>
    <Text id="mt.signin.errors">{Object.keys(f.errors()).join(",")}</Text>
  </Box>
}
`;

const HOME = `import { Form, navigate } from "@keel/router";
import { Box, Button, Link, Text } from "@keel/ui";
import mount from "identity";
import { about, act } from "links";
export default function Home() {
  return <Box id="mt.home.root">
    <Text id="mt.home.title">home</Text>
    <Link id="mt.home.github" to={mount.href("/login/github", { next: "a b" })}>GitHub</Link>
    <Link id="mt.home.about" to={about()}>About</Link>
    <Button id="mt.home.go" onClick={() => navigate(mount.href("/x"))}>Go</Button>
    <Form method="POST" action={act()}>
      <Button id="mt.home.act" type="submit">Act</Button>
    </Form>
  </Box>
}
`;

/** A compiled default export as a route component. */
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

/** The Href of the first-party page the `act` route's action sends to: a MountHref. */
export const ACT_TARGET = mount.href("/x");

const Empty = s.object({});
const mt = contract("mt", {
  "mt.home": { path: "/" },
  "mt.signin": { path: "/sign-in" },
  "mt.upload": { path: "/upload" },
  "mt.about": { path: "/about" },
  "mt.act": { path: "/act" },
});

const read = loader(mt, "mt.home", { output: Empty }, async () => {
  seen.loads += 1;
  return ok({});
});
const act = action(mt, "mt.act", { input: Empty }, async () => {
  seen.acts += 1;
  return ok(ACT_TARGET);
});

/** A page with a file control, built by hand: a file chosen in it must stop the native post (E1583). */
function upload(): Node {
  const input = document.createElement("input");
  input.type = "file";
  input.name = "avatar";
  input.id = "mt.upload.file";
  input.setAttribute("aria-label", "Avatar");
  const text = document.createElement("input");
  text.name = "note";
  text.id = "mt.upload.note";
  text.setAttribute("aria-label", "Note");
  const button = document.createElement("button");
  button.type = "submit";
  button.id = "mt.upload.submit";
  button.textContent = "Upload";
  const f = Form({
    method: "POST",
    action: mount.href("/upload"),
    children: () => [text, input, button],
  });
  f.id = "mt.upload.form";
  return f;
}

/** The compiled page components by route id, as `resume` takes them. */
export const components = {
  "mt.home": page("Home", HOME),
  "mt.signin": page("SignIn", SIGN_IN),
};

export const routes = manifest(mt, {
  "mt.home": { loader: read, component: components["mt.home"] },
  "mt.signin": { component: components["mt.signin"] },
  "mt.upload": { component: upload },
  "mt.about": { component: () => document.createElement("main") },
  "mt.act": { component: () => document.createElement("main"), POST: act },
});

/** Chooses a file in a file control, as a user does. */
export function chooseFile(id: string): void {
  const input = document.getElementById(id);
  if (!(input instanceof HTMLInputElement)) throw new Error(`fixture: no file input ${id}`);
  const transfer = new DataTransfer();
  transfer.items.add(new File(["x"], "a.txt", { type: "text/plain" }));
  input.files = transfer.files;
}

/** A `pageshow` on the window, as the browser fires it on a load (`persisted` false) or a back-forward cache restore (true). */
export function pageshow(persisted: boolean): void {
  const event = new Event("pageshow");
  Object.defineProperty(event, "persisted", { value: persisted });
  window.dispatchEvent(event);
}

/** Lets the microtask queue drain: the page's effects and listeners have run. */
export async function ticks(): Promise<void> {
  for (let i = 0; i < 30; i++) await Promise.resolve();
}

const opened: { dispose(): void }[] = [];

/** `renderRoute` of `id` over this module's routes on a sim ctx; `closeAll` disposes every handle opened so far. */
export async function open(id: string) {
  const handle = await renderRoute(id, { routes, ctx: createCtx({ mode: "sim", seed: SEED }) });
  opened.push(handle);
  return handle;
}

/** Disposes every handle `open` made, so a failing test leaves no page behind for the next one. */
export function closeAll(): void {
  for (const handle of opened.splice(0)) handle.dispose();
}
