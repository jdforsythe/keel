// Flag parsing and the E1560 line of `keel dev --port`. The busy port is held by the test's own listener on port 0.
import net from "node:net";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { parseArgv } from "../src/internal/parseArgv.ts";
import { portBusy } from "../src/internal/portBusy.ts";
import { portDiag } from "../src/internal/portDiag.ts";
import { respond } from "../src/internal/respond.ts";
import { summary } from "../src/internal/summary.ts";
import { operations } from "../src/operations.ts";

const SEED = 1337;
const io = { cwd: "/p" };

describe("dev --port flag", () => {
  it("accepts an integer in 1..65535, as a flag value or --port=N", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 65535 }), (n) => {
        for (const argv of [
          ["dev", "--port", String(n)],
          ["dev", `--port=${n}`],
        ]) {
          const r = parseArgv(argv, operations);
          expect(r.ok && r.input.port).toBe(n);
        }
      }),
      { seed: SEED },
    );
  });

  it("no flag leaves the port unset", () => {
    const r = parseArgv(["dev"], operations);
    expect(r.ok && r.input.port).toBeUndefined();
  });

  it("rejects out-of-range, fractional and non-numeric values as E1052", () => {
    for (const v of ["0", "-1", "65536", "1.5", "abc", ""]) {
      const r = parseArgv(["dev", `--port=${v}`], operations);
      if (r.ok) throw new Error(`accepted ${v} ${JSON.stringify(r.input)}`);
      expect(!r.ok && r.diags.map((d) => d.code)).toEqual(["E1052"]);
    }
    expect(parseArgv(["dev", "--port"], operations).ok).toBe(false);
  });
});

describe("dev port in use", () => {
  const line = (port: number, format: "compact" | "json"): string => {
    const d = portDiag(port);
    return respond([d, summary("dev", [d], { errors: 1 })], io, { command: "dev", format }).stdout;
  };

  it("is one E1560 line naming the port, exit 1, in compact and json", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 65535 }), (n) => {
        const compact = line(n, "compact")
          .split("\n")
          .filter((l) => l.includes("E1560"));
        expect(compact).toHaveLength(1);
        expect(compact[0]).toContain(String(n));
        const json = line(n, "json")
          .split("\n")
          .filter((l) => l.includes("E1560"));
        expect(json).toHaveLength(1);
        expect(JSON.parse(json[0] ?? "").message).toContain(String(n));
        expect(respond([portDiag(n)], io, { command: "dev", format: "json" }).code).toBe(1);
      }),
      { seed: SEED },
    );
  });
});

describe("portBusy", () => {
  it("counts a listener opened without a host, and a free port is not busy", async () => {
    const holder = net.createServer();
    await new Promise<void>((r) => holder.listen(0, r));
    const addr = holder.address();
    const port = typeof addr === "object" && addr !== null ? addr.port : -1;
    expect(await portBusy(port)).toBe(true);
    await new Promise<void>((r) => holder.close(() => r()));
    expect(await portBusy(port)).toBe(false);
  });
});
