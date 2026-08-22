import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, schema } from "../db";
import { decryptSecret, encryptSecret } from "../lib/crypto";

/**
 * Re-encrypts every stored Plaid access token under a new MASTER_KEY.
 * Run with the app and worker stopped — this is not safe to run
 * concurrently with a process that's actively encrypting/decrypting tokens
 * under the old key, since a partially-rotated table has some rows under
 * each key and nothing here tracks which is which.
 *
 * Usage:
 *   OLD_MASTER_KEY=<current MASTER_KEY> NEW_MASTER_KEY=<output of `openssl rand -base64 32`> npm run rotate:master-key
 *
 * After it reports success, set MASTER_KEY=<NEW_MASTER_KEY> in your env and
 * restart the app and worker. Keep OLD_MASTER_KEY around until you've
 * confirmed a real sync works post-rotation — if it doesn't, you still have
 * the un-rotated backup this script makes no changes without first reading.
 */
async function main() {
  const oldKey = process.env.OLD_MASTER_KEY;
  const newKey = process.env.NEW_MASTER_KEY;
  if (!oldKey || !newKey) {
    console.error("Set both OLD_MASTER_KEY and NEW_MASTER_KEY in the environment before running this script.");
    process.exit(1);
  }
  if (oldKey === newKey) {
    console.error("OLD_MASTER_KEY and NEW_MASTER_KEY must be different.");
    process.exit(1);
  }

  const items = await db
    .select({ id: schema.plaidItems.id, ciphertext: schema.plaidItems.accessTokenCiphertext, iv: schema.plaidItems.accessTokenIv, tag: schema.plaidItems.accessTokenTag })
    .from(schema.plaidItems);

  console.log(`Rotating ${items.length} item(s)...`);

  let rotated = 0;
  for (const item of items) {
    const plaintext = decryptSecret({ ciphertext: item.ciphertext, iv: item.iv, tag: item.tag }, oldKey);
    const reEncrypted = encryptSecret(plaintext, newKey);
    await db
      .update(schema.plaidItems)
      .set({
        accessTokenCiphertext: reEncrypted.ciphertext,
        accessTokenIv: reEncrypted.iv,
        accessTokenTag: reEncrypted.tag,
      })
      .where(eq(schema.plaidItems.id, item.id));
    rotated++;
  }

  console.log(`Done — ${rotated} item(s) re-encrypted under the new key.`);
  console.log("Set MASTER_KEY to NEW_MASTER_KEY's value and restart the app and worker.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Rotation failed partway through — some rows may already be under the new key. Do not run again until you've verified state.", err);
  process.exit(1);
});
