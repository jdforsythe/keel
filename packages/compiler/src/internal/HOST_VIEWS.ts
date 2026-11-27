import type { HostViews } from "./HostViews.ts";

/** Members of the stream classes and the like that only move bytes they were given. */
const STREAMS = ["ReadableStream", "WritableStream", "TransformStream", "ByteLengthQueuingStrategy"];
/** Members of `node:crypto` that hash, sign, derive or encrypt bytes they are given, or give random values. */
const CRYPTO = [
  ...["createHash", "createHmac", "hash", "Hash", "Hmac", "getHashes", "getCiphers", "getCurves", "getCipherInfo"],
  ...["timingSafeEqual", "constants", "webcrypto", "subtle", "getRandomValues", "randomBytes", "randomFill"],
  ...["randomFillSync", "randomInt", "randomUUID", "createCipheriv", "createDecipheriv", "Cipheriv", "Decipheriv"],
  ...["createSign", "createVerify", "Sign", "Verify", "sign", "verify", "createPublicKey", "createPrivateKey"],
  ...["createSecretKey", "KeyObject", "generateKey", "generateKeySync", "generateKeyPair", "generateKeyPairSync"],
  ...["generatePrime", "generatePrimeSync", "checkPrime", "checkPrimeSync", "pbkdf2", "pbkdf2Sync", "scrypt"],
  ...["scryptSync", "hkdf", "hkdfSync", "argon2", "argon2Sync", "publicEncrypt", "publicDecrypt", "privateEncrypt"],
  ...["privateDecrypt", "createDiffieHellman", "createDiffieHellmanGroup", "getDiffieHellman", "DiffieHellman"],
  ...["DiffieHellmanGroup", "createECDH", "ECDH", "diffieHellman", "X509Certificate", "Certificate"],
];
/** Members of `node:util` that format, compare, convert or wrap values they are given. */
const UTIL = [
  ...["format", "formatWithOptions", "inspect", "isDeepStrictEqual", "promisify", "callbackify", "inherits", "types"],
  ...["TextEncoder", "TextDecoder", "toUSVString", "stripVTControlCharacters", "parseEnv", "getSystemErrorName"],
  ...["getSystemErrorMap", "getSystemErrorMessage", "MIMEType", "MIMEParams", "aborted", "getCallSite"],
  ...["getCallSites", "transferableAbortController", "transferableAbortSignal", "isArray", "_extend", "diff"],
];
/** `node:util`, whose warnings and debug logs write nowhere, as the evaluation's `console`. */
const UTIL_VIEW = {
  pure: UTIL,
  view: { deprecate: "deprecate", debuglog: "debuglog", debug: "debuglog", log: "noop" },
};

/**
 * The allowlist of a build-time evaluation's host views (k.compiler Build-time evaluation), default deny: a member or
 * built-in listed here is pure (no host state), observed (each call or read recorded as a probe) or the bundle's own
 * view (`OBSERVE_BANNER`); every other member of a view, and every Node built-in not listed, is refused (E1050), so a
 * member Node adds is refused until it is listed here. The clock (`Date`, `performance`) and random values are pure:
 * app code reads neither (E1601). `os` and `process` facts that move on their own (`cpus`, `loadavg`, `uptime`,
 * `freemem`, `hrtime`, `memoryUsage`, `resourceUsage`, `pid`, `ppid`) are refused, since a probe whose answer always
 * moves is a cache that never hits.
 */
