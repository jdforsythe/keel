import type { storeClasses } from "../storeClasses.ts";

/** What a site's state schemas hold (k.leave E1107): the classes, or the first part not read and every such part. */
export type SiteRead = ReturnType<typeof storeClasses>;
