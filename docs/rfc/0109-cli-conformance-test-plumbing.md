# RFC 0109: cli conformance: test plumbing

Status: implemented (user for the decisions, orchestrator for the choices, 2026-11-17). For backlog 0703 and 0462. ADR-0132 records it.

## Decisions
- D1: one `rfc:0109` commit may change `packages/cli/conformance/dev-port-0091.test.ts` and `packages/cli/conformance/topology-keel-dev-one-origin.test.ts` in their plumbing only. Every `expect` keeps its subject's meaning, its matcher and its expected value; every `// Spec:` line stays as it is; the fixtures, the spawned command and its arguments stay.
- D2: every HTTP request in the two files goes through one local helper, `get`, built on `node:http` with a fresh connection, a bounded socket timeout, a handled `error`, and its response read to its end or destroyed. No `fetch` remains in either file.
- D3: every `keel dev` child the files start is ended in an `afterEach`, by process group, with `SIGTERM` and then `SIGKILL` after a bound, and awaited. A child that is still running when its test fails or times out is ended there, not left to the next run.

No spec section changes. No assertion changes.

## Problem
Read on `jdforsythe/test-impl` at `4e5c2abd`.

**Bodies and sockets (0703).** A whole cli run once printed `T0001 setTypeOfService EINVAL` outside any test, so the run failed with 0 failed tests. The suspects make client connections to a `keel dev` child that may be starting or dying, through the global `fetch` (undici), whose sockets stay in its pool until their bodies are read and keep-alive ends:
- `dev-port-0091.test.ts:130` (`served`) and `topology-keel-dev-one-origin.test.ts:136` (`served`) retry `fetch` against a starting child, resolve on any response, and never read or cancel its body.
- `dev-port-0091.test.ts:186` and `:232` `fetch` the port after the busy one and never read the body.
- `topology-keel-dev-one-origin.test.ts:166` and `:171` read the body with `.text()` only after `expect(...status).toBe(200)`; a failing status throws first and leaves the body unread.

