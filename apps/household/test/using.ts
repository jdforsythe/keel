import { scope } from "@keel/reactive";

/**
 * Makes the stores of a server factory in a scope of their own, hands them to `use`, and disposes the scope when `use`
 * ends, so the next test may make the same store ids again (a server store factory needs a scope, E1203).
 */
export async function using<T, R>(make: () => T, use: (stores: T) => R | Promise<R>): Promise<R> {
  const own = scope(() => undefined);
  try {
    return await use(own.run(make));
  } finally {
    own.dispose();
  }
}
