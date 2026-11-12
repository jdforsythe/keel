/**
 * Codes `check()` reports outside the rule registry (k.check pipeline; rfc:0065): parse and types (typeCheck,
 * mapTsDiagnostic), compiler diagnostics passed through, project passes, and the rule runner. Codes another
 * command produces (build, cli, dev and runtime, scaffold, harness) are not here.
 */
export const PIPELINE_CODES: readonly string[] = [
  ...["E1000", "E1001", "E1003", "E1453", "E1501", "E1751", "E1802"],
  ...["E1002", "E1004", "E1401", "E1402", "E1403", "E1404", "E1405", "W1005"],
  ...["E1005", "E1151", "E1152", "E1153", "E1154", "E1155", "E1156", "E1157", "E1158"],
  ...["E1454", "E1508", "E1509", "E1510", "E1511", "E1561", "E1562", "E1566", "E1753", "E1755", "E1756"],
];
