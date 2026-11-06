import type { Evidence } from "@keel/testing";

/** fast-check's default run count when a property names none. */
const FC_DEFAULT_RUNS = 100;

/**
 * Static evidence from one test file (the ledger reads sources, not results; a referencing test counts as
 * passing): a fast-check file is a `property` with its largest literal `numRuns` (else 100) and its literal
 * seed (`seed: n` or `SEED = n`), any other file an `example`. `@keel/testing` `ledger` turns it into a rung.
 */
export function evidenceOf(source: string): Evidence {
  if (!source.includes("fast-check")) return { kind: "example", passed: true };
  const runs = [...source.matchAll(/numRuns:\s*(\d+)/g)].map((m) => Number(m[1]));
  const seed = /(?:seed:\s*|SEED\s*=\s*)(\d+)/.exec(source)?.[1];
  return {
    kind: "property",
    passed: true,
    runs: runs.length === 0 ? FC_DEFAULT_RUNS : Math.max(...runs),
    ...(seed === undefined ? {} : { seed: Number(seed) }),
  };
}
