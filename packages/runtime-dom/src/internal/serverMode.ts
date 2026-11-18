/**
 * Whether the runtime renders a served document (k.resume Regions): `@keel/server` sets `on` around each route
 * level's render. Every structural op then writes its content in a region `<!--[-->` … `<!--]-->` before its
 * anchor, and so does every slot other than a component slot `<!--+-->`.
 */
export const serverMode: { on: boolean } = { on: false };
