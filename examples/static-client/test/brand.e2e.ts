// The browser halves of RFC 0188 that unit tests cannot reach, in Chromium: a copy of this example in a temporary
// folder, on `brandTokens`, its page replaced by one with no styling of its own (a 200-character unbroken string, a
// Link, a Button, an Input with its label, and a row Box of three Buttons) and built with `keel build`. Then: at 320px
// the document does not scroll sideways; the body has the brand's font, colour and background; Tab focus on the link, the
// button and the input shows the 2px solid brand ring at 2px offset and a mouse click on the button shows none; the
// Box `direction={{ base: 'column', md: 'row' }}` stacks at 390px and is a row sharing a top edge at 1024px. No page
// or console error is raised (an unread one fails the test).
import { cp, rm, symlink, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { build, serve } from "@keel/testing/e2e";
import { fixedTime } from "@keel/tooling/test-time";
import { tempDir } from "@keel/tooling/test-tmp";
import { expect, it } from "vitest";

const here = join(import.meta.dirname, "..");
const SKIP = new Set(["node_modules", "dist", ".keel-dev", ".turbo", "reports"]);
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
const RING = {
  "outline-style": "solid",
  "outline-width": "2px",
  "outline-color": "rgb(26, 25, 30)",
  "outline-offset": "2px",
} as const;
const RING_NAMES = ["outline-style", "outline-width", "outline-color", "outline-offset"] as const;

// The build of a copy is the machine's own work, not a bound the test chose.
it("the brand's reset, focus ring and responsive Box hold in Chromium", { timeout: fixedTime(240_000) }, async () => {
  const tmp = tempDir("keel-e2e-brand-");
  const dir = join(tmp, "app");
  try {
    // No `test/`: the copy is built alone, and vitest resolves from the workspace root, not from the copy.
    await cp(here, dir, {
      recursive: true,
      filter: (src) => src === here || (src !== join(here, "test") && !SKIP.has(basename(src))),
    });
    await symlink(join(here, "node_modules"), join(dir, "node_modules"), "dir");
    await writeFile(join(dir, "modules", "app", "HomePage.tsx"), PAGE);
    await writeFile(join(dir, "modules", "app", "Note.schema.ts"), NOTE);
    await build(dir);

    const app = await serve({ project: dir });
    const page = await app.open("/");
    await page.viewport({ width: 320, height: 800 });
    await page.find("app.home.row");

    // 320px: no sideways scroll with a 200-character string.
    expect((await page.layout()).scrollWidth).toBeLessThanOrEqual(320);

    // The body has the brand's font, colour and background.
    const body = await page.style(undefined, ["font-family", "color", "background-color"]);
    expect(body["font-family"]?.replace(/^["']/, "").startsWith("Source Serif 4")).toBe(true);
    expect(body.color).toBe("rgb(26, 25, 30)");
    expect(body["background-color"]).toBe("rgb(249, 249, 249)");

    // Tab order is the document order: link, button, input; each shows the brand ring when it takes the focus.
    for (const id of ["app.home.link", "app.home.button", "brand.note:note"]) {
      await page.press("Tab");
      expect((await page.find(id)).state.focused).toBe(true);
      expect(await page.style(id, RING_NAMES)).toEqual(RING);
    }

    // A mouse click on the button focuses it and shows no ring.
    await page.fire("app.home.button", { type: "click" });
    expect((await page.find("app.home.button")).state.focused).toBe(true);
    const ring = await page.style("app.home.button", ["outline-style", "outline-width"]);
    expect(ring["outline-style"] === "none" || ring["outline-width"] === "0px").toBe(true);

    const tops = async (): Promise<number[]> =>
      Promise.all(["b1", "b2", "b3"].map(async (n) => (await page.layout(`app.home.${n}`)).y));

    await page.viewport({ width: 1024, height: 800 });
    expect(await page.style("app.home.row", ["display", "flex-direction"])).toEqual({
      display: "flex",
      "flex-direction": "row",
    });
    expect(new Set(await tops()).size).toBe(1);

    await page.viewport({ width: 390, height: 800 });
    expect(await page.style("app.home.row", ["display", "flex-direction"])).toEqual({
      display: "flex",
      "flex-direction": "column",
    });
    const [one, two, three] = await tops();
    expect(one).toBeLessThan(two ?? Number.NEGATIVE_INFINITY);
    expect(two).toBeLessThan(three ?? Number.NEGATIVE_INFINITY);

    expect(page.problems()).toEqual([]);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});