export const HOST_VIEWS: HostViews = {
  globals: {
    pure: [
      ...["Object", "Array", "Number", "Boolean", "String", "Symbol", "BigInt", "Math", "JSON", "Reflect", "Proxy"],
      ...["Promise", "Map", "Set", "WeakMap", "WeakSet", "WeakRef", "FinalizationRegistry", "Iterator", "Date"],
      ...["RegExp", "Intl", "ArrayBuffer", "SharedArrayBuffer", "DataView", "Atomics", "Uint8Array", "Int8Array"],
      ...["Uint16Array", "Int16Array", "Uint32Array", "Int32Array", "BigUint64Array", "BigInt64Array"],
      ...["Uint8ClampedArray", "Float16Array", "Float32Array", "Float64Array", "Error", "AggregateError"],
      ...["EvalError", "RangeError", "ReferenceError", "SyntaxError", "TypeError", "URIError", "SuppressedError"],
      ...["DisposableStack", "AsyncDisposableStack", "NaN", "Infinity", "undefined", "isNaN", "isFinite"],
      ...["parseInt", "parseFloat", "encodeURI", "encodeURIComponent", "decodeURI", "decodeURIComponent"],
      ...["escape", "unescape", "Buffer", "URL", "URLSearchParams", "URLPattern", "TextEncoder", "TextDecoder"],
      ...["TextEncoderStream", "TextDecoderStream", "AbortController", "AbortSignal", "Event", "EventTarget"],
      ...["CustomEvent", "DOMException", "Blob", "File", "FormData", "Headers", "Request", "Response", ...STREAMS],
      ...["ReadableStreamDefaultReader", "ReadableStreamBYOBReader", "ReadableStreamBYOBRequest"],
      ...["ReadableByteStreamController", "ReadableStreamDefaultController", "TransformStreamDefaultController"],
      ...["WritableStreamDefaultWriter", "WritableStreamDefaultController", "CountQueuingStrategy"],
      ...["CompressionStream", "DecompressionStream", "atob", "btoa", "structuredClone", "queueMicrotask"],
      ...["setTimeout", "clearTimeout", "setInterval", "clearInterval", "setImmediate", "clearImmediate", "crypto"],
      ...["Crypto", "CryptoKey", "SubtleCrypto", "performance", "Performance", "PerformanceEntry", "PerformanceMark"],
      ...["PerformanceMeasure", "PerformanceObserverEntryList", "PerformanceResourceTiming", "MessageChannel"],
      ...["MessagePort", "MessageEvent", "CloseEvent", "Navigator"],
    ],
    view: {
      process: "process",
      console: "console",
      navigator: "navigator",
      WebAssembly: "wasm",
      global: "self",
      globalThis: "self",
    },
  },
  process: {
    fact: [
      ...["argv", "argv0", "execArgv", "execPath", "title", "version", "versions", "platform", "arch", "release"],
      ...["config", "features", "debugPort", "noDeprecation", "throwDeprecation", "traceDeprecation", "cwd"],
      ...["umask", "getuid", "geteuid", "getgid", "getegid", "getgroups"],
    ],
    pure: ["nextTick"],
    view: {
      env: "env",
      stdout: "sink",
      stderr: "sink",
      getBuiltinModule: "builtin",
      mainModule: "refused",
      ...{ on: "chain", once: "chain", addListener: "chain", prependListener: "chain", prependOnceListener: "chain" },
      ...{ off: "chain", removeListener: "chain", removeAllListeners: "chain", setMaxListeners: "chain" },
      ...{ emitWarning: "noop", emit: "false", listenerCount: "zero", getMaxListeners: "ten" },
      ...{ listeners: "none", rawListeners: "none", eventNames: "none" },
    },
  },
  navigator: { fact: ["hardwareConcurrency", "language", "languages", "platform", "userAgent"] },
  stats: {
    view: {
      ...{ isFile: "bound", isDirectory: "bound", isSymbolicLink: "bound", isBlockDevice: "bound" },
      ...{ isCharacterDevice: "bound", isFIFO: "bound", isSocket: "bound" },
      ...{ size: "kind", mode: "kind", mtimeMs: "mtimeNs", mtime: "mtimeNs", mtimeNs: "mtimeNs", ctimeMs: "ctimeNs" },
      ...{ ctime: "ctimeNs", ctimeNs: "ctimeNs", birthtimeMs: "birthtimeNs", birthtime: "birthtimeNs" },
      ...{ birthtimeNs: "birthtimeNs", ino: "ino", dev: "dev", nlink: "nlink", uid: "uid", gid: "gid", rdev: "rdev" },
      ...{ blksize: "blksize", blocks: "blocks" },
    },
  },
  fileHandle: {
    pure: ["fd"],
    view: {
      ...{ read: "bound", readv: "bound", readFile: "bound", readLines: "bound", createReadStream: "bound" },
      ...{ readableWebStream: "bound", close: "bound", stat: "fstat" },
    },
  },
  webAssembly: {
    pure: [
      "Module",
      "Memory",
      "Table",
      "Global",
      "Tag",
      "Exception",
      "CompileError",
      "LinkError",
      "RuntimeError",
      "compile",
      "validate",
    ],
    view: { instantiate: "instantiate", Instance: "instance" },
  },
  builtins: {
    ...{ assert: "pure", "assert/strict": "pure", buffer: "pure", constants: "pure", events: "pure", path: "pure" },
    ...{ "path/posix": "pure", "path/win32": "pure", punycode: "pure", querystring: "pure", stream: "pure" },
    ...{ "stream/consumers": "pure", "stream/promises": "pure", "stream/web": "pure", string_decoder: "pure" },
    ...{ timers: "pure", "timers/promises": "pure", url: "pure", "util/types": "pure", zlib: "pure" },
    console: "console",
    util: UTIL_VIEW,
    sys: UTIL_VIEW,
    crypto: { pure: CRYPTO },
    async_hooks: { pure: ["AsyncLocalStorage", "AsyncResource"] },
    perf_hooks: {
      pure: ["performance", "constants", "PerformanceEntry", "PerformanceMark", "PerformanceMeasure"],
    },
    os: {
      pure: ["EOL", "devNull", "constants"],
      call: [
        ...["homedir", "hostname", "platform", "arch", "type", "release", "version", "machine", "endianness"],
        ...["tmpdir", "userInfo", "availableParallelism", "totalmem"],
      ],
    },
    tty: { call: ["isatty"] },
    module: { pure: ["builtinModules", "isBuiltin"], view: { createRequire: "require" } },
    process: "process",
    fs: {
      pure: ["Stats", "Dirent", "Dir", "constants", "F_OK", "R_OK", "W_OK", "X_OK"],
      view: {
        ...{ readFileSync: "read", readFile: "read", openAsBlob: "read", openSync: "open", open: "open" },
        ...{ createReadStream: "stream", readSync: "fd", read: "fd", readvSync: "fd", readv: "fd" },
        ...{ fstatSync: "fstat", fstat: "fstat", closeSync: "fd", close: "fd", existsSync: "exists" },
        ...{ exists: "exists", statSync: "stat", stat: "stat", lstatSync: "lstat", lstat: "lstat" },
        ...{ accessSync: "access", access: "access", realpathSync: "realpath", realpath: "realpath" },
        ...{ readlinkSync: "realpath", readlink: "realpath", readdirSync: "list", readdir: "list" },
        ...{ opendirSync: "list", opendir: "list", promises: "promises" },
      },
    },
    "fs/promises": {
      pure: ["constants"],
      view: {
        ...{ readFile: "read", open: "handle", stat: "stat", lstat: "lstat", access: "access" },
        ...{ realpath: "realpath", readlink: "realpath", readdir: "list", opendir: "list" },
      },
    },
  },
};
