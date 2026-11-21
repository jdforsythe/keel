/**
 * Whether the runtime renders a served document (k.resume Regions): `@keel/server` sets `on` around each route
 * level's render. Every structural op then writes its content in a region `<!--[-->` … `<!--]-->` before its
 * anchor, and so does every slot other than a component slot `<!--+-->`. `nothing` is set when a text binding of that
 * render renders nothing (E1406, k.place); the server clears and reads it.
 */
export const serverMode: { on: boolean; nothing: boolean } = { on: false, nothing: false };
