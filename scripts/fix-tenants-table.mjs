import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const envContent = readFileSync(".env", "utf8");
const env = {};
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const idx = trimmed.indexOf("=");
  if (idx < 0) continue;
  const key = trimmed.slice(0, idx).trim();
  let value = trimmed.slice(idx + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  env[key] = value;
}

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  // 1. Drop the trigger
  console.log("Dropping trigger...");
  const { error: dropErr } = await admin.rpc("exec_sql", {
    sql: `drop trigger if exists tenants_touch on public.tenants;`
  });
  if (dropErr) console.log("Drop trigger (may not exist):", dropErr.message);

  // 2. Add the column
  console.log("Adding updated_at column...");
  const { error: alterErr } = await admin.rpc("exec_sql", {
    sql: `alter table public.tenants add column if not exists updated_at timestamptz not null default now();`
  });
  if (alterErr) console.error("Alter error:", alterErr);
  else console.log("Column added");

  // 3. Update existing rows
  console.log("Updating existing rows...");
  const { error: updateErr } = await admin.rpc("exec_sql", {
    sql: `update public.tenants set updated_at = created_at where updated_at is null;`
  });
  if (updateErr) console.error("Update error:", updateErr);
  else console.log("Rows updated");

  // 4. Recreate the trigger
  console.log("Recreating trigger...");
  const { error: triggerErr } = await admin.rpc("exec_sql", {
    sql: `create trigger tenants_touch before update on public.tenants for each row execute procedure public.touch_updated_at();`
  });
  if (triggerErr) console.error("Trigger error:", triggerErr);
  else console.log("Trigger recreated");
}

run();