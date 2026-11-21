/**
 * A server-only file's name (k.boundary, k.bundle Names): `*.server.*` or `*.guard.*`, any extension or none (a
 * specifier may leave it out), matched case-insensitively against the name on disk. Whether the file is server-only
 * also depends on its module's placement.
 */
export const SERVER_ONLY_NAME = /\.(?:server|guard)(?:\.[^/.]+)*$/i;
