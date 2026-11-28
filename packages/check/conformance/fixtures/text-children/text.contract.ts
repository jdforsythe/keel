import { contract } from "@keel/router/contract";

/** The contract whose `href` the fixture's component prints as text. */
export const text = contract("text", { "text.show": { path: "/text" } });
