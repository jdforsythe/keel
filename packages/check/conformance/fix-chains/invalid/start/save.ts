export function save(input: { name: string }): string {
  if (input.name === "") throw new Error("name required");
  return input.name;
}
