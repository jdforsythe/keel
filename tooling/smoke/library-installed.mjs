// A library installed from its tarball, as a team that did not write it installs it (k.library In an app, k.looks,
// k.library-pack Pack). Usage: `node tooling/smoke/library-installed.mjs [--kit <dir>] [--keep]`. Without `--kit` it
// packs one from the built packages (`evals/public/pack.ts`; run `pnpm build` first). Everything runs in a folder
// under the temp folder, outside the repository, with every `@keel/*` range pointed at the kit's tarballs: the kit's
// `keel scaffold library @acme/kit` gains a `./tokens` entry (`kitTokens`, a look its component wears) and a `./tools`
// entry (a rule), each with `keel` first, naming a `.ts` file; `keel pack` and `pnpm pack` make its tarball. The kit's
// `keel scaffold project shop` installs that tarball (so the library's files lie under `node_modules`, not linked),
// lists it in `deps`, composes its tokens in `tokens.ts` and renders its component on `/`; then `keel check`,
// `keel test` (a test that renders the component), `keel build` (the look's color in the built CSS) and `keel dev`
// (the page, the page module importing the library's source, and the dev styles holding the look's color), each
// bounded. The dev server runs in its own process group, killed on every path; the temp folders go unless `--keep`.
import { execFile, spawn } from "node:child_process";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { packKit } from "../../evals/public/pack.ts";
import { overridesYaml } from "../../evals/public/project.ts";
import { fixedTime } from "../test-time.ts";
import { freePort, recorder, root, wait } from "./built.mjs";

const args = process.argv.slice(2);
const kitArg = args.includes("--kit") ? args[args.indexOf("--kit") + 1] : undefined;
const keep = args.includes("--keep");
// Each bound is fixed time (docs/TESTING.md): an install, a pack, a check, a test run or a build.
const STEP = fixedTime(600_000);
const READY = fixedTime(60_000);
const { step, finish, caught } = recorder();
let dev;

/** SIGKILL the dev server's process group (the child and whatever it started). */
function killGroup() {
  if (dev === undefined || dev.child.pid === undefined) return;
  try {
    process.kill(-dev.child.pid, "SIGKILL");
  } catch {
    // The group is already gone.
  }
}
process.on("exit", killGroup);
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    killGroup();
    process.exit(130);
  });
}

/** Runs `cmd args` in `cwd`, bounded; resolves `{ ok, out }`. */
function sh(cmd, argv, cwd) {
  return new Promise((done) => {
    execFile(
      cmd,
      argv,
      { cwd, env: { ...process.env, KEEL_AGENT: "1" }, timeout: STEP, maxBuffer: 64 * 1024 * 1024 },
      (err, stdout, stderr) => done({ ok: err === null, out: `${stdout}${stderr}` }),
    );
  });
}

/** The last line of a command's output: its `ok` or `fail` summary. */
const last = (out) => out.trim().split("\n").at(-1) ?? "";
/** A command as a step; resolves whether it passed. */
async function run(label, cmd, argv, cwd) {
  const r = await sh(cmd, argv, cwd);
  step(label, r.ok, r.ok ? last(r.out) : r.out.trim().split("\n").slice(-6).join(" | ").slice(0, 600));
  return r.ok;
}

const json = async (file, edit) => {
  const value = JSON.parse(await readFile(file, "utf8"));
  edit(value);
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
};

const entry = (file) => ({
  keel: `./src/${file}.ts`,
  types: `./dist/src/${file}.d.ts`,
  default: `./dist/src/${file}.js`,
});

const LIBRARY = {
  "src/kitTokens.ts": `import { defineTokens } from "@keel/ui/tokens";

export const kitTokens = defineTokens({
  color: {
    "kit.accent": { light: "#0B5CAD", dark: "#8AB8F0" },
    "kit.onAccent": { light: "#FFFFFF", dark: "#0B1A2B" },
  },
  look: { "kit.badge": { bg: "kit.accent", fg: "kit.onAccent" } },
});
`,
  "src/Example.tsx": `import { s } from "@keel/schema";
import { Text } from "@keel/ui";

export const Props = s.object({ id: s.string() });

/** Renders \`<id>.text\` in the kit's badge look. */
export default function Example(props: { id: string }) {
  return (
    <Text id={\`\${props.id}.text\`} look="kit.badge">
      Example
    </Text>
  );
}
`,
  "src/tools.ts": `import { defineRule } from "@keel/check";

defineRule({
  code: "E2901",
  message: "the kit's marker call is not to be made",
  see: "k.library",
  explain: "A rule the kit's ./tools export registers.",
  check: ({ file }) => (file.source.includes(["kitMarker", "("].join("")) ? [{ path: file.path, line: 1, col: 1 }] : []),
});
`,
  "tokens.ts": `import { defineTokens } from "@keel/ui/tokens";
import { brandTokens } from "@keel/ui/brand";
import { kitTokens } from "./src/kitTokens.ts";

export const tokens = defineTokens({
  ...brandTokens,
  color: { ...brandTokens.color, ...kitTokens.color },
  look: { ...brandTokens.look, ...kitTokens.look },
});
`,
};

