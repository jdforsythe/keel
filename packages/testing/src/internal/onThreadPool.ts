/** Node's resource types for a request run on libuv's thread pool that the `*REQUEST` rule does not name: file and DNS requests. */
const POOL_TYPES = new Set([
  "FSREQCALLBACK",
  "FSREQPROMISE",
  "FILEHANDLECLOSEREQ",
  "GETADDRINFOREQWRAP",
  "GETNAMEINFOREQWRAP",
]);
/** `*REQUEST` types that are not on the thread pool: an outgoing HTTP request is a socket's. */
const NOT_POOL = new Set(["HTTPCLIENTREQUEST"]);

/**
 * Whether a pending resource of Node type `type` is a thread-pool request (k.drive-law Order): a crypto or WebCrypto
 * job (`*REQUEST`), a file or DNS request. A zlib handle is not one: an open stream would hold back every hold.
 */
export const onThreadPool = (type: string): boolean =>
  POOL_TYPES.has(type) || (type.endsWith("REQUEST") && !NOT_POOL.has(type));
