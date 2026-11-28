/** The class of what `defect` throws; `name` lives on its prototype, so a stack and `String(e)` read `Defect: ...`. */
export class DefectError extends Error {}
Object.defineProperty(DefectError.prototype, "name", { value: "Defect", writable: true, configurable: true });
