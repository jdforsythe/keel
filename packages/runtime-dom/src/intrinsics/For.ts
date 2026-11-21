import { anchored } from "../internal/anchored.ts";
import { list } from "../ops/list.ts";

/**
 * `<For each={xs} key="id">{(item, index) => ...}</For>` (k.component). Compiler intrinsic: compiled code
 * calls the `list` op with live accessors, so a row whose key stays keeps its nodes. Called as a function (hand-built
 * trees), `each` is a getter (`get each() { return xs.get(); }`) and the row receives plain values: rows are keyed
 * by item object, the first per `key`, so a new object for a kept key renders that row anew, an unchanged or moved
 * object keeps its row (and its `index` argument is the index when it rendered).
 */
export function For<T extends object>(props: {
  readonly each: readonly T[];
  readonly key: keyof T & string;
  readonly children: (item: T, index: number) => Node;
  /** Standard slot: rendered while `each` is empty (k.ui). */
  readonly empty?: () => Node;
}): Node {
  const key = props.key;
  const keyOf = (item: T): unknown => Reflect.get(item, key);
  const indexOf = new Map<unknown, number>();
  const each = (): readonly T[] => {
    indexOf.clear();
    const firsts: T[] = [];
    props.each.forEach((x, i) => {
      const k = keyOf(x);
      if (indexOf.has(k)) return;
      indexOf.set(k, i);
      firsts.push(x);
    });
    return firsts;
  };
  return anchored((a) =>
    list(
      a,
      each,
      (item) => item,
      (item) => {
        const value = item();
        return props.children(value, indexOf.get(keyOf(value)) ?? 0);
      },
      props.empty,
    ),
  );
}
