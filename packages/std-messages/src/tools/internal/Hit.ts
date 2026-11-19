import type { Edit } from "@keel/check";

/** A rule hit before it becomes a `Finding`: file offset, one-line message, optional edit. */
export type Hit = { readonly at: number; readonly msg: string; readonly edit?: Edit };
