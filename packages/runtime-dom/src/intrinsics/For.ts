import { anchored } from "../internal/anchored.ts";
import { list } from "../ops/list.ts";

/**
 * `<For each={xs} key="id">{(item, index) => ...}</For>` (k.component). Compiler intrinsic: compiled code
 * calls the `list` op with live accessors. At runtime (hand-built trees) a row re-renders when its item
 * object changes; a move keeps the row (and its `index` argument is the index when it rendered).
 */
export function For<T extends object>(props: {
  readonly each: readonly T[];
  readonly key: keyof T & string;
  readonly children: (item: T, index: number) => Node;
}): Node {
  const key = props.key;
  const keyOf = (item: T): unknown => Reflect.get(item, key);
  const indexOf = new Map<unknown, number>();
  const each = (): readonly T[] => {
    const xs = props.each;
    indexOf.clear();
    xs.forEach((x, i) => {
      if (!indexOf.has(keyOf(x))) indexOf.set(keyOf(x), i);
    });
    return xs;
  };
  return anchored((a) =>
    list(a, each, keyOf, (item) => {
      const value = item();
      return props.children(value, indexOf.get(keyOf(value)) ?? 0);
    }),
  );
}
