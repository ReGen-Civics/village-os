/**
 * ROLE PREREQUISITES, THE READS (shared/rolePrerequisites.ts holds the rules).
 *
 * Read only: a prerequisite never writes a purchase or a claim. A purchase
 * counts while it is `paid` (a claw-back sets `reversed`, server/lib/payments.ts),
 * and a quest once its claim is `consented`.
 */
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import type { PrerequisiteHoldings } from "../../shared/rolePrerequisites";

type Q = Pool | PoolConnection;

export async function holdingsOf(db: Q, userId: string, productIds: readonly string[], questIds: readonly string[]): Promise<PrerequisiteHoldings> {
  const paidProducts = new Set<string>();
  const consentedQuests = new Set<string>();
  if (productIds.length) {
    const [rows] = await db.query<RowDataPacket[]>(
      "SELECT DISTINCT product_id FROM product_purchases WHERE user_id = ? AND status = 'paid' AND product_id IN (?)",
      [userId, productIds],
    );
    for (const r of rows) paidProducts.add(String(r.product_id));
  }
  if (questIds.length) {
    const [rows] = await db.query<RowDataPacket[]>(
      "SELECT DISTINCT quest_id FROM quest_claims WHERE user_id = ? AND status = 'consented' AND quest_id IN (?)",
      [userId, questIds],
    );
    for (const r of rows) consentedQuests.add(String(r.quest_id));
  }
  return { paidProducts, consentedQuests };
}

/** What a role's path shows of each item: a product's name and price, a quest's title and what it asks. */
export async function itemDetails(db: Q, productIds: readonly string[], questIds: readonly string[]): Promise<{
  products: Map<string, { name: string; amountMinor: number | null }>;
  quests: Map<string, { title: string; description: string | null }>;
}> {
  const products = new Map<string, { name: string; amountMinor: number | null }>();
  const quests = new Map<string, { title: string; description: string | null }>();
  if (productIds.length) {
    const [rows] = await db.query<RowDataPacket[]>("SELECT id, name, amount_minor FROM payment_products WHERE id IN (?)", [productIds]);
    for (const r of rows) products.set(String(r.id), { name: String(r.name), amountMinor: r.amount_minor == null ? null : Number(r.amount_minor) });
  }
  if (questIds.length) {
    const [rows] = await db.query<RowDataPacket[]>("SELECT id, title, description FROM quests WHERE id IN (?)", [questIds]);
    for (const r of rows) quests.set(String(r.id), { title: String(r.title), description: r.description == null ? null : String(r.description).slice(0, 300) });
  }
  return { products, quests };
}

/** The village's own names for the products and quests a role asks for. A missing one has no name. */
export async function itemNames(db: Q, productIds: readonly string[], questIds: readonly string[]): Promise<{ products: Map<string, string>; quests: Map<string, string> }> {
  const products = new Map<string, string>();
  const quests = new Map<string, string>();
  if (productIds.length) {
    const [rows] = await db.query<RowDataPacket[]>("SELECT id, name FROM payment_products WHERE id IN (?)", [productIds]);
    for (const r of rows) products.set(String(r.id), String(r.name));
  }
  if (questIds.length) {
    const [rows] = await db.query<RowDataPacket[]>("SELECT id, title FROM quests WHERE id IN (?)", [questIds]);
    for (const r of rows) quests.set(String(r.id), String(r.title));
  }
  return { products, quests };
}
