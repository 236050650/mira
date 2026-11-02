import { loadConfig } from "../config.js";
import { createDb, runMigrations } from "./client.js";

async function main() {
  const config = loadConfig();
  const handle = await createDb(config);
  try {
    await runMigrations(handle);
    console.log(`Migrations applied (${handle.kind})`);
  } finally {
    await handle.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
