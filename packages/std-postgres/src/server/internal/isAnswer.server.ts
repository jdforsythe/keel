import type { Answer } from "./Answer.ts";
import { answerOf } from "./answerOf.server.ts";

/** Whether driver error `e` is answer `kind` (`answerOf`): the test an `expect` of std.postgres selects by. */
export function isAnswer(e: unknown, kind: Answer): boolean {
  return answerOf(e) === kind;
}
