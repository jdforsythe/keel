import type { Register } from "../types/Register.ts";
import type { DefaultTokens } from "./DefaultTokens.ts";

/** The app's registered tokens, else the k.ui example set. */
export type AppTokens = Register extends { readonly tokens: infer T } ? T : DefaultTokens;
