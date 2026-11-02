import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadConfig } from "../config.js";
import { createDb, runMigrations } from "./client.js";
import { importCulturalPersonas } from "./import-cultural-lib.js";

const config = loadConfig();
const handle = await createDb(config);
try {
  await runMigrations(handle);
  const result = await importCulturalPersonas(handle.db);
  const output = resolve(import.meta.dirname, "../../../../reports/cultural-persona-import.json");
  await mkdir(resolve(output, ".."), { recursive: true });
  await writeFile(output, JSON.stringify({ importedAt: new Date().toISOString(), database: handle.kind, ...result }, null, 2) + "\n");
  console.log(JSON.stringify({ ...result, items: `${result.items.length} identities; mapping saved to ${output}` }, null, 2));
} finally { await handle.close(); }
