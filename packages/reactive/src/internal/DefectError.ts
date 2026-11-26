/** The class of the defects the engine raises (E1203, E1208); `name` on its prototype reads `Defect`, as `@keel/schema`'s. */
export class DefectError extends Error {}
Object.defineProperty(DefectError.prototype, "name", { value: "Defect", writable: true, configurable: true });
