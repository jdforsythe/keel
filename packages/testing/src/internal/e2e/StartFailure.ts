/** Why a process did not start: `bind` its port was taken (E1560), retried with another. */
export type StartFailure = { readonly why: "bind" | "exit" | "silent"; readonly detail: string };
