import type { Escape } from "./Escape.ts";

const row = (danger: Escape["danger"], opt: boolean, protection: string, message: string, range = false): Escape => ({
  danger,
  opt,
  protection,
  message,
  range,
});

/** The codes of k.escapes, each with its row's danger; R1010's, R1057's and R2451's level can rise per finding (`Raw.danger`). */
export const ESCAPES: ReadonlyMap<string, Escape> = new Map([
  ["R1001", row("medium", true, "k.check", "unsafe() lifts the strict profile for its function")],
  ["R1010", row("low", true, "k.origins", "a declared third-party origin")],
  ["R1011", row("high", true, "k.hosting", "cross-origin API access allowed")],
  ["R1012", row("high", true, "k.reveal", "a secret revealed")],
  ["R1013", row("medium", false, "k.errors", "a defect raised where a Result is err")],
  ["R1015", row("low", false, "k.identity", "a type predicate or assertion proven by structure or its module's own set")],
  ["R1017", row("medium", false, "k.attempt", "an attempt whose expect claims every Error, or tests nothing")],
  ["R1014", row("high", true, "k.user", "an identity handle answers raw requests")],
  ["R1050", row("medium", false, "k.check", "unsafe syntax where keel check does not read")],
  ["R1051", row("medium", false, "k.check", "a lint suppression comment")],
  ["R1052", row("critical", false, "k.check", "a suppression directive assembled from parts")],
  ["R1053", row("critical", false, "k.security", "module specifier computed at run time")],
  ["R1055", row("critical", false, "k.security", "a Keel package's private files imported")],
  ["R1056", row("critical", false, "k.ctx", "a global reached by a computed key or indirect eval")],
  ["R1057", row("high", false, "k.ctx", "node access or env read in a server or test file")],
  ["R1058", row("high", false, "k.check", "a file under unsafe/ with no unsafe() call")],
  ["R1059", row("medium", false, "k.testing", "a focused, skipped or expected-to-fail test")],
  ["R1060", row("medium", false, "k.testing", "a test file deleted, or fewer assertions or tests", true)],
  ["R1061", row("critical", false, "k.testing", "a conformance file changed", true)],
  ["R1100", row("critical", false, "k.security", "framework source changed in the same range as an app", true)],
  ["R1101", row("critical", false, "k.security", "a dependency source overridden, patched or not from the registry")],
  ["R1102", row("critical", false, "k.security", "an install script, or a dependency allowed to build")],
  ["R1103", row("critical", false, "k.check", "type, lint, test or build configuration changed", true)],
  ["R1104", row("critical", false, "k.deploy", "a CI workflow or git hook changed", true)],
  ["R1105", row("critical", false, "k.review", "the review baseline changed", true)],
  ["R1107", row("high", false, "k.compiler", "a generated file under .keel/ or dist/ changed", true)],
  ["R1108", row("high", false, "k.privacy", "fewer pii, secret or guard calls", true)],
  ["R1150", row("critical", false, "k.review", "a code file the review cannot parse")],
  ["R1151", row("low", false, "k.review", "a baseline entry that matches no finding")],
  ["R2451", row("medium", true, "std.postgres", "a transaction allows an anomaly serializable prevents")],
]);
