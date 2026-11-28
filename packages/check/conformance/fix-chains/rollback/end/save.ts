type Db = { query(sql: string): Promise<void> };
export async function save(db: Db, work: (db: Db) => Promise<void>): Promise<void> {
  let done = false;
  try {
    await db.query("begin");
    await work(db);
    await db.query("commit");
    done = true;
  } finally {
    if (!done) {
      await db.query("rollback");
    }
  }
}
