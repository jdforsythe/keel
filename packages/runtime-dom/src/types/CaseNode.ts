/** What `Case` returns: one variant's renderer, consumed by `Match`. */
export interface CaseNode<U> {
  readonly tag: string;
  readonly render: (value: () => U) => Node;
}
