/** Distinct names kept per ctx; the ctx outlives requests, so an unbounded name set would grow without limit. */
export const MAX_NAMES = 256;
