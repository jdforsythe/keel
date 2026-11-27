// Built-run proof for the browser halves of RFC 0188 that unit tests cannot reach, in headless Chromium: a copy of
// examples/static-client in a temporary folder, on `brandTokens`, its page replaced by one with no styling of its own
// (a 200-character unbroken string, a Link, a Button, an Input with its label, and a row Box of three Buttons) and built
// with `keel build`. Then: at 320px the document does not scroll sideways; body has the brand's font, colour and
// background; Tab focus on the link, the button and the input shows the 2px solid brand ring at 2px offset and a mouse
// click on the button shows none; the Box `direction={{ base: 'column', md: 'row' }}` stacks at 390px and is a row
// sharing a top edge at 1024px; and the k.values Stylesheet invariant (`cssKept.mjs`): Chromium keeps every rule the
// compiler emits, and each attack value is refused before emission.
// Usage: node --disable-warning=ExperimentalWarning tooling/smoke/brand.mjs. Nothing is written inside the repo; the
// file server and the browser are stopped on every path, and a crash prints the steps it had.
import { createReadStream, statSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { extname, join, normalize } from "node:path";
import { chromium } from "@playwright/test";
import { fixedTime } from "../test-time.ts";
import { buildIn, copyApp, freePort, recorder, root } from "./built.mjs";
import { cssKept } from "./cssKept.mjs";

const LIMIT_MS = fixedTime(240_000);
const { step, finish } = recorder();
let tmp;
let server;
let browser;

const stopAll = async () => {
  await browser?.close().catch(() => undefined);
  await new Promise((r) => (server === undefined ? r() : server.close(() => r())));
  server?.closeAllConnections?.();
  if (tmp !== undefined) await rm(tmp, { recursive: true, force: true });
};
const limit = setTimeout(async () => {
  step("time limit", false, `${LIMIT_MS / 1000}s`);
  await Promise.race([stopAll(), new Promise((r) => setTimeout(r, fixedTime(5000)))]);
  finish("brand");
  process.exit(1);
}, LIMIT_MS);
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    await Promise.race([stopAll(), new Promise((r) => setTimeout(r, fixedTime(5000)))]);
    process.exit(130);
  });
}

const LONG = "x".repeat(200);
const PAGE = `import { form } from "@keel/forms";
import { type Infer, s } from "@keel/schema";
import { Box, Button, Input, Link, Text } from "@keel/ui";
import { Home } from "./Home.schema.ts";
import { Note } from "./Note.schema.ts";
import { app } from "./app.contract.ts";

export const Props = s.object({ data: Home });

export default function HomePage(_props: Infer<typeof Props>) {
  const f = form(Note, { id: "brand.note", initial: { note: "" } });
  return (
    <Box id="app.home" as="main">
      <Text id="app.home.long">${LONG}</Text>
      <Link id="app.home.link" to={app.href("app.home")}>
        A link
      </Link>
      <Button id="app.home.button" type="button">
        A button
      </Button>
      <Input field={f.field("note")} label="A note" />
      <Box id="app.home.row" direction={{ base: "column", md: "row" }} gap="2">
        <Button id="app.home.b1" type="button">
          One
        </Button>
        <Button id="app.home.b2" type="button">
          Two
        </Button>
        <Button id="app.home.b3" type="button">
          Three
        </Button>
      </Box>
    </Box>
  );
}
`;
const NOTE = `import { s } from "@keel/schema";

export const Note = s.object({ note: s.string({ max: 60 }) });
`;
const TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

/** A plain static file server over `folder`; `/` is `index.html`. */
async function serveFiles(folder) {
  const port = await freePort();
  server = createServer((req, res) => {
    const path = new URL(req.url ?? "/", "http://x").pathname;
    const asked = normalize(join(folder, path === "/" ? "index.html" : path));
    const ok = asked.startsWith(folder) && statSync(asked, { throwIfNoEntry: false })?.isFile() === true;
    res.writeHead(ok ? 200 : 404, { "content-type": TYPES[extname(asked)] ?? "application/octet-stream" });
    if (ok) createReadStream(asked).pipe(res);
    else res.end();
  });
  await new Promise((r) => server.listen(port, "127.0.0.1", r));
  return `http://127.0.0.1:${port}`;
}

