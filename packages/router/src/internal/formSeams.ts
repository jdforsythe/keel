import type { FormSeam } from "./FormSeam.ts";

/** The handle seam of each `<Form form>` the browser posts: a shell's mount request ends its `pending()` (k.return). */
export const formSeams = new WeakMap<Element, FormSeam>();
