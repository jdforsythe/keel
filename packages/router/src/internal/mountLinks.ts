/**
 * The full path of every declared mount link (k.mount Declaration `links`): an identity mount's `path` plus one of its
 * `links`. A shell sends a return link to exactly one of these as a mount request GET with no opening (k.links).
 */
export const mountLinks = new Set<string>();
