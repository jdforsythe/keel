// Runs the built restart proof of golden-1 (`restartBuilt.ts`) on its own, without the eval's agent phase: SQLite
// always, and Postgres too when `KEEL_TEST_POSTGRES_URL` names a server. Prints `ok restart-proof` or
// `fail restart-proof <failed steps>` and exits 0 or 1. Usage: node evals/tasks/golden-1-api/restartProof.ts
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { restartBuilt } from "./restartBuilt.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const postgres = (process.env.KEEL_TEST_POSTGRES_URL ?? "") !== "";
const failed = await restartBuilt(root);
process.stdout.write(
  failed === undefined
    ? `ok restart-proof sqlite${postgres ? " postgres" : ""}\n`
    : `fail restart-proof ${failed.slice(0, 400)}\n`,
);
process.exitCode = failed === undefined ? 0 : 1;
