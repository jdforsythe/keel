import { unsafe } from "./unsafe.js";
/** Restore the capability type of a stored accessor. */
export function narrowAccessor(stored) {
    return unsafe("registry stores accessors type-erased; same name and identical impls object imply the same T", () => {
        return stored;
    });
}
