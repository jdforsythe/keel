// Spec: k.realm, clause "`keel review` reports one R1019 for `Reflect.ownKeys(o)`, `Object.getOwnPropertySymbols(o)` and `Object.getOwnPropertyDescriptors(o)` each with `o` a parameter in `modules/m/a.ts`, and none for `Reflect.ownKeys({ a: 1 })` or `Object.getOwnPropertySymbols([])`."
// Seed 1337 (no generated input: the forms are source text). Each case writes one repository and reads one review, as review-r1018-r1020.test.ts does.
import { testTime } from "@keel/tooling/test-time";
import { expect, test } from "vitest";
import { PROJECT, lineOf, ofCode, range, review, withRepo } from "./review-support.ts";

const hits = (source: string) =>
  withRepo([PROJECT, { "modules/m/a.ts": source }], (repo) =>
    ofCode(review(repo, [range(repo, 0, 1), "--list"]), "R1019"),
  );

for (const call of ["Reflect.ownKeys(o)", "Object.getOwnPropertySymbols(o)", "Object.getOwnPropertyDescriptors(o)"]) {
  test(
    `\`keel review\` reports one R1019 for \`${call}\` with \`o\` a parameter in \`modules/m/a.ts\``,
    () => {
      const source = `export const k = (o: object) => ${call};\n`;
      const h = hits(source);
      expect(h).toHaveLength(1);
      expect(h[0]?.path).toBe("modules/m/a.ts");
      expect(h[0]?.line).toBe(lineOf(source, call));
    },
    testTime(120_000),
  );
}

for (const call of ["Reflect.ownKeys({ a: 1 })", "Object.getOwnPropertySymbols([])"]) {
  test(
    `\`keel review\` reports no R1019 for \`${call}\``,
    () => {
      expect(hits(`export const k = ${call};\n`)).toEqual([]);
    },
    testTime(120_000),
  );
}