**Children (0462).** Both files spawn `node packages/cli/src/bin.ts dev` with `detached: true` (its own process group) and end it with `stop`, which sends one `SIGTERM` to the group and awaits `close` with no bound.
- `dev-port-0091.test.ts:177`: the `--port <busy>` case starts a child and has no `stop` at all; its `finally` closes only the holder. If the child does not exit (the regression the test is there to catch), it runs on after the test.
- A child that ignores or outlives `SIGTERM` (Vite's own handlers, a slow close) leaves `stop`'s `await` pending until the test's 120 s timeout, after which vitest moves on and the child keeps running. Two `keel dev` children with parent PID 1 were stopped by hand on 2026-11-12, after a passing run.

## Proposal
Both files gain the same three pieces, written once per file (each file stays standalone, as conformance files are).

**`get`.** Replaces every `fetch`:

```ts
import http from "node:http";

type Reply = { readonly status: number; readonly body: string };
/**
 * One GET to `localhost:port` over its own connection (no keep-alive): the status and the whole body, or null on any
 * socket or response error or after 10 s idle. The response is always read to its end, or destroyed.
 */
const get = (port: number, path: string, headers: Record<string, string> = {}): Promise<Reply | null> =>
  new Promise((done) => {
    const req = http.get({ host: "localhost", port, path, headers, agent: false, timeout: 10_000 }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => done({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8") }));
      res.on("error", () => done(null));
      res.on("aborted", () => done(null));
    });
    req.on("timeout", () => req.destroy());
    req.on("error", () => done(null));
  });
```

`host: "localhost"` is the host the files use today. A second `done` call after the first is a no-op of the promise.

**Tracked children and `stop`.**

```ts
const started = new Set<Proc>();
// in startDev, after spawn: started.add(proc);

/** Sends `s` to `p`'s process group unless the child has already exited. */
function signal(p: Proc, s: NodeJS.Signals): void {
  const pid = p.child.pid;
  if (pid === undefined || p.child.exitCode !== null || p.child.signalCode !== null) return;
  try {
    process.kill(-pid, s);
  } catch {
    // the group is gone
  }
}

/** Ends `p`'s process group: SIGTERM, then SIGKILL if it has not closed 10 s later; resolves with its exit code. */
async function stop(p: Proc): Promise<number | null> {
  started.delete(p);
  signal(p, "SIGTERM");
  let timer: NodeJS.Timeout | undefined;
  const late = new Promise<"late">((r) => {
    timer = setTimeout(() => r("late"), 10_000);
  });
  const first = await Promise.race([p.exited, late]);
  clearTimeout(timer);
  if (first === "late") signal(p, "SIGKILL");
  return p.exited;
}

afterEach(async () => {
  await Promise.all([...started].map(stop));
});
process.once("exit", () => {
  for (const p of started) signal(p, "SIGKILL");
});
```

The `exit` hook covers a worker that ends through `process.exit`; a worker killed by `SIGKILL` (the watchdog) runs no hook, and `pnpm orphans` remains the net for that.

**Line by line, `dev-port-0091.test.ts`:**
- 3-5 (header comment): "The wait for the server is a bounded retry of `fetch` (no timers)" becomes "a bounded retry of an `http.get` (no timers in the wait)", and the last sentence adds "every child is ended in `afterEach`". The `// Spec:` lines 1-2 stay.
- 6-14 (imports): add `import http from "node:http";` and `afterEach` from `vitest`.
- 70-98: `startDev` adds the child to `started`; `stop` is replaced as above; the `afterEach` and `exit` hook follow it.
- 130-133 (`served`): `const ok = (await get(port, "/")) !== null;`
- 160-162: the `finally { await stop(p); }` stays (the `afterEach` then finds nothing).
- 177: unchanged; the child is now ended by the `afterEach` whether the test passes or fails.
- 184-189: `const next = (await accepts(busy + 1)) && (await get(busy + 1, "/")) !== null;`
- 230-235: the same, for the config case.
- `expect(next).toBe(false)`, `expect(code).toBe(1)`, `expect(lines).toHaveLength(1)` and every other assertion: unchanged.

**Line by line, `topology-keel-dev-one-origin.test.ts`:**
- 2-4 (header comment): the same wording change. The `// Spec:` line 1 stays.
- 5-11 (imports): add `import http from "node:http";` and `afterEach` from `vitest`.
- 76-104: `startDev` and `stop` as above, with the `afterEach` and `exit` hook.
- 136-139 (`served`): `const ok = (await get(port, "/")) !== null;`
- 166-168: `const page = await get(port, "/", html);` then `expect(page?.status).toBe(200);` and `expect(page?.body).toContain("/@keel/entry.ts");`. The body is read before either assertion runs.
- 170-174: `const res = await get(port, path, html);` then `expect(res?.status, path).toBe(200);` and `expect(res?.body, path).toContain("<");`.
- 163 (`const origin = ...`) goes, since `get` takes the port.
- 179-181: the `finally { await stop(p); }` stays.

A `null` reply makes `page?.status` `undefined`, which fails `toBe(200)` as a rejected `fetch` failed the test before; the expected values are the same.

## Alternatives
- `fetch` with `await res.body?.cancel()` and an `AbortSignal.timeout`: keeps undici's pool in the test process, the suspect of 0703.
- One shared helper file under `packages/cli/conformance/`: a new import in two suites for about 40 lines; each conformance file reads alone today.
- Not detaching the child: a group kill is the only way to reach the Vite and esbuild processes the child starts.

## Spec diff
None.

## Conformance diff
The two files above, changed as listed, in one commit tagged `rfc:0109`. No other file.

## Verification
`pnpm --filter @keel/cli exec vitest run conformance/dev-port-0091.test.ts` and the same for `topology-keel-dev-one-origin.test.ts`, one at a time, each green; then `ps -Ao pid,ppid,command | grep 'bin.ts dev'` lists nothing, and `pnpm orphans` reports none. The commit's diff holds no change to an `expect` line's matcher or expected value (reviewer check).

## Migration
None.

## Token impact
None.
