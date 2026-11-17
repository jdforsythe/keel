import { secretWalk } from "./secretWalk.ts";

/**
 * The revealed strings, numbers and data keys of each `Secret` anywhere under `value`, as strings: a string as is, a
 * number as `String()` gives it. Outside a secret only secrets are read. Inside one the value is read beside the node
 * it was sealed under: a record's keys, a `json` value's keys and an object's undeclared keys are data and are given,
 * a declared field name is schema text and is not. A value no union variant or `anyOf` member fits, a `json` value
 * and a value whose shape is not its node's are read whole: every string, number and own key at any depth. The empty
 * string and a boolean are left out: `true` and `false` stand in every log, and marking them hides nothing. Each object
 * is read once per node, so a value that holds itself ends, and one read visits at most 1,000,000 values (more than a
 * 1 MiB JSON body can hold), so a huge value ends too; past that, nothing more is read (`secretWalk` tells whether a
 * read was cut). Values come in the order met.
 */
export function secretValues(value: unknown): string[] {
  return secretWalk(value).values;
}
