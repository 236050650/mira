import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { migrate as migratePostgres } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { AppConfig } from "../config.js";
import * as schema from "./schema.js";

export type Db = ReturnType<typeof drizzlePostgres<typeof schema>> | ReturnType<typeof drizzlePglite<typeof schema>>;

export type DbHandle = {
  db: Db;
  close: () => Promise<void>;
  kind: "postgres" | "pglite";
};

const here = dirname(fileURLToPath(import.meta.url));
export const migrationsFolder = resolve(here, "../../drizzle");

export async function createDb(config: AppConfig): Promise<DbHandle> {
  if (!config.usePglite && config.databaseUrl) {
    const client = postgres(config.databaseUrl, { max: 10 });
    const db = drizzlePostgres(client, { schema });
    return {
      db,
      kind: "postgres",
      close: async () => {
        await client.end({ timeout: 5 });
      },
    };
  }

  // Persist to disk so tsx watch / API restarts keep users & refresh tokens.
  // Tests can set PGLITE_DATA_DIR=memory for an ephemeral DB.
  const configuredDir = process.env.PGLITE_DATA_DIR?.trim();
  const client =
    configuredDir === "memory"
      ? new PGlite({ extensions: { vector } })
      : new PGlite({
          dataDir: configuredDir || resolve(here, "../../.pglite-data"),
          extensions: { vector },
        });
  const db = drizzlePglite(client, { schema });
  return {
    db,
    kind: "pglite",
    close: async () => {
      await client.close();
    },
  };
}

export async function runMigrations(handle: DbHandle) {
  if (handle.kind === "pglite") {
    await migratePglite(handle.db as ReturnType<typeof drizzlePglite>, {
      migrationsFolder,
    });
  } else {
    await migratePostgres(handle.db as ReturnType<typeof drizzlePostgres>, {
      migrationsFolder,
    });
  }
}
