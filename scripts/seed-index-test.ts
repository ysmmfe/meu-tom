// Somente CI/E2E: não faz parte do seed normal e não imita músicas conhecidas.
import { seedIndexFixture } from "../tests/helpers/index-fixture";
import { sql } from "../db/client";
try {
  await seedIndexFixture("e2e-offline-fixture");
  console.log("8 índices autorais de teste CC0 criados.");
} finally {
  await sql.end();
}
