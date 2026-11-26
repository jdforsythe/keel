import type { Page, Served } from "@keel/testing/e2e";
// The built household's setup page in a real browser, served as it is built (its `web` is a `node` deployable) on a
// free port with its data in the run's temporary folder. A member's setup page holds a form and the weekly staples
// panel (a `live` island with a status line). It opens held in a signed-in context with the name typed and the caret
// after its second character before its scripts run, says Connecting, resumes, and says Live once its first read
// commits. A run a second client starts through the API shows on it with the typed name, caret and focus as they were
// and no new document; the form saves the typed name with one POST; the server is killed (Connecting) and started
// again (Live, the run done); the browser goes offline, a second client starts another run the page does not show,
// and back online the page says Live and shows it.
import { fixedTime } from "@keel/tooling/test-time";
import { expect, it } from "vitest";
import { household } from "./householdApp.ts";

const live = "shopping.restock.live";
const last = "shopping.restock.last";
const started = "shopping.restock.started";
const json = { accept: "application/json", "content-type": "application/json", "x-keel": "1" };

/** A page signed in as a new member of the household: sign-up and sign-in through the identity mount keep the cookie. */
async function signedIn(served: Served, who: string, path: string): Promise<Page> {
  const page = await served.open("/signin");
  const mount = (route: string, fields: Record<string, string>) =>
    page.fetch(`/api/auth${route}`, {
      method: "POST",
      headers: {
        accept: "text/html",
        "content-type": "application/x-www-form-urlencoded",
        origin: served.origin(),
      },
      body: new URLSearchParams(fields).toString(),
    });
  const password = "resume password";
  await mount("/sign-up/email", { name: "Resume Member", email: who, password });
  await mount("/sign-in/email", { email: who, password });
  await page.navigate(path);
  return page;
}

/** `POST /api/restock` (Run now) as the member of `page`, as a second client; the status. */
const runNow = async (page: Page): Promise<number> =>
  (await page.fetch("/api/restock", { method: "POST", headers: json, body: "{}" })).status;

/** The text of the document's `problems()` that are not a request the page lost with its server or its network. */
function unexpected(page: Page): string[] {
  return page
    .problems()
    .filter((p) => !(p.kind === "console" && p.text.startsWith("Failed to load resource")))
    .map((p) => `${p.kind}: ${p.text}`);
}

it(
  "the setup page follows a second client's run, saves the name once, and rejoins after an offline window",
  { timeout: fixedTime(400_000) }, // a run's own time: five staples two seconds apart, twice, and one after a restart
  async () => {
    const { served } = await household();
    const who = `member-${process.pid}@example.com`;
    const typed = "Elm Street";
    const input = "setup.form:name";
    const signed = await signedIn(served, who, "/signin");
    const page = await signed.open("/setup", { hold: true });
    await page.fire(input, { type: "input", value: typed });
    await page.fire(input, { type: "focus" });
    await page.press("Home");
    await page.press("ArrowRight");
    await page.press("ArrowRight");
    // The served document has no stream yet.
    expect((await page.find(live)).text).toMatch(/^Connecting/);
    await page.resume();
    expect((await page.find(input)).value).toBe(typed);
    // std.live: `status()` is `connecting` before the first read commits and `live` after it.
    await page.until(live, { text: /^Live/ });
    const documents = (await page.documents()).length;

    // std.live: a write by A is in B's hydrated store after B's next read, with no input from B.
    const observer = await signedIn(served, `observer-${process.pid}@example.com`, "/setup");
    await observer.until(live, { text: /^Live/ });
    const before = (await page.find(started)).text;
    expect(await runNow(observer)).toBe(200);
    await page.until(started, { text: new RegExp(`^(?!${before.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$).+`) });
    expect((await page.find(last)).text).toMatch(/^Running/);
    // k.runtime: the typed name and focus are kept through the update, with no new document.
    const field = await page.find(input);
    expect(field.value).toBe(typed);
    expect(field.state.focused).toBe(true);
    // The caret is where it was: the next key lands after the second character.
    await page.press("x");
    expect((await page.find(input)).value).toBe("Elxm Street");
    await page.fire(input, { type: "input", value: typed });
    expect((await page.documents()).length).toBe(documents);
    await page.until(live, { text: /^Live/ });
    expect(unexpected(page)).toEqual([]);

    // k.forms: the submit sends the typed name once and the action saves it.
    const posts = page.requests().filter((r) => r.method === "POST").length;
    await page.fire("setup.save", { type: "click" });
    await page.until("setup.done", { text: /\S/ });
    const sent = page.requests().filter((r) => r.method === "POST");
    expect(sent.length - posts).toBe(1);
    expect(new URL(sent.at(-1)?.url ?? "http://x/").pathname).toBe("/setup");
    const named: unknown = await (await page.fetch("/api/household", { headers: json })).json();
    expect(JSON.stringify(named)).toContain(`"name":"${typed}"`);
    await page.until(live, { text: /^Live/ });
    // The submit loaded documents; what follows loads none.
    const afterSubmit = (await page.documents()).length;

    // std.live: `connecting` once the server is gone; started again the stream reopens and a read runs. A step the
    // killed server held runs again after its 10 s timeout and a second; four 2 s waits lie between the staples.
    await served.stop();
    await page.until(live, { text: /^Connecting/ }, { fixed: 15_000 });
    await served.start();
    await page.until(live, { text: /^Live/ }, { fixed: 45_000 });
    await page.until(last, { text: /^Done: 5 of 5/ }, { fixed: 79_000 });
    expect(unexpected(page)).toEqual([]);

    // std.live: `offline` while the net is offline and no read runs; back online the stream reopens and one read runs.
    const stale = `${(await page.find(last)).text} ${(await page.find(started)).text}`;
    await page.offline(true);
    await page.until(live, { text: /^Offline/ });
    expect(await runNow(observer)).toBe(200);
    await observer.until(last, { text: /^Running: [1-9]/ }, { fixed: 15_000 });
    expect(`${(await page.find(last)).text} ${(await page.find(started)).text}`).toBe(stale);
    await page.offline(false);
    await page.until(live, { text: /^Live/ }, { fixed: 45_000 });
    await page.until(last, { text: /^(Running|Done)/ });
    expect((await page.find(started)).text).not.toBe(stale.split(" ").slice(-1).join(" "));
    expect((await page.documents()).length).toBe(afterSubmit);
    expect(unexpected(page)).toEqual([]);
    // The next run of this page ends first.
    await observer.until(last, { text: /^Done/ }, { fixed: 60_000 });
    // The observer and the sign-in tab lost their requests with the killed server and read nothing else.
    expect(unexpected(observer)).toEqual([]);
    expect(unexpected(signed)).toEqual([]);
  },
);
