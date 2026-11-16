import { db } from "@/db";
import { sql } from "drizzle-orm";

let ready = false;

/**
 * Jedyne, czego baza potrzebuje poza schematem Drizzle: klucz obcy odpowiedzi na komentarze
 * (poza typami, bo samoodwołanie zapętla wnioskowanie TypeScript).
 * Ta funkcja NIE tworzy żadnych danych – aplikacja startuje całkowicie pusta.
 */
export async function ensureDbSetup() {
  if (ready) return;
  try {
    const found = await db.execute(sql`SELECT 1 FROM pg_constraint WHERE conname = 'comments_parent_id_fkey'`);
    const rows = (found as unknown as { rows?: unknown[] }).rows ?? [];
    if (rows.length === 0) {
      await db.execute(
        sql`ALTER TABLE comments ADD CONSTRAINT comments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE`
      );
    }
    ready = true;
  } catch (e) {
    console.warn("[db-setup]", e);
  }
}
