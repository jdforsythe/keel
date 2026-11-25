import { module } from "@keel/compiler";

/** The `@keel/std-tables` library manifest (std.tables, k.library): a module that renders a data table or its search lists the package in `deps`. */
export default module({
  id: "tables",
  deps: ["@keel/std-i18n"],
  capabilities: ["clock"],
  public: {
    exports: [
      "applyQuery",
      "ColumnKind",
      "ColumnSpec",
      "Columns",
      "columns",
      "DataTable",
      "DataTableProps",
      "Field",
      "TablePage",
      "TableQuery",
      "tablePage",
      "TableSearch",
      "tableSearch",
      "TableStyles",
      "TableText",
    ],
  },
});
