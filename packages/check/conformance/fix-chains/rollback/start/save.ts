type Db = { query(sql: string): Promise<void> };
export async function save(db: Db, work: (db: Db) => Promise<void>): Promise<void> {
  try {
    await db.query("begin");
    await work(db);
    await db.query("commit");
  } catch (e) {
    await db.query("rollback");
    throw e;
  }
}
