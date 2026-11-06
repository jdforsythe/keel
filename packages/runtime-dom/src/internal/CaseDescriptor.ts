/** A case descriptor: its tag and renderer, read back by `Match` (never rendered itself). */
export type CaseDescriptor = { readonly tag: string; readonly render: (value: () => unknown) => Node };
