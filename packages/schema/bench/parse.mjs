// Parse cost (k.schema Plain data): a 5-field object, 1,000 of them in an array, and the 5-field object under a schema
// with a `secret` node (the seal path). Not part of `pnpm test`; run `node bench/parse.mjs` from packages/schema on a
// quiet machine (the 1-minute load is printed beside the numbers). Each figure is the median of 5 timed runs.
import { loadavg } from "node:os";
import { s } from "../src/index.ts";

const Item = s.object({ id: s.string(), name: s.string(), n: s.int(), ok: s.boolean(), tags: s.array(s.string()) });
const List = s.array(Item);
const Sealed = s.object({ id: s.string(), name: s.string(), n: s.int(), ok: s.boolean(), pin: s.secret(s.string()) });
const one = () => ({ id: "a1", name: "Ada", n: 3, ok: true, tags: ["x", "y"] });
const sealed = () => ({ id: "a1", name: "Ada", n: 3, ok: true, pin: "1234" });
const list = Array.from({ length: 1000 }, one);

const time = (f, n) => {
  for (let i = 0; i < n / 10; i++) f();
  const runs = [];
  for (let r = 0; r < 5; r++) {
    const t = process.hrtime.bigint();
    for (let i = 0; i < n; i++) f();
    runs.push(Number(process.hrtime.bigint() - t) / n / 1000);
  }
  return runs.sort((a, b) => a - b)[2];
};
const must = (r) => {
  if (!r.ok) throw new Error("bench value does not parse");
};
const object5 = time(() => must(Item.parse(one())), 200000);
const array1000 = time(() => must(List.parse(list)), 500);
const sealed5 = time(() => must(Sealed.parse(sealed())), 100000);
const us = (x) => `${x.toFixed(2)}us`;
console.log(
  `ok bench-parse object5 ${us(object5)}, array1000 ${us(array1000)}, sealed5 ${us(sealed5)} (load ${loadavg()[0].toFixed(1)})`,
);