const RING = "solid 2px rgb(26, 25, 30) 2px";

try {
  tmp = await mkdtemp(join(tmpdir(), "keel-brand-"));
  const dir = join(tmp, "app");
  await copyApp(dir, join(root, "examples", "static-client"));
  await writeFile(join(dir, "modules", "app", "HomePage.tsx"), PAGE);
  await writeFile(join(dir, "modules", "app", "Note.schema.ts"), NOTE);
  const built = await buildIn(dir);
  step("build the fixture", built);
  if (built) {
    const base = await serveFiles(join(dir, "dist", "web"));
    browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 320, height: 800 } });
    const errors = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(`${base}/`);
    await page.locator('[id="app.home.row"]').waitFor({ timeout: fixedTime(15_000) });

    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    step("320px: no sideways scroll with a 200-character string", width <= 320, `scrollWidth ${width}`);

    const body = await page.evaluate(() => {
      const c = getComputedStyle(document.body);
      return { font: c.fontFamily, color: c.color, bg: c.backgroundColor };
    });
    step(
      "body: brand font, colour, background",
      body.font.replace(/^["']/, "").startsWith("Source Serif 4") &&
        body.color === "rgb(26, 25, 30)" &&
        body.bg === "rgb(249, 249, 249)",
      `${body.font.slice(0, 30)} | ${body.color} | ${body.bg}`,
    );

    // Tab order is the document order: link, button, input.
    for (const [name, tag] of [
      ["link", "A"],
      ["button", "BUTTON"],
      ["input", "INPUT"],
    ]) {
      await page.keyboard.press("Tab");
      const seen = await page.evaluate(() => {
        const el = document.activeElement;
        const c = getComputedStyle(el);
        return { tag: el.tagName, ring: `${c.outlineStyle} ${c.outlineWidth} ${c.outlineColor} ${c.outlineOffset}` };
      });
      step(`Tab focus ring on the ${name}`, seen?.tag === tag && seen.ring === RING, `${seen?.tag} ${seen?.ring}`);
    }

    await page.locator('[id="app.home.button"]').click();
    const clicked = await page.evaluate(() => {
      const el = document.activeElement;
      const c = getComputedStyle(el);
      return { id: el.id, style: c.outlineStyle, width: c.outlineWidth };
    });
    step(
      "mouse click on the button: no focus ring",
      clicked.id === "app.home.button" && (clicked.style === "none" || clicked.width === "0px"),
      `${clicked.id} ${clicked.style} ${clicked.width}`,
    );

    const layout = async (w) => {
      await page.setViewportSize({ width: w, height: 800 });
      return page.evaluate(() => {
        const row = document.getElementById("app.home.row");
        const c = getComputedStyle(row);
        const tops = ["b1", "b2", "b3"].map(
          (n) => document.getElementById(`app.home.${n}`).getBoundingClientRect().top,
        );
        return { display: c.display, dir: c.flexDirection, tops };
      });
    };
    const wide = await layout(1024);
    step(
      "1024px: row Box is a flex row, buttons share a top edge",
      wide.display === "flex" && wide.dir === "row" && new Set(wide.tops).size === 1,
      `${wide.display} ${wide.dir} tops ${wide.tops.join(",")}`,
    );
    const narrow = await layout(390);
    step(
      "390px: row Box stacks",
      narrow.display === "flex" &&
        narrow.dir === "column" &&
        narrow.tops[0] < narrow.tops[1] &&
        narrow.tops[1] < narrow.tops[2],
      `${narrow.display} ${narrow.dir} tops ${narrow.tops.map(Math.round).join(",")}`,
    );
    await cssKept(page, step);
    step("no page or console errors", errors.length === 0, `${errors.length} errors`);
  }
} catch (e) {
  step("run", false, String(e?.message ?? e).split("\n")[0]);
} finally {
  clearTimeout(limit);
  await stopAll();
  finish("brand");
}
