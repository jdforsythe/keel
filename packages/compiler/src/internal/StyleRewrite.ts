/** A base element whose static style props become one `class` attribute: attributes to drop (by start) and the class. */
export type StyleRewrite = { readonly drop: ReadonlySet<number>; readonly className: string };
