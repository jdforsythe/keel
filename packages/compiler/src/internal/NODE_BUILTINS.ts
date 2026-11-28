/**
 * The bare names every supported Node version (22 and later) lists as built-in (k.bundle Node built-ins), shipped so a
 * build passes or fails alike on every one. A `node:` specifier is a built-in whatever it names.
 */
export const NODE_BUILTINS: ReadonlySet<string> = new Set([
  ...["_http_agent", "_http_client", "_http_common", "_http_incoming", "_http_outgoing", "_http_server"],
  ...["_stream_duplex", "_stream_passthrough", "_stream_readable", "_stream_transform", "_stream_wrap"],
  ...["_stream_writable", "_tls_common", "_tls_wrap", "assert", "assert/strict", "async_hooks", "buffer"],
  ...["child_process", "cluster", "console", "constants", "crypto", "dgram", "diagnostics_channel", "dns"],
  ...["dns/promises", "domain", "events", "fs", "fs/promises", "http", "http2", "https", "inspector"],
  ...["inspector/promises", "module", "net", "os", "path", "path/posix", "path/win32", "perf_hooks", "process"],
  ...["punycode", "querystring", "readline", "readline/promises", "repl", "stream", "stream/consumers"],
  ...["stream/promises", "stream/web", "string_decoder", "sys", "timers", "timers/promises", "tls"],
  ...["trace_events", "tty", "url", "util", "util/types", "v8", "vm", "wasi", "worker_threads", "zlib"],
]);
