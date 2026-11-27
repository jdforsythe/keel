import type { Answer } from "./Answer.ts";
import { field } from "./field.server.ts";

/** No answer (std.postgres-errors): each code by itself, class `08` not by its prefix. */
const LOST = new Set(["08000", "08001", "08003", "08006", "57P01", "57P02", "57P03", "53300"]);
const RERUNS = new Set(["40001", "40P01"]);
/** `postgres.database`: classes `22`, `40`, `53`, `54`, `55`, `57` and `P0` (less the codes `LOST` holds) and `08007`. */
const DATABASE = /^(?:(?:22|40|53|54|55|57|P0)[0-9A-Z]{3}|08007)$/;
const NET = new Set(["ECONNREFUSED", "ECONNRESET", "ENOTFOUND", "ETIMEDOUT", "EPIPE", "EHOSTUNREACH", "EAI_AGAIN"]);
const DROPPED =
  /Connection terminated|connection timeout|timeout exceeded when trying to connect|Client has encountered a connection error/i;

/**
 * Driver error `e` as std.postgres-errors answers it: class `23` a constraint; `40001` and `40P01` a rerun; a refused,
 * reset or lost connection, `57P01` to `57P03`, `53300`, `08000`, `08001`, `08003` and `08006` no answer; a database
 * error of class `22`, `40`, `53`, `54`, `55`, `57` or `P0`, or `08007`, one a caller acts on; any other database error
 * (it has a `severity`) untaken; the rest not the database's.
 */
export function answerOf(e: unknown): Answer {
  const code = field(e, "code");
  if (code.startsWith("23")) return "constraint";
  if (RERUNS.has(code)) return "rerun";
  if (LOST.has(code) || NET.has(code)) return "lost";
  if (code === "" && e instanceof Error && DROPPED.test(e.message)) return "lost";
  if (field(e, "severity") === "") return "thrown";
  return DATABASE.test(code) ? "database" : "untaken";
}
