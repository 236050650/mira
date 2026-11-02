import { loadConfig } from "../config.js";
import { createDb, runMigrations } from "./client.js";
import { seedPersonas } from "./seed-lib.js";

async function main() {
  const config = loadConfig();
  const handle = await createDb(config);
  try {
    await runMigrations(handle);
    const count = await seedPersonas(handle.db);
    console.log(`Seeded ${count} personas`);
  } finally {
    await handle.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
