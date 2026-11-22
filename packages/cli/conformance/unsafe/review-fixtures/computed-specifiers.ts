// Fixture text for keel review conformance: copied into a temp git repository, never imported or run.
export {};
declare const name: string;
declare const a: string;
declare const b: string;
declare const require: (id: string) => unknown;
void import(name);
void require(a + b);
void import(["vi", "test"].join(""));
