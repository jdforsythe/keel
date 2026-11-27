/**
 * The Node built-ins whose functions a build-time evaluation refuses to call (E1050, k.compiler Build-time
 * evaluation): each starts a child process or worker, reads from the network or the terminal, runs code compiled
 * from a string, or reaches the host past the bundle's views, which the evaluation cannot observe. Importing one is
 * allowed: a handler that uses it runs at request time, never in the evaluation.
 */
export const REFUSED_BUILTINS: readonly string[] = [
  "child_process",
  "cluster",
  "dgram",
  "dns",
  "dns/promises",
  "http",
  "http2",
  "https",
  "inspector",
  "inspector/promises",
  "net",
  "readline",
  "readline/promises",
  "repl",
  "sqlite",
  "tls",
  "trace_events",
  "v8",
  "vm",
  "wasi",
  "worker_threads",
];
