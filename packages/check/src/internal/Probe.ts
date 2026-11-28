/**
 * One file system question the type pass asked, with its answer (k.check-cache Probes). The kind: `r` a file read
 * (answer: SHA-256 of its bytes, or `-` when absent), `f` a file existence test and `d` a folder one (`1` or `0`),
 * `p` a real-path lookup (the target), `l` a folder listing (SHA-256 of its sorted entry names), `x` a recursive
 * folder read (the question is its arguments as JSON; the answer the SHA-256 of its sorted results).
 */
export type Probe = readonly [kind: "r" | "f" | "d" | "p" | "l" | "x", question: string, answer: string];
