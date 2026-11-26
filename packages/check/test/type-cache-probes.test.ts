// Each question the type pass's recording host asks (k.check-cache Probes): the answer recorded is the answer
// `askDisk` gives again, the same while the disk is the same, and another after the change that question watches.
// No modification time is read: a rewrite with the old time is seen by its bytes.
import { mkdirSync, realpathSync, rmSync, symlinkSync, unlinkSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tempDir } from "@keel/tooling/test-tmp";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Probe } from "../src/internal/Probe.ts";
import { askDisk } from "../src/internal/askDisk.ts";
import { diskText } from "../src/internal/diskText.ts";
import { probeRecorder } from "../src/internal/probeRecorder.ts";
import { probesHold } from "../src/internal/probesHold.ts";

const OLD = 1_700_000_000;
let root = "";
beforeEach(() => {
  root = realpathSync(tempDir("keel-probes-"));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const put = (name: string, text: string): string => {
  const p = join(root, name);
  writeFileSync(p, text);
  utimesSync(p, OLD, OLD);
  return p;
};

/** Record with `ask`, check the recorded probes hold, change the disk, check they no longer do. */
function watches(ask: (r: ReturnType<typeof probeRecorder>) => void, change: () => void): readonly Probe[] {
  const r = probeRecorder();
  ask(r);
  const probes = r.probes() ?? [];
  expect(probes.length).toBeGreaterThan(0);
  for (const [kind, q, a] of probes) expect(askDisk(kind, q)).toBe(a);
  expect(probesHold(probes)).toBe(true);
  change();
  expect(probesHold(probes)).toBe(false);
  return probes;
}

describe("the recorded questions", () => {
  it("a file read: bytes by hash, so a rewrite with the old modification time is seen", () => {
    const f = put("a.d.ts", "export declare const n: number\n");
    const [p] = watches(
      (r) => expect(r.read(f)).toBe("export declare const n: number\n"),
      () => put("a.d.ts", "export declare const n: string\n"),
    );
    expect(p?.[0]).toBe("r");
  });

  it("a file read of an absent file answers absent, and the file appearing is seen", () => {
    const f = join(root, "none.ts");
    watches(
      (r) => expect(r.read(f)).toBeUndefined(),
      () => put("none.ts", ""),
    );
  });

  it("a file existence test", () => {
    const f = join(root, "sub.ts");
    watches(
      (r) => expect(r.fileExists(f)).toBe(false),
      () => put("sub.ts", "export {}\n"),
    );
  });

  it("a folder existence test", () => {
    const d = join(root, "pkg");
    watches(
      (r) => expect(r.directoryExists(d)).toBe(false),
      () => mkdirSync(d),
    );
  });

  it("a real-path lookup: a link moved to another target is seen", () => {
    mkdirSync(join(root, "one"));
    mkdirSync(join(root, "two"));
    const link = join(root, "link");
    symlinkSync(join(root, "one"), link);
    watches(
      (r) => expect(r.realpath?.(link)).toBe(join(root, "one")),
      () => {
        unlinkSync(link);
        symlinkSync(join(root, "two"), link);
      },
    );
  });

  it("a folder listing", () => {
    mkdirSync(join(root, "a"));
    watches(
      (r) => expect(r.getDirectories(root)).toEqual(["a"]),
      () => mkdirSync(join(root, "b")),
    );
  });

  it("a recursive folder read", () => {
    put("a.ts", "");
    watches(
      (r) => expect(r.readDirectory(root, [".ts"], undefined, ["**/*"])).toEqual([join(root, "a.ts")]),
      () => put("b.ts", ""),
    );
  });
});

describe("the recorder", () => {
  it("an unchanged disk answers the same; one question asked twice is one probe", () => {
    const f = put("a.ts", "x");
    const r = probeRecorder();
    r.read(f);
    r.read(f);
    r.fileExists(f);
    expect(r.probes()).toHaveLength(2);
    utimesSync(f, OLD + 100, OLD + 100);
    expect(probesHold(r.probes() ?? [])).toBe(true);
  });

  it("a question answered two ways within one pass keeps no probes", () => {
    const f = put("a.ts", "x");
    const r = probeRecorder();
    r.read(f);
    put("a.ts", "y");
    r.read(f);
    expect(r.probes()).toBeUndefined();
  });

  it("reads decode as TypeScript does: a byte order mark is dropped, the hash is of the bytes", () => {
    const f = join(root, "bom.ts");
    writeFileSync(f, Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from("export {}")]));
    expect(diskText(f)?.text).toBe("export {}");
    writeFileSync(f, Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from("ab", "utf16le")]));
    expect(diskText(f)?.text).toBe("ab");
    writeFileSync(f, Buffer.from([0xfe, 0xff, 0x00, 0x61, 0x00, 0x62]));
    expect(diskText(f)?.text).toBe("ab");
    expect(diskText(f)?.hash).not.toBe(diskText(put("plain.ts", "ab"))?.hash);
  });

  it("a probe whose question does not parse never holds", () => {
    expect(probesHold([["x", "not json", ""]])).toBe(false);
  });
});
