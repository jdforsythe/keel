/**
 * The stdlib packages whose `std` config is client-readable (`clientStd`, rfc:0069), each with the top-level config
 * keys a browser may read (`undefined`: every key; rfc:0070); every other package stays on the server.
 */
export const clientStdPackages: Map<string, readonly string[] | undefined> = new Map();
