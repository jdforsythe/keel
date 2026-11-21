// The page module of the k.opening act suite (not a test file). Seed for every property: 1337.
// The mount is declared with `links: ['/verify']` (k.links Conformance fixture); `ac.about` is a page at `/about`.
// Routes: `ac.home` (`/`: a Link to `mount.href('/login/github')`, a Link to `/auto`, a text field, a valid Form whose action answers
// `ok(mount.href('/login/github'))`), `ac.auto` (`/auto`: its render calls `navigate(mount.href('/login/github'))`).
import { compile } from "@keel/compiler";
import { evaluate } from "@keel/compiler/testing";
import * as forms from "@keel/forms";
import * as router from "@keel/router";
import { action, identityMount, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import type { RouteProps } from "@keel/router";
import { ok, s } from "@keel/schema";
import * as schema from "@keel/schema";
import * as ui from "@keel/ui";
import * as aria from "@keel/ui/aria";

export const mount = identityMount("/api/auth", { links: ["/verify"] });
/** The opening's start request: a GET of the mount's `/login/github`. */
export const START = "/api/auth/login/github";

const acContract = contract("ac", {
  "ac.auto": { path: "/auto" },
  "ac.act": { path: "/act" },
});

const links = manifest(acContract, {
  "ac.auto": { component: () => document.createElement("main") },
  "ac.act": { component: () => document.createElement("main") },
});

const modules: Record<string, unknown> = {
  "@keel/ui": ui,
  "@keel/ui/aria": aria,
  "@keel/router": router,
  "@keel/forms": forms,
  "@keel/schema": schema,
  identity: { __esModule: true, default: mount },
  links: { auto: () => acContract.href("ac.auto"), act: () => acContract.href("ac.act") },
};

const HOME = `import { form } from "@keel/forms";
import { s } from "@keel/schema";
import { Box, Input, Link } from "@keel/ui";
import mount from "identity";
import { auto } from "links";
const Note = s.object({ note: s.string({ min: 0 }) });
export default function Home() {
  const f = form(Note);
  return <Box id="ac.home.root">
    <Link id="ac.home.github" to={mount.href("/login/github")}>GitHub</Link>
    <Link id="ac.home.auto" to={auto()}>Auto</Link>
    <Input id="ac.home.field" field={f.field("note")} label="Note" />
  </Box>
}
`;

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

const Empty = s.object({});
const ac = contract("ac", {
  "ac.home": { path: "/" },
  "ac.auto": { path: "/auto" },
  "ac.act": { path: "/act" },
  "ac.about": { path: "/about" },
});

const act = action(ac, "ac.act", { input: Empty }, async () => ok(mount.href("/login/github")));

const home = page("Home", HOME);

/** The home page with a hand-built valid Form (id `ac.home.form`) whose action answers `ok(mount.href('/login/github'))`. */
function homePage(props: RouteProps): Node {
  const root = home(props);
  const button = document.createElement("button");
  button.type = "submit";
  button.id = "ac.home.submit";
  button.textContent = "Act";
  const f = router.Form({ method: "POST", action: acContract.href("ac.act"), children: () => [button] });
  f.id = "ac.home.form";
  root.appendChild(f);
  return root;
}

/** A page whose render calls `navigate(mount.href('/login/github'))`; the call runs in a microtask because a render writing a signal directly is E1201. */
function autoPage(): Node {
  queueMicrotask(() => router.navigate(mount.href("/login/github")));
  return document.createElement("main");
}

export const routes = manifest(ac, {
  "ac.home": { component: homePage },
  "ac.auto": { component: autoPage },
  "ac.act": { component: () => document.createElement("main"), POST: act },
  "ac.about": { component: () => document.createElement("main") },
});

export const HOME_HREF = ac.href("ac.home");
export const AUTO_HREF = ac.href("ac.auto");
