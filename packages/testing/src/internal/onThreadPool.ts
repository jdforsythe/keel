/** Node's resource types for a request run on libuv's thread pool: crypto and WebCrypto jobs, file and DNS requests, zlib. */
const POOL_TYPES = new Set(["FSREQCALLBACK", "FSREQPROMISE", "GETADDRINFOREQWRAP", "GETNAMEINFOREQWRAP", "ZLIB"]);

/** Whether a pending resource of Node type `type` is a thread-pool request (k.drive-law Order). */
export const onThreadPool = (type: string): boolean => POOL_TYPES.has(type) || type.endsWith("REQUEST");
