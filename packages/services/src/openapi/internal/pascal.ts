/** `orders` -> `Orders`, `order-items` -> `OrderItems`: the module id as a type-style name. */
export function pascal(id: string): string {
  return id
    .split(/[^A-Za-z0-9]+/)
    .filter((p) => p !== "")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join("");
}
