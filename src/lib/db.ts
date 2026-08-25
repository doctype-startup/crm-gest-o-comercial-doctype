import DatabaseDriver from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { Kysely, PostgresDialect, SqliteDialect, sql } from "kysely";
import { Pool } from "pg";
import type { Database } from "./types";

type GlobalDb = typeof globalThis & {
  __doctypeDb?: Kysely<Database>;
  __doctypeSchemaReady?: Promise<void>;
};

const globalDb = globalThis as GlobalDb;

function databaseEngine() {
  const url = process.env.DATABASE_URL || "sqlite:./.data/doctype-os.db";
  return process.env.DATABASE_ENGINE || (url.startsWith("postgres") ? "postgres" : "sqlite");
}

function createDatabase() {
  const url = process.env.DATABASE_URL || "sqlite:./.data/doctype-os.db";
  const engine = databaseEngine();

  if (process.env.NODE_ENV === "production" && engine === "sqlite" && process.env.ALLOW_SQLITE_IN_PRODUCTION !== "true") {
    throw new Error("Produção exige DATABASE_ENGINE=postgres e DATABASE_URL PostgreSQL.");
  }

  if (engine === "postgres") {
    const parsed = new URL(url);
    const isSupabasePooler = /\.pooler\.supabase\.com$/i.test(parsed.hostname);
    const sslRequired = parsed.searchParams.get("sslmode") === "require" || parsed.searchParams.get("sslmode") === "verify-full" || parsed.searchParams.get("sslmode") === "verify-ca";
    const rejectUnauthorized = isSupabasePooler
      ? false
      : process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false";

    return new Kysely<Database>({
      dialect: new PostgresDialect({
        pool: new Pool({
          host: parsed.hostname,
          port: parsed.port ? Number(parsed.port) : 5432,
          user: decodeURIComponent(parsed.username),
          password: decodeURIComponent(parsed.password),
          database: decodeURIComponent(parsed.pathname.replace(/^\//, "") || "postgres"),
          max: 10,
          ssl: sslRequired || isSupabasePooler ? { rejectUnauthorized } : undefined,
        }),
      }),
    });
  }

  const filename = url.replace(/^sqlite:/, "");
  mkdirSync(dirname(resolve(filename)), { recursive: true });
  return new Kysely<Database>({
    dialect: new SqliteDialect({ database: new DatabaseDriver(filename) }),
  });
}

export const db = globalDb.__doctypeDb ?? createDatabase();
if (process.env.NODE_ENV !== "production") globalDb.__doctypeDb = db;

async function createSchema() {
  await db.schema
    .createTable("organizations")
    .ifNotExists()
    .addColumn("id", "varchar(36)", (c) => c.primaryKey())
    .addColumn("name", "varchar(200)", (c) => c.notNull())
    .addColumn("created_at", "varchar(40)", (c) => c.notNull())
    .execute();

  await db.schema
    .createTable("users")
    .ifNotExists()
    .addColumn("id", "varchar(36)", (c) => c.primaryKey())
    .addColumn("org_id", "varchar(36)", (c) => c.notNull().references("organizations.id").onDelete("cascade"))
    .addColumn("name", "varchar(200)", (c) => c.notNull())
    .addColumn("email", "varchar(200)", (c) => c.notNull().unique())
    .addColumn("password_hash", "text", (c) => c.notNull())
    .addColumn("role", "varchar(30)", (c) => c.notNull())
    .addColumn("active", "integer", (c) => c.notNull().defaultTo(1))
    .addColumn("must_change_password", "integer", (c) => c.notNull().defaultTo(1))
    .addColumn("created_at", "varchar(40)", (c) => c.notNull())
    .addColumn("updated_at", "varchar(40)", (c) => c.notNull())
    .execute();

  await db.schema
    .createTable("saas_accounts")
    .ifNotExists()
    .addColumn("org_id", "varchar(36)", (c) => c.primaryKey().references("organizations.id").onDelete("cascade"))
    .addColumn("slug", "varchar(100)", (c) => c.notNull().unique())
    .addColumn("logo_data_url", "text", (c) => c.notNull().defaultTo(""))
    .addColumn("plan", "varchar(30)", (c) => c.notNull().defaultTo("Start"))
    .addColumn("status", "varchar(30)", (c) => c.notNull().defaultTo("Teste"))
    .addColumn("max_users", "integer", (c) => c.notNull().defaultTo(3))
    .addColumn("renewal_date", "varchar(40)", (c) => c.notNull().defaultTo(""))
    .addColumn("notes", "text", (c) => c.notNull().defaultTo(""))
    .addColumn("created_at", "varchar(40)", (c) => c.notNull())
    .addColumn("updated_at", "varchar(40)", (c) => c.notNull())
    .execute();

  await db.schema
    .createTable("platform_admins")
    .ifNotExists()
    .addColumn("user_id", "varchar(36)", (c) => c.primaryKey().references("users.id").onDelete("cascade"))
    .addColumn("created_at", "varchar(40)", (c) => c.notNull())
    .execute();

  await db.schema
    .createTable("saas_billing")
    .ifNotExists()
    .addColumn("org_id", "varchar(36)", (c) => c.primaryKey().references("organizations.id").onDelete("cascade"))
    .addColumn("monthly_price", "decimal", (c) => c.notNull().defaultTo(0))
    .addColumn("billing_cycle", "varchar(20)", (c) => c.notNull().defaultTo("Mensal"))
    .addColumn("billing_day", "integer", (c) => c.notNull().defaultTo(10))
    .addColumn("billing_email", "varchar(200)", (c) => c.notNull().defaultTo(""))
    .addColumn("payment_method", "varchar(30)", (c) => c.notNull().defaultTo("Pix"))
    .addColumn("payment_status", "varchar(30)", (c) => c.notNull().defaultTo("Pendente"))
    .addColumn("next_charge_date", "varchar(40)", (c) => c.notNull().defaultTo(""))
    .addColumn("grace_until", "varchar(40)", (c) => c.notNull().defaultTo(""))
    .addColumn("external_customer_id", "varchar(200)", (c) => c.notNull().defaultTo(""))
    .addColumn("external_subscription_id", "varchar(200)", (c) => c.notNull().defaultTo(""))
    .addColumn("updated_at", "varchar(40)", (c) => c.notNull())
    .execute();

  await db.schema
    .createTable("stripe_events")
    .ifNotExists()
    .addColumn("id", "varchar(255)", (c) => c.primaryKey())
    .addColumn("org_id", "varchar(36)", (c) => c.notNull())
    .addColumn("type", "varchar(100)", (c) => c.notNull())
    .addColumn("event_created", "integer", (c) => c.notNull())
    .addColumn("processed_at", "varchar(40)", (c) => c.notNull())
    .execute();

  await db.schema
    .createIndex("stripe_events_org_created")
    .ifNotExists()
    .on("stripe_events")
    .columns(["org_id", "event_created"])
    .execute();

  await db.schema
    .createTable("sessions")
    .ifNotExists()
    .addColumn("id", "varchar(36)", (c) => c.primaryKey())
    .addColumn("user_id", "varchar(36)", (c) => c.notNull().references("users.id").onDelete("cascade"))
    .addColumn("token_hash", "varchar(64)", (c) => c.notNull().unique())
    .addColumn("expires_at", "varchar(40)", (c) => c.notNull())
    .addColumn("created_at", "varchar(40)", (c) => c.notNull())
    .execute();

  await db.schema
    .createTable("records")
    .ifNotExists()
    .addColumn("id", "varchar(36)", (c) => c.primaryKey())
    .addColumn("org_id", "varchar(36)", (c) => c.notNull().references("organizations.id").onDelete("cascade"))
    .addColumn("module", "varchar(30)", (c) => c.notNull())
    .addColumn("data", "text", (c) => c.notNull())
    .addColumn("created_by", "varchar(36)", (c) => c.notNull().references("users.id"))
    .addColumn("created_at", "varchar(40)", (c) => c.notNull())
    .addColumn("updated_at", "varchar(40)", (c) => c.notNull())
    .execute();

  await db.schema
    .createIndex("records_org_module")
    .ifNotExists()
    .on("records")
    .columns(["org_id", "module"])
    .execute();

  if (databaseEngine() === "postgres") {
    await sql`
      create table if not exists audit_logs (
        id bigserial primary key,
        org_id varchar(36) not null,
        user_id varchar(36) not null,
        action varchar(60) not null,
        entity varchar(60) not null,
        entity_id varchar(36),
        metadata text not null,
        created_at varchar(40) not null
      )
    `.execute(db);
  } else {
    await db.schema
      .createTable("audit_logs")
      .ifNotExists()
      .addColumn("id", "integer", (c) => c.primaryKey().autoIncrement())
      .addColumn("org_id", "varchar(36)", (c) => c.notNull())
      .addColumn("user_id", "varchar(36)", (c) => c.notNull())
      .addColumn("action", "varchar(60)", (c) => c.notNull())
      .addColumn("entity", "varchar(60)", (c) => c.notNull())
      .addColumn("entity_id", "varchar(36)")
      .addColumn("metadata", "text", (c) => c.notNull())
      .addColumn("created_at", "varchar(40)", (c) => c.notNull())
      .execute();
  }

  await db.schema
    .createTable("settings")
    .ifNotExists()
    .addColumn("org_id", "varchar(36)", (c) => c.notNull())
    .addColumn("key", "varchar(100)", (c) => c.notNull())
    .addColumn("value", "text", (c) => c.notNull())
    .addColumn("updated_at", "varchar(40)", (c) => c.notNull())
    .addPrimaryKeyConstraint("settings_pk", ["org_id", "key"])
    .execute();

  const hasPlatformAdmin = await db.selectFrom("platform_admins").select("user_id").limit(1).executeTakeFirst();
  if (!hasPlatformAdmin) {
    const candidate = await db
      .selectFrom("users as u")
      .innerJoin("organizations as o", "o.id", "u.org_id")
      .select("u.id")
      .where("u.role", "=", "CEO_ADMIN")
      .where("o.name", "=", "DOCTYPE")
      .orderBy("u.created_at")
      .executeTakeFirst();
    if (candidate) {
      await db.insertInto("platform_admins").values({ user_id: candidate.id, created_at: new Date().toISOString() }).onConflict((conflict) => conflict.column("user_id").doNothing()).execute();
    }
  }

  await sql`delete from sessions where expires_at < ${new Date().toISOString()}`.execute(db);
}

export async function ensureSchema() {
  globalDb.__doctypeSchemaReady ??= createSchema();
  await globalDb.__doctypeSchemaReady;
}

export async function audit(orgId: string, userId: string, action: string, entity: string, entityId: string | null, metadata: unknown = {}) {
  await db.insertInto("audit_logs").values({
    org_id: orgId,
    user_id: userId,
    action,
    entity,
    entity_id: entityId,
    metadata: JSON.stringify(metadata),
    created_at: new Date().toISOString(),
  }).execute();
}
