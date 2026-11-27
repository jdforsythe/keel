/** The kinds of question a build-time evaluation records besides its reads and `process.env` names (`Observed`). */
export type ObservedKind = "exists" | "stat" | "lstat" | "realpath" | "list" | "process" | "call" | "field";
