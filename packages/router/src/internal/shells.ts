import type { Ctx } from "@keel/ctx";

/**
 * Per ctx of a shell (k.return Mount requests): what takes a navigation the router has no page for. It answers true
 * when the URL is under an identity mount and it sent a mount request; false leaves the URL to the document.
 */
export const shells = new WeakMap<Ctx, (url: string) => boolean>();
