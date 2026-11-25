/**
 * How reach follows a specifier (k.boundary Following): the project file (a root-relative path) `specifier`, its query
 * stripped, names from the file `from`, or undefined when it names none (a package's file, or no file).
 */
export type Resolve = (from: string, specifier: string) => string | undefined;
