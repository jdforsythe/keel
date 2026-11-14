import type { Schema } from "@keel/schema";
import { Outside } from "./Outside.ts";
import type { Ty } from "./Ty.ts";
import { num } from "./num.ts";

type Node = Schema<unknown>["node"];
/** The integer range every `s.int` value and result is assumed within (k.prove Sorts). */
const SAFE = "9007199254740991";
const and = (xs: readonly string[]): string => {
  const ys = xs.filter((x) => x !== "true");
  return ys.length === 0 ? "true" : ys.length === 1 ? (ys[0] ?? "true") : `(and ${ys.join(" ")})`;
};

/**
 * The SMT declarations of one obligation's sorts, made on first use and named in that order (`S0`, `S1`, ...), and
 * the string constants: every string literal and enum value is a distinct `Str` constant (`L0`, `L1`, ...).
 */
export function sortTable() {
  const decls: string[] = [];
  const named = new Map<string, string>();
  const lits = new Map<string, string>();
  let fresh = 0;
  const smt = (t: Ty): string => {
    switch (t.k) {
      case "bool":
        return "Bool";
      case "str":
        return "Str";
      case "int":
        return "Int";
      case "real":
        return "Real";
      default:
        return t.s;
    }
  };
  const make = (key: string, decl: (s: string) => string): string => {
    const hit = named.get(key);
    if (hit !== undefined) return hit;
    const s = `S${named.size}`;
    named.set(key, s);
    decls.push(decl(s));
    return s;
  };
  const lit = (value: string): string => {
    let name = lits.get(value);
    if (name === undefined) {
      name = `L${lits.size}`;
      lits.set(value, name);
    }
    return name;
  };
  const obj = (f: readonly (readonly [string, Ty])[]): Ty => {
    const key = `o(${f.map(([k, t]) => `${JSON.stringify(k)}:${smt(t)}`).join(",")})`;
    const s = make(
      key,
      (s) => `(declare-datatypes ((${s} 0)) (((${s}${f.map(([, t], i) => ` (${s}.${i} ${smt(t)})`).join("")}))))`,
    );
    return { k: "obj", s, f };
  };
  const opt = (v: Ty, nul: boolean): Ty => {
    const s = make(
      `${nul ? "n" : "u"}(${smt(v)})`,
      (s) => `(declare-datatypes ((${s} 0)) (((${s}.none) (${s}.some (${s}.v ${smt(v)})))))`,
    );
    return { k: "opt", s, v, nul };
  };
  const coll = (k: "arr" | "rec", v: Ty): Ty => {
    const [dom, len] = k === "arr" ? ["Int", "Int"] : ["Str", "(Array Str Bool)"];
    const s = make(
      `${k}(${smt(v)})`,
      (s) =>
        `(declare-datatypes ((${s} 0)) (((${s} (${s}.n ${len}) (${s}.a (Array ${dom} ${smt(v)}))))))(declare-const ${s}.d ${smt(v)})`,
    );
    return { k, s, v };
  };
  const ofNode = (node: Node, path: string): Ty => {
    switch (node.kind) {
      case "string":
      case "id":
        return { k: "str" };
      case "enum":
        for (const v of node.values) lit(v);
        return { k: "str", one: node.values };
      case "literal":
        if (typeof node.value === "string") lit(node.value);
        return typeof node.value === "string"
          ? { k: "str", one: [node.value] }
          : typeof node.value === "boolean"
            ? { k: "bool", one: node.value }
            : { k: Number.isInteger(node.value) ? "int" : "real", min: node.value, max: node.value };
      case "boolean":
        return { k: "bool" };
      case "int":
      case "number":
        return {
          k: node.kind === "int" ? "int" : "real",
          ...(node.min === undefined ? {} : { min: node.min }),
          ...(node.max === undefined ? {} : { max: node.max }),
        };
      case "object":
        return obj(Object.entries(node.fields).map(([k, n]) => [k, ofNode(n, `${path}.${k}`)]));
      case "array":
        return coll("arr", ofNode(node.item, `${path}[]`));
      case "record":
        return coll("rec", ofNode(node.value, `${path}[]`));
      case "optional":
      case "nullable":
        return opt(ofNode(node.inner, path), node.kind === "nullable");
      default:
        throw new Outside(`no sort for ${node.kind} at ${path}`, undefined);
    }
  };
  /** That `e` parses with `t`: bounds (and ±(2^53 − 1) for an integer when `safe`), enum values, each item. */
  const wf = (t: Ty, e: string, safe: boolean): string => {
    switch (t.k) {
      case "bool":
        return t.one === undefined ? "true" : t.one ? e : `(not ${e})`;
      case "int":
      case "real":
        return and([
          t.min === undefined ? "true" : `(<= ${num(t.min)} ${e})`,
          t.max === undefined ? "true" : `(<= ${e} ${num(t.max)})`,
          safe && t.k === "int" ? `(<= (- ${SAFE}) ${e} ${SAFE})` : "true",
        ]);
      case "str":
        return t.one === undefined ? "true" : `(or false ${t.one.map((v) => `(= ${e} ${lit(v)})`).join(" ")})`;
      case "obj":
        return and(t.f.map(([, ft], i) => wf(ft, `(${t.s}.${i} ${e})`, safe)));
      case "opt": {
        const inner = wf(t.v, `(${t.s}.v ${e})`, safe);
        return inner === "true" ? "true" : `(or ((_ is ${t.s}.none) ${e}) ${inner})`;
      }
      default: {
        const i = `w${fresh++}`;
        const item = wf(t.v, `(select (${t.s}.a ${e}) ${i})`, safe);
        if (t.k === "rec")
          return item === "true" ? "true" : `(forall ((${i} Str)) (=> (select (${t.s}.n ${e}) ${i}) ${item}))`;
        const range = `(forall ((${i} Int)) (=> (and (<= 0 ${i}) (< ${i} (${t.s}.n ${e}))) ${item}))`;
        return and([`(<= 0 (${t.s}.n ${e}))`, item === "true" ? "true" : range]);
      }
    }
  };
  /** The lengths of the arrays reachable from `e` through records only, for the bounded search. */
  const lengths = (t: Ty, e: string): string[] =>
    t.k === "arr"
      ? [`(${t.s}.n ${e})`]
      : t.k === "obj"
        ? t.f.flatMap(([, ft], i) => lengths(ft, `(${t.s}.${i} ${e})`))
        : [];
  /** Every declaration so far: `Str`, the string constants (distinct), the datatypes. */
  const prelude = (): string => {
    const names = [...lits.values()];
    return `(declare-sort Str 0)${names.map((n) => `(declare-const ${n} Str)`).join("")}${
      names.length > 1 ? `(assert (distinct ${names.join(" ")}))` : ""
    }${decls.join("")}`;
  };
  return { smt, lit, lits, obj, opt, coll, ofNode, wf, lengths, prelude, and };
}
