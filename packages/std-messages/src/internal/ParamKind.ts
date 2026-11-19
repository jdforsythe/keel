/** What a message param holds, as a template sees it: text, a number, or one of an enum's values. */
export type ParamKind = "string" | "number" | readonly string[];
