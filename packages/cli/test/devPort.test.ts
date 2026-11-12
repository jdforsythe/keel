// Flag parsing and the E1560 line of `keel dev --port`. The busy port is held by the test's own listener on port 0.
import net from "node:net";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { parseArgv } from "../src/internal/parseArgv.ts";
import { portBusy } from "../src/internal/portBusy.ts";
import { portDiag } from "../src/internal/portDiag.ts";
import { portProblem } from "../src/internal/portProblem.ts";
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

const holdOn = async (
  host: string,
): Promise<{ readonly port: number; readonly close: () => Promise<void> } | undefined> => {
  const holder = net.createServer();
  const bound = await new Promise<boolean>((resolve) => {
    holder.once("error", () => resolve(false));
    holder.listen({ port: 0, host }, () => resolve(true));
  });
  if (!bound) return undefined;
  const addr = holder.address();
  const port = typeof addr === "object" && addr !== null ? addr.port : -1;
  return { port, close: () => new Promise<void>((r) => holder.close(() => r())) };
};

describe("portBusy per address", () => {
  for (const host of ["127.0.0.1", "0.0.0.0", "::1", "::"]) {
    it(`a listener on ${host} alone makes the port busy`, async (ctx) => {
      const held = await holdOn(host);
      if (held === undefined) return ctx.skip();
      try {
        expect(await portBusy(held.port)).toBe(true);
      } finally {
        await held.close();
      }
    });
  }

  it("a port nobody holds is not busy", async () => {
    const held = await holdOn("127.0.0.1");
    if (held === undefined) throw new Error("no IPv4 loopback");
    await held.close();
    expect(await portBusy(held.port)).toBe(false);
  });
});

describe("portDiag wording", () => {
  it("EADDRINUSE says in use, EACCES says cannot be bound, both one E1560 line naming the port", () => {
    expect(portProblem("EADDRINUSE")).toBe("is in use");
    expect(portProblem("EACCES")).toBe("cannot be bound");
    expect(portProblem(undefined)).toBe("is in use");
    expect(portDiag(80, "EACCES").message).toBe("dev port 80 cannot be bound");
    expect(portDiag(80, "EADDRINUSE").message).toBe("dev port 80 is in use");
    expect(portDiag(80).message).toBe("dev port 80 is in use");
  });
});

describe("int flag text", () => {
  it("rejects non-canonical integer text as E1052", () => {
    for (const v of ["1e3", "+80", "08080", "80.0", "0x50", " 80", "80 ", "-0"]) {
      const r = parseArgv(["dev", `--port=${v}`], operations);
      expect(r.ok).toBe(false);
      expect(!r.ok && r.diags.map((d) => d.code)).toEqual(["E1052"]);
    }
  });

  it("accepts --limit with canonical text and still rejects 0", () => {
    const ok = parseArgv(["dev", "--limit", "5"], operations);
    expect(ok.ok && ok.input.limit).toBe(5);
    expect(parseArgv(["dev", "--limit", "05"], operations).ok).toBe(false);
    expect(parseArgv(["dev", "--limit", "0"], operations).ok).toBe(false);
  });

  it("every accepted value round-trips through String(Number(x))", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 8 }), (x) => {
        const r = parseArgv(["dev", `--port=${x}`], operations);
        if (r.ok) expect(String(Number(x))).toBe(x);
      }),
      { seed: SEED, numRuns: 2000 },
    );
    fc.assert(
      fc.property(fc.stringMatching(/^[-+0-9e. x]{1,6}$/), (x) => {
        const r = parseArgv(["dev", `--port=${x}`], operations);
        if (r.ok) expect(String(Number(x))).toBe(x);
      }),
      { seed: SEED, numRuns: 2000 },
    );
  });
});
