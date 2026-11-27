import { isRefusal } from "@keel/schema/internal/refusal";
import { refusedLine } from "./refusedLine.ts";

/**
 * What the production entry does with a throw while its modules are evaluated, before `start` runs (k.deploy
 * Refusals at start): a coded refusal (E1765 among them) is its one `diag` and exit 1; any other value is an uncaught
 * throw, one E1577 record by k.leave Process (`onUncaught`), then exit 1. It reads the refusal guard alone, so a
 * refusal the census raises while `@keel/schema` is evaluated is still read.
 */
export async function startFailed(thrown: unknown, dir: string): Promise<void> {
  const format = process.env.KEEL_FORMAT === "json" ? "json" : "compact";
  if (isRefusal(thrown)) {
    process.stdout.write(`${refusedLine(format, thrown)}\n`);
    process.exit(1);
  }
  const { onUncaught } = await import("./onUncaught.ts");
  onUncaught(
    { format, write: (text) => void process.stdout.write(`${text}\n`) },
    dir,
    () => false,
    () => process.exit(1),
  );
  process.nextTick(() => {
    throw thrown;
  });
}
