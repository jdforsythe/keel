// The profile's personal fields in the built household: the frame's note lists the typed phone as the recorder kept
// it, masked, and values typed into the personal fields reach no server log line and no file of the data folder but
// the database.
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { expect, it } from "vitest";
import { household, member } from "./householdApp.ts";

const canary = { name: "Quillon Vantablack", phone: "+44 7700 900417" };

/** Every file under `dir`, but those under `skip`. */
async function filesUnder(dir: string, skip: string): Promise<string[]> {
  const out: string[] = [];
  for (const e of await readdir(dir, { withFileTypes: true, recursive: true })) {
    const path = join(e.parentPath, e.name);
    if (e.isFile() && !path.startsWith(skip)) out.push(path);
  }
  return out;
}

it("a phone typed into the profile is masked in the frame's note and reaches no log line and no data file but the database", async () => {
  const { served, data } = await household();
  const page = await member(served, "Ada Lovelace", "ada@example.com");
  await page.navigate("/profile");
  await page.fire("members.profileForm:name", { type: "input", value: canary.name });
  await page.fire("app.recording.note.button", { type: "click" });
  await page.fire("members.profileForm:phone", { type: "input", value: canary.phone });
  const masked = `input members.profileForm:phone "${"x".repeat(canary.phone.length)}"`;
  await page.until("app.recording.events", { text: new RegExp(masked.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) });
  const noted = (await page.find("app.recording.events")).text;
  for (const v of Object.values(canary)) expect(noted).not.toContain(v);

  await page.fire("members.save", { type: "click" });
  await page.until("members.saved", { text: /\S/ });
  await page.reload();
  expect((await page.find("members.profileForm:phone")).value).toBe(canary.phone);

  const files = await filesUnder(data, join(data, "postgres"));
  expect(files.length).toBeGreaterThan(0);
  const leaks: string[] = [];
  for (const f of files) {
    const bytes = await readFile(f);
    for (const v of Object.values(canary)) if (bytes.includes(v)) leaks.push(`${f.slice(data.length + 1)} has ${v}`);
  }
  const log = JSON.stringify(served.serverLog());
  for (const v of Object.values(canary)) if (log.includes(v)) leaks.push(`log has ${v}`);
  expect(leaks).toEqual([]);
  expect(page.problems()).toEqual([]);
});
