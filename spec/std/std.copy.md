# std.copy: Literal copy
status: conformance-covered
In a module whose `deps` list `@keel/std-messages`, text a person reads comes from a message set (std.messages). E2406 reports text written as a literal instead: a value with a letter (`\p{L}`), at the literal, with no fix.

**Files.** Every app `*.tsx` file of the module, with or without `export default` and whatever its name, and its `routes.ts` (the route `title` only). Calls (below) are read in every app file of the module except the set's locale files. Tests and `.keel/` are not read; a file under `unsafe/` is read whole, its `unsafe(` calls included (k.check App code).

**Places.** A JSX text child; a JSX child expression; a JSX attribute `label`, `alt`, `placeholder`, `title`, `aria-label`, `aria-description`, `aria-placeholder`, `aria-roledescription`, `aria-valuetext` or `children`; the same names as properties of an object literal passed to a call whose callee is an identifier starting with an uppercase letter (`Text({ children: 'Recipes' })`, `Input({ placeholder: 'Search' })`); and what a route `title` returns, from any `return` of its function or a same-file function it names.

**Shapes.** After parentheses, `as` and `satisfies`, a value in a place is copy when it is:
- a string literal, or a template without substitutions, with a letter;
- a template with substitutions whose text parts hold a letter (`` `${n} recipes` ``);
- a `+` whose operands include such a literal or template (`'Hello, ' + name`);
- either branch of `?:`, either side of `||` or `??`, the right of `&&`;
- the body of a thunk, `() => value`;
- a name bound to a `const` whose initializer is copy, in the same file or imported from a project file, reported at the use.

**Not followed.** Calls (`fmt('Recipes')`), object members (`copy.title`), `let`, destructuring, imports from installed packages, attributes and properties not listed (`id`, `name`, `type`, `href`, `value`), lowercase callees and member callees (`s.enum`, `Set.text`), and a value with no letter (`'%'`, `'42'`, `` `${a}${b}` ``).

**Conformance.**
- In a module listing `@keel/std-messages`, each one E2406 at the literal: `<Input placeholder="Search" />`, `<Box aria-label="Close" />`, `title="Info"`, each of `aria-description`, `aria-placeholder`, `aria-roledescription` and `aria-valuetext` with a word; `<Text children="Recipes" />`; `Text({ children: 'Recipes' })` in a `.ts` file of the module; `` <h1>{`${n} recipes`}</h1> ``; `{'Hello, ' + name}`; `label={ok ? 'On' : 'Off'}` (two); `placeholder={() => 'Search'}`; `const t = 'Recipes'` then `<h1>{t}</h1>`; a `const` exported from `copy.ts` and imported into the component; `RecipeRow.tsx` exporting `function RecipeRow` and no default; a route `title` returning `'Recipes: ' + name`, a template with a word, or calling a same-file function that returns `'Recipes'`.
- None: `id="recipes.list"`, `type="number"`, `href="/a"`, `{props.data.text.title}`, `` {`${a}${b}`} ``, `{'%'}`, `{n + 1}`, `copy.title`, `fmt('Recipes')`, `s.enum(['a'])`, `Set.text({ title: 'Rezepte' })` in a locale file, `let t = 'x'`, a `const` from an installed package, each reporting case in a test file, and in a module whose `deps` do not list `@keel/std-messages`.
- In a module listing `@keel/std-messages`, `<Input placeholder="Search" />` in `modules/m/unsafe/Field.tsx` is one E2406 at the file's top level and one inside the arrow function given to `unsafe('r', () => ...)`.
