/**
 * What a defect carries besides its message (k.defects): `data`, the values that explain it, and `cause`, the failure
 * that led to it (a `Result`'s error or a thrown value).
 */
export type DefectDetail = { readonly data?: Readonly<Record<string, unknown>>; readonly cause?: unknown };
