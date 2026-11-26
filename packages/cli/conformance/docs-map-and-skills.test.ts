// Spec: k.docs, clause "`keel docs` emits a `docs.area` per `map.json` area in map order, then a `docs.entry` per skill, and no section's `docs.entry`; `keel docs keel-client` prints `skills/keel-client/SKILL.md` byte for byte."
// Spec: k.docs, clause "A skill whose `description` is `Build pages; E1401, E19xx` is listed with `title` `Build pages`."
// Seed 1337 (map order property). Red: `docs` is absent (E1051).
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { CLIENT_SKILL, SEED, baseline, cliPkg, jsonRecords, pkg, project, run, skillText } from "./docs-support";

// An area id is one word of lowercase letters (k.docs Areas); `other` is reserved and none starts with `keel`.
const areaIds = fc.uniqueArray(
  fc.stringMatching(/^[a-z]{3,8}$/).filter((a) => a !== "other" && !a.startsWith("keel")),
  { minLength: 1, maxLength: 6 },
);

describe("k.docs map and skills", () => {
  it("`keel docs` emits a docs.area per map.json area in map order, then a docs.entry per skill, and no section's docs.entry", async () => {
    await fc.assert(
      fc.asyncProperty(areaIds, async (list) => {
        const map = list.map((a, i) => ({
          id: `k.s${i}`,
          title: `T ${a}`,
          package: "@keel/router",
          area: a,
        }));
        const files = [
          ...project(["cli", "router"]),
          ...cliPkg(map, [CLIENT_SKILL, { name: "keel-server", description: "Server", body: "x\n" }]),
          ...pkg(
            "router",
            "1.0.0",
            map.map((m) => ({ id: m.id, title: m.title, text: `# ${m.id}\n` })),
          ),
        ];
        const r = await jsonRecords(["docs"], files);
        expect(r.code).toBe(0);
        const areas = r.recs.filter((x) => x.kind === "docs.area");
        expect(areas.map((a) => a.id)).toEqual(list);
        expect(areas.every((a) => a.sections === 1)).toBe(true);
        const entries = r.recs.filter((x) => x.kind === "docs.entry");
        expect(entries.map((e) => e.id)).toEqual(["keel-client", "keel-server"]);
        expect(entries.every((e) => e.package === "@keel/cli" && e.installed === true)).toBe(true);
        expect(entries[0]?.title).toBe(CLIENT_SKILL.description);
        const lastArea = r.recs.lastIndexOf(areas[areas.length - 1] ?? {});
        expect(r.recs.findIndex((x) => x.kind === "docs.entry")).toBeGreaterThan(lastArea);
      }),
      { seed: SEED, numRuns: 15 },
    );
  });

  it("`keel docs keel-client` prints skills/keel-client/SKILL.md byte for byte as docs.skill", async () => {
    const text = skillText(CLIENT_SKILL);
    const r = await jsonRecords(["docs", "keel-client"], baseline());
    expect(r.code).toBe(0);
    const s = r.recs.filter((x) => x.kind === "docs.skill");
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ id: "keel-client", text });
    expect(typeof s[0]?.version).toBe("string");
  });

  it("a skill whose description is `Build pages; E1401, E19xx` is listed with title `Build pages` in json and `<name> Build pages @keel/cli` in compact; keel docs <name> prints the full description", async () => {
    const pages = { name: "keel-pages", description: "Build pages; E1401, E19xx", body: "# pages\n" };
    const skills = [
      pages,
      { name: "keel-plain", description: "No codes here", body: "# plain\n" },
      { name: "keel-two", description: "Build; more things; E1401", body: "# two\n" },
    ];
    const files = [...project(["cli"]), ...cliPkg([], skills)];
    const r = await jsonRecords(["docs"], files);
    expect(r.code).toBe(0);
    const title = (id: string): unknown => r.recs.find((x) => x.kind === "docs.entry" && x.id === id)?.title;
    expect(title("keel-pages")).toBe("Build pages");
    expect(title("keel-plain")).toBe("No codes here");
    expect(title("keel-two")).toBe("Build; more things");
    const c = await run(["docs", "--format=compact"], { files });
    const out = c.stdout.split("\n");
    expect(out).toContain("keel-pages Build pages @keel/cli");
    expect(out).toContain("keel-plain No codes here @keel/cli");
    expect(out).toContain("keel-two Build; more things @keel/cli");
    expect(c.stdout).not.toContain("E19xx");
    const s = await jsonRecords(["docs", "keel-pages"], files);
    expect(s.recs.find((x) => x.kind === "docs.skill")?.text).toBe(skillText(pages));
    expect(s.out).toContain("Build pages; E1401, E19xx");
  });
});