const APP = {
  "modules/app/module.ts": `import { module } from "@keel/compiler";

export default module({ id: "app", deps: ["@acme/kit"], capabilities: [], public: { exports: [] } });
`,
  "modules/app/app.contract.ts": `import { contract } from "@keel/router/contract";

export const app = contract("app", { "app.home": { path: "/" } });
`,
  "modules/app/HomePage.tsx": `import { Example } from "@acme/kit";
import { s } from "@keel/schema";
import { Box, Heading } from "@keel/ui";

export const Props = s.object({});

/** The home page: the scaffold's heading, which its own route test reads, and the kit's example. */
export default function HomePage() {
  return (
    <Box id="app.home" as="main">
      <Heading id="app.home.title" level={1}>
        shop
      </Heading>
      <Example id="app.example" />
    </Box>
  );
}
`,
  "modules/app/routes.ts": `import { manifest } from "@keel/router";
import HomePage from "./HomePage.tsx";
import { app } from "./app.contract.ts";

export const routes = manifest(app, { "app.home": { component: HomePage } });
`,
  "tokens.ts": `import { kitTokens } from "@acme/kit/tokens";
import { defineTokens } from "@keel/ui/tokens";
import { brandTokens } from "@keel/ui/brand";

export const tokens = defineTokens({
  ...brandTokens,
  color: { ...brandTokens.color, ...kitTokens.color },
  look: { ...brandTokens.look, ...kitTokens.look },
});
`,
  "test/home.test.ts": `import { render } from "@keel/testing";
import { expect, it } from "vitest";
import HomePage from "../modules/app/HomePage.tsx";

it("renders the kit's example", () => {
  const view = render(HomePage, { props: {} });
  expect(view.find("app.example.text").text).toBe("Example");
  view.dispose();
});
`,
};

/** Every file under `dir` whose name ends with `ext`. */
async function filesUnder(dir, ext) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true, recursive: true }))
    if (e.isFile() && e.name.endsWith(ext)) out.push(join(e.parentPath, e.name));
  return out;
}

/** GET `path` from `base`; `{ status, body }`, status 0 when the request fails. */
async function get(base, path, accept = "*/*") {
  try {
    const r = await fetch(`${base}${path}`, { headers: { accept }, signal: AbortSignal.timeout(fixedTime(30_000)) });
    return { status: r.status, body: await r.text() };
  } catch {
    return { status: 0, body: "" };
  }
}

