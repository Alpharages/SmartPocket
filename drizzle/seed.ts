import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { categories, creditCards, transactions, users } from "./schema";

const DATABASE_URL = process.env.DATABASE_URL;
const DEV_OPEN_ID = "dev_local_user";

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is required to seed the database");
}

const SCHEMA = { categories, creditCards, transactions, users };
type Db = MySql2Database<typeof SCHEMA>;

function escapeIdentifier(identifier: string): string {
  return `\`${identifier.replace(/`/g, "``")}\``;
}

async function ensureDatabaseExists() {
  const url = new URL(DATABASE_URL!);
  const databaseName = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
  if (!databaseName) {
    throw new Error("DATABASE_URL must include a database name");
  }

  url.pathname = "";
  const connection = await mysql.createConnection(url.toString());
  try {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS ${escapeIdentifier(
        databaseName,
      )} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
  } finally {
    await connection.end();
  }
}

async function ensureUser(db: Db): Promise<number> {
  await db
    .insert(users)
    .values({
      openId: DEV_OPEN_ID,
      name: "Dev User",
      email: "dev@localhost",
      loginMethod: "dev",
      lastSignedIn: new Date(),
    })
    .onDuplicateKeyUpdate({
      set: {
        name: "Dev User",
        email: "dev@localhost",
        loginMethod: "dev",
        lastSignedIn: new Date(),
      },
    });

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.openId, DEV_OPEN_ID))
    .limit(1);

  if (!user) {
    throw new Error("Failed to seed dev user");
  }

  return user.id;
}

async function ensureCategory(
  db: Db,
  userId: number,
  name: string,
  type: "income" | "expense",
  color: string,
  icon: string,
): Promise<number> {
  const [existing] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(
        eq(categories.userId, userId),
        eq(categories.name, name),
        eq(categories.type, type),
      ),
    )
    .limit(1);

  if (existing) return existing.id;

  const [result] = await db.insert(categories).values({
    userId,
    name,
    type,
    color,
    icon,
    isDefault: true,
  });

  return result.insertId;
}

async function ensureCreditCard(db: Db, userId: number): Promise<number> {
  const [existing] = await db
    .select({ id: creditCards.id })
    .from(creditCards)
    .where(and(eq(creditCards.userId, userId), eq(creditCards.name, "Everyday Visa")))
    .limit(1);

  if (existing) return existing.id;

  const [result] = await db.insert(creditCards).values({
    userId,
    name: "Everyday Visa",
    cardNumber: "4111111111111234",
    cardholderName: "Dev User",
    expiryMonth: 8,
    expiryYear: 2028,
    creditLimit: "5000.00",
    currentBalance: "0.00",
    color: "#6366F1",
    cardType: "credit",
    isActive: true,
  });

  return result.insertId;
}

async function ensureTransaction(
  db: Db,
  userId: number,
  categoryId: number,
  type: "income" | "expense",
  amount: string,
  description: string,
  daysAgo: number,
): Promise<void> {
  const [existing] = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.categoryId, categoryId),
        eq(transactions.type, type),
        eq(transactions.amount, amount),
        eq(transactions.description, description),
      ),
    )
    .limit(1);

  if (existing) return;

  const date = new Date();
  date.setDate(date.getDate() - daysAgo);

  await db.insert(transactions).values({
    userId,
    categoryId,
    creditCardId: null,
    type,
    amount,
    description,
    date,
  });
}

async function main() {
  await ensureDatabaseExists();

  const pool = mysql.createPool(DATABASE_URL!);
  const db = drizzle(pool, {
    mode: "default",
    schema: SCHEMA,
  });

  try {
    const userId = await ensureUser(db);
    const groceries = await ensureCategory(db, userId, "Groceries", "expense", "#10B981", "cart");
    const dining = await ensureCategory(
      db,
      userId,
      "Dining",
      "expense",
      "#F59E0B",
      "restaurant",
    );
    await ensureCategory(db, userId, "Transport", "expense", "#06B6D4", "car");
    const salary = await ensureCategory(db, userId, "Salary", "income", "#6366F1", "cash");

    await ensureCreditCard(db, userId);
    await ensureTransaction(db, userId, salary, "income", "3200.00", "Monthly salary", 5);
    await ensureTransaction(db, userId, groceries, "expense", "84.50", "Weekly groceries", 3);
    await ensureTransaction(db, userId, dining, "expense", "42.00", "Dinner out", 2);
    await ensureTransaction(db, userId, groceries, "expense", "23.75", "Snacks", 1);

    console.log(`Seeded database for ${DEV_OPEN_ID} (userId=${userId})`);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ER_NO_SUCH_TABLE"
    ) {
      throw new Error("Database tables are missing. Run `pnpm db:push` before `pnpm db:seed`.");
    }
    throw error;
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
