/** The file system a scan reads: a file's text (undefined when there is none) and a folder's file names. */
export interface ModuleFiles {
  readonly read: (file: string) => string | undefined;
  readonly list: (dir: string) => readonly string[];
}