/** Start `keel dev --port <port>` in `dir` as the leader of its own process group; its output is kept in `log`. */
function startDev(dir, port) {
  const bin = join(dir, "node_modules", ".bin", "keel");
  const child = spawn(bin, ["dev", "--port", String(port)], {
    cwd: dir,
    env: { ...process.env, KEEL_AGENT: "1" },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  const log = [];
  for (const out of [child.stdout, child.stderr]) out.on("data", (d) => log.push(...String(d).trim().split("\n")));
  const exited = new Promise((resolve) => child.once("exit", resolve));
  return { child, log, exited };
}

const tmp = await mkdtemp(join(tmpdir(), "keel-library-installed-"));
let kit = kitArg;
try {
  if (kit === undefined) {
    kit = join(tmp, "keel-kit");
    const packed = await packKit(root, kit, { build: false });
    step("kit packed from the built packages", packed.length > 0, `${packed.length} tarballs`);
  }
  const yaml = await overridesYaml(kit);
  const boot = join(tmp, "boot");
  await mkdir(boot);
  await writeFile(
    join(boot, "package.json"),
    `${JSON.stringify({ name: "boot", private: true, dependencies: { "@keel/cli": "0.0.0" } })}\n`,
  );
  await writeFile(join(boot, "pnpm-workspace.yaml"), yaml);
  if (!(await run("bootstrap install of the kit's @keel/cli", "pnpm", ["install", "--prefer-offline"], boot)))
    throw new Error("no cli");
  const cli = join(boot, "node_modules", "@keel", "cli", "dist", "src", "bin.js");
  await run("keel scaffold library @acme/kit", process.execPath, [cli, "scaffold", "library", "@acme/kit"], tmp);
  await run("keel scaffold project shop", process.execPath, [cli, "scaffold", "project", "shop"], tmp);

  // The library: ./tokens and ./tools entries, keel first, naming .ts sources.
  const lib = join(tmp, "kit");
  for (const [file, text] of Object.entries(LIBRARY)) await writeFile(join(lib, file), text);
  await json(join(lib, "package.json"), (p) => {
    p.exports = { ".": entry("index"), "./tokens": entry("kitTokens"), "./tools": entry("tools") };
    p.peerDependencies["@keel/check"] = "^0.0.0";
    p.devDependencies["@keel/check"] = "^0.0.0";
  });
  await writeFile(join(lib, "pnpm-workspace.yaml"), yaml);
  await run("library install", "pnpm", ["install", "--prefer-offline"], lib);
  await run("library keel pack", "pnpm", ["exec", "keel", "pack"], lib);
  await run("library pnpm pack (prepack: build, keel pack --check)", "pnpm", ["pack", "--pack-destination", tmp], lib);
  const tarball = (await readdir(tmp)).find((f) => /^acme-kit-.+\.tgz$/.test(f));
  step("library tarball", tarball !== undefined, tarball ?? "none");

  // The app: installs the tarball, composes its tokens, renders its component.
  const shop = join(tmp, "shop");
  await writeFile(join(shop, "pnpm-workspace.yaml"), yaml);
  for (const [file, text] of Object.entries(APP)) {
    await mkdir(join(shop, file, ".."), { recursive: true });
    await writeFile(join(shop, file), text);
  }
  await json(join(shop, "package.json"), (p) => {
    p.dependencies["@acme/kit"] = `file:${join(tmp, tarball ?? "none.tgz")}`;
    p.devDependencies["@keel/check"] = "^0.0.0";
  });
  await run("app install of the library tarball", "pnpm", ["install", "--prefer-offline"], shop);
  const installed = await sh(
    "node",
    [
      "-e",
      "process.stdout.write(require('fs').realpathSync(process.argv[1]))",
      join(shop, "node_modules", "@acme", "kit"),
    ],
    shop,
  );
  step(
    "the library lies under node_modules, not linked",
    installed.ok && installed.out.includes("/node_modules/"),
    installed.out.slice(-80),
  );
  await run("app keel check", "pnpm", ["exec", "keel", "check"], shop);
  await run("app keel test", "pnpm", ["exec", "keel", "test"], shop);
  if (await run("app keel build", "pnpm", ["exec", "keel", "build"], shop)) {
    const css = await Promise.all((await filesUnder(join(shop, "dist"), ".css")).map((f) => readFile(f, "utf8")));
    step(
      "built CSS holds the library's look color",
      css.some((t) => t.includes("--k-color-kit-accent")),
    );
  }

  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  dev = startDev(shop, port);
  let page = { status: 0, body: "" };
  for (const end = Date.now() + READY; Date.now() < end && page.status !== 200; await wait(fixedTime(250)))
    page = await get(base, "/", "text/html");
  step("keel dev serves /", page.status === 200 && page.body.includes("/@keel/entry.ts"), `status ${page.status}`);
  const home = await get(base, "/modules/app/HomePage.tsx");
  const source = /from "(\/node_modules\/[^"]*@acme\/kit\/src\/index\.ts)[^"]*"/.exec(home.body)?.[1];
  step(
    "the page module imports the library's source",
    home.status === 200 && source !== undefined,
    `status ${home.status}`,
  );
  const example =
    source === undefined ? { status: 0, body: "" } : await get(base, source.replace("index.ts", "Example.tsx"));
  step(
    "keel dev compiles the library's component",
    example.status === 200 && example.body.includes("${props.id}.text"),
    `status ${example.status}`,
  );
  const styles = await get(base, "/@keel/styles.css?d=web");
  step(
    "dev styles hold the library's look color",
    styles.status === 200 && styles.body.includes("kit-accent"),
    `status ${styles.status}`,
  );
  const errors = dev.log.filter((l) => /error/i.test(l));
  step("keel dev logs no error", errors.length === 0, errors[0]?.slice(0, 120) ?? "");
} catch (e) {
  caught(e);
  step("flow", false, String(e).split("\n")[0]);
} finally {
  killGroup();
  await Promise.race([dev?.exited, wait(fixedTime(10_000))]);
  if (keep) step("temp folder kept", true, tmp);
  else await rm(tmp, { recursive: true, force: true });
}
finish("library-installed");
