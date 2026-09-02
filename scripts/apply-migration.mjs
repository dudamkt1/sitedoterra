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

// Use the PostgREST API directly to run SQL
const url = `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_sql`;
const headers = {
  "apikey": env.SUPABASE_SERVICE_ROLE_KEY,
  "Authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
  "Prefer": "return=minimal",
};

async function run() {
  const sql = `
    alter table public.tenants add column if not exists updated_at timestamptz not null default now();
    update public.tenants set updated_at = created_at where updated_at is null;
  `;
  
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ sql }),
  });
  
  if (!response.ok) {
    const text = await response.text();
    console.error("Error:", response.status, text);
  } else {
    console.log("Migration applied successfully");
  }
}

run();