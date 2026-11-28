import type { Answered } from "../../types/Answered.ts";
import type { AnswerEntry } from "./AnswerEntry.ts";

/** Each live `answer` handle's entry, for the proxy of a serve whose `origins` map to it. */
export const answerEntries = new WeakMap<Answered, AnswerEntry>();
