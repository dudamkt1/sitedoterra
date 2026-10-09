# Auditoria de Segurança — Isolamento Multi-Tenant e Integridade do Ciclo de Vida

**Data:** 06/10/2026
**Escopo:** plataforma `SITE-DOTERRA` (Next.js 14.2.35 + Supabase + Cloudflare R2)
**Objetivo:** verificar isolamento entre tenants, exposição de endpoints/atributos e o ciclo
**ativo → desativado → reativo** com evidências reais (queries, logs, antes/depois).

---

## 1. Resumo executivo

| # | Vulnerabilidade | Gravidade | Arquivo | Status |
| --- | --- | --- | --- | --- |
| V1 | `POST /api/test-login` entrega sessão **superadmin** a qualquer visitante anônimo (gate documentado `ENABLE_TEST_ACCOUNTS` **não existe no código**) | **CRÍTICO** | `app/api/test-login/route.ts:28-68`, `components/auth/LoginForm.tsx:377` | Reproduzido ao vivo |
| V2 | `GET/POST/PUT/DELETE /api/admin/support-materials*` **sem autenticação** (leitura + criação + deleção anônimas) | **CRÍTICO** | `app/api/admin/support-materials/route.ts:6-51`, `app/api/admin/support-materials/[id]/route.ts` | Reproduzido ao vivo |
| V3 | Policy `platform_config_select_all … using (true)` deixa **token da API do Vercel** legível por qualquer anônimo | **CRÍTICO** | `supabase/migrations/0041_platform_official_home.sql` (policy `platform_config_select_all`), consumo em `lib/vercel.ts:61` | Token `vcp_***` validado ao vivo (chamada Vercel 200) |
| V4 | `/api/public/catalog/[slug]` é **cacheado indefinidamente**: após desativar o tenant o catálogo continua público e mudanças de produto/preço nunca aparecem | **ALTO** | `app/api/public/catalog/[slug]/route.ts` (GET sem `dynamic`/uso de `request`) | Reproduzido ao vivo (3 formas) |
| V5 | Rotas admin `/api/admin/notifications` e `/api/admin/feedback/count` não verificam papel (hoje retornam só dados do `auth.uid()` chamador) | **BAIXO** | `app/api/admin/notifications/route.ts`, `app/api/admin/feedback/count/route.ts` | Evidência coletada |
| V6 | Slug suspenso na plataforma devolve **404 estilizado** em vez da página de site indisponível | **BAIXO (funcional)** | `app/not-found.tsx` (xargs: rota pública de plataforma) | Evidência coletada |
| V7 | Rotas pré-renderizadas no `build` ficam congeladas (`/api/gateway`, `/api/ai/providers`, `/api/affiliate/public-config`, `/api/demo/official-site-seed`) | **INFO** | `.next/prerender-manifest.json` | Evidência coletada |

**O que passou (não há vazamento):** isolamento de dados entre tenants via RLS (66 tabelas testadas),
queries explícitas com `tenant_id` de outro tenant, escritas cross-tenant, RPCs perigosas,
todas as rotas do `/painel` testadas, páginas `/admin` e `/painel` com guarda server-side,
ciclo desativar/reativar sem deleção de dados, domínio customizado honrando `site_status`.

---

## 2. Metodologia e ambiente

- **Evidências gravadas** em `%TEMP%\opencode\` (`http-phase1*.out.txt`, `http-phase2.out.txt`,
  `http-phase3.out.txt`, `cross-cache.json`, `api-anon-sweep.json`, `rls-write-probe.json`, `inventory.json`).
- **3 tenants de teste criados** (`audit-test-a|b|c`) para não tocar em tenants reais (~15 no banco).
- Sessões forjadas no formato `@supabase/ssr` (`sb-<ref>-auth-token=base64-<session>`) e cookies de teste
  via `signInWithPassword`; requisições ao servidor local em `http://localhost:3000` (build de produção,
  `npm start`).
- RLS validado empiricamente (PostgREST com tokens `anon` e autenticado) — não há CLI `supabase` nem RPC
  de SQL arbitrário no ambiente.
- **Limitação:** credenciais `R2_*` estão vazias no `.env` → testes de objetos no bucket não foram
  possíveis; a análise de objects foi feita por código (`lib/media.ts`, prefixo `usuarios/{tenantId}/…`)
  e pela tabela `media_files`.

---

## 3. Inventário de dados multi-tenant (item 1)

- **66 tabelas** expostas via PostgREST (OpenAPI), **26 RPCs**.
- Escopo por tabela (`inventory.json`, `isolation-db.json`): `tenant_id` (dominante), `user_id`, `global`.
- **RLS:** 65/66 tabelas com `enable row level security` nas migrations.
  Única exceção: **`consultoras_dados`** (tabela legada, **sem nenhuma referência no código** → INFO).
- O isolamento **real** das rotas do painel depende de `.eq('tenant_id', …)` porque as rotas usam
  `createAdminClient()` (service_role = **bypass total de RLS**).

---

## 4. Isolamento de dados (item 2) — PASS

| Teste | Resultado | Evidência |
| --- | --- | --- |
| Usuário A lê 66 tabelas | **PASS** — 0 linhas de B/C | `inventory`/`isolation-db` |
| Query explícita `tenant_id=eq.<B\|C>` com sessão de A | **PASS** — 0 linhas | log da fase DB |
| INSERT/UPDATE/DELETE cross-tenant (incl. `tenants.site_status`, `platform_config`) | **PASS** — bloqueado (`new row violates row-level security`) | `rls-write-probe.json` |
| RPCs perigosas (`set_platform_config`, `exec_migration_*`, `create_tenant`, `is_superadmin`, …) para anon e autenticado | **PASS** — 404 (não expostas) | log da fase DB |
| 22 rotas `GET /api/*` do painel (A vs B) | **PASS** — sem vazamento cruzado | `http-phase1.out.txt` |
| Cache cruzado (mesma URL, 2 usuários) | **PASS** — corpos diferentes em `/api/me`, `/api/subscription/status`, `/api/crm/stats`, `/api/media`, `/api/affiliate/status|clicks` | `cross-cache.json` |
| `/api/affiliate/summary` reflete dados do usuário | **PASS** — A=3 cliques, B=1 após inserção seletiva | teste ao vivo |

---

## 5. Ciclo ativo → desativado → reativo (item 3)

Operação real usada: `PATCH /api/admin/users/{id}` com `{action:"suspend"}` / `{action:"unsuspend"}`.

| Verificação | Resultado | Evidência |
| --- | --- | --- |
| Desativação **não apaga dados** (snapshot completo de 9 tabelas antes/depois) | **PASS** — 0 deleções; só `tenants.site_status/suspended_at`, `profiles.status/suspended_at` + 1 `audit_logs` | `diff-S0-S1.json`, `http-phase2.json` |
| Reativação restaura estado idêntico (byte a byte) | **PASS** — `site_settings`, `pwa_settings`, `crm_*`, `tenant_sections`, `domains`, `media_files`, `subscriptions`, `affiliate_*` idênticos | `diff-S0-S2.json` |
| 4 operações concorrentes durante a troca de estado | **PASS** — nenhum 5xx | `http-phase2.json` |
| Página pública do tenant após reativação volta | **PASS (com atraso)** — volta após o TTL do cache negativo (60s) | `http-phase2.json` |
| Domínio customizado (`audit-test-a.example.com`) honra `site_status` | **PASS** — ativo → conteúdo do tenant; suspenso → `/site-indisponivel` sem dados do tenant | `http-phase3.json` |
| `/api/raffle/public` honra `site_status` | **PASS** — 404 após suspender | `http-phase3.json` |
| **`/api/public/catalog/[slug]` honra `site_status`** | **FAIL** — 200 com produtos mesmo 65s após suspender | `http-phase3.json` → **V4** |
| **Catálogo reflete mudança de preço** | **FAIL** — banco `54321` → endpoint ainda `10000` | teste ao vivo → **V4** |
| **Catálogo devolve 404 para tenant ativo que ainda não foi consultado** | **FAIL** — `audit-test-b` ativo, RPC retorna tenant, endpoint 404 (cache frio de antes da ativação) | teste ao vivo → **V4** |
| Slug suspenso na plataforma | **INFO** — 404 estilizado em vez de `/site-indisponivel` | `http-phase3.json` → **V6** |

**Diagnóstico de V4:** a rota `GET` usa apenas `{ params }`, não lê `request`, não chama `headers()`/`cookies()`
e não declara `dynamic`/`revalidate` → o App Router armazena a resposta no **Full Route Cache** sem TTL.
As páginas públicas usam a RPC `get_public_tenant_by_slug` (filtra `site_status='active'`), mas a rota de
catálogo só executa a RPC na 1ª consulta de cada URL, até o próximo `build`.

---

## 6. Exposição de endpoints (item 4)

Varredura anônima de **146** rotas `GET /api/*` → 15 responderam sem autenticação
(`api-anon-sweep.json`). Classificação:

- **Públicas por design:** `/api/slug/check`, `/api/raffle/public`, `/api/affiliate/public-config`,
  `/api/gateway` (publishable keys), `/api/me`, `/api/subscription/status`, `/api/catalogo/*`,
  `/api/webhooks/*`.
- **Abertas indevidamente:** `test-login` (**V1**), `admin/support-materials*` (**V2**),
  `admin/notifications`, `admin/feedback/count` (**V5**), `demo/start` (cookie demo HMAC, não toca Supabase → INFO).
- Nenhuma rota aberta devolveu dados de um tenant (marcador `audit-test-a` ausente em todas).
- Rotas `admin/support-materials` devolvem materiais reais da plataforma (ex.: “Arquivos”, com URL pública
  do R2) — conteúdo interno exposto.

---

## 7. Acesso de administradores (item 5)

| Verificação | Resultado | Evidência |
| --- | --- | --- |
| `/admin`, `/admin/users`, `/admin/support-materials`, `/painel`, `/painel/clients` anônimo | **PASS** — 307 → `/login?next=…` | teste ao vivo |
| `app/admin/layout.tsx:7-14` (server-side `getDashboardContext` + `role === "superadmin"`) | **PASS** | código + teste |
| Rotas `admin/apply-migration-0041/0042/0043` (POST) anônimo | **PASS** — 403 “Acesso restrito ao super admin” | teste ao vivo |
| `admin/support-materials` (POST/PUT/DELETE) anônimo | **FAIL** — 201 / 500 de coerência / 200 (nunca 401/403) | teste ao vivo → **V2** |
| `POST /api/test-login` anônimo | **FAIL** — 200 + cookie de sessão; com ele `GET /api/admin/notifications` → **6 notificações reais** | teste ao vivo → **V1** |
| Botão “Acesso rápido” no `/login` | **FAIL** — renderizado sem checagem de env (`LoginForm.tsx:377`) | código |

---

## 8. Resumo RLS e autenticação (item 6)

- **RLS:** ativo em 65/66 tabelas (`consultoras_dados` sem RLS e sem uso no código → INFO).
  Políticas testadas bloqueiam leitura e escrita cross-tenant mesmo com sessão válida.
- **Camadas de autenticação:** `middleware.ts` (só `/painel` e `/admin`, **não cobre `/api/**`**) →
  layouts server-side (`app/admin/layout.tsx`, `app/painel/layout.tsx`) → guarda por rota
  (`getProfile`/`requireTenant`/`getCurrentUser`) → RLS.
- **Falha de padrão:** algumas rotas admin usam `createAdminClient()` e **não implementam** a guarda de rota
  (V2, V5); o gate `ENABLE_TEST_ACCOUNTS` documentado em `docs/TEST-ACCOUNTS.md:44,89` **não existe em
  nenhum arquivo de código** (só em `.env.example` e na documentação).

---

## 9. Vulnerabilidades detalhadas (item 7)

### V1 — Escalada de privilégio global (CRÍTICO)
- **Onde:** `app/api/test-login/route.ts:32-68`; botão `components/auth/LoginForm.tsx:377`.
- **Prova:** `POST /api/test-login` (anônimo) → `200 {"success":true}` + `set-cookie sb-*-auth-token`;
  com esse cookie, `GET /api/admin/notifications` → `200` com **6 itens reais**.
- **Causa:** a rota só exige que `TEST_USER_EMAIL`/`TEST_USER_PASSWORD` existam e tenham ≥6 caracteres.
  Não lê `ENABLE_TEST_ACCOUNTS`, não exige env `NODE_ENV !== 'production'`, não exige segredo,
  e o botão no frontend também não é condicionado.
- **Impacto:** qualquer visitante assume a conta superadmin (todos os tenants, configs, chaves, usuários).
- **Correção proposta (pequena):** devolver 403 quando `ENABLE_TEST_ACCOUNTS !== 'true'`; exigir header
  `x-test-secret` igual a env (ou remover a rota em produção e usar `NODE_ENV`/host allowlist).

### V2 — CRUD admin sem autenticação (CRÍTICO)
- **Onde:** `app/api/admin/support-materials/route.ts:6-51` (GET/POST) e
  `app/api/admin/support-materials/[id]/route.ts` (PUT/DELETE).
- **Prova:** GET anônimo → 200 com materiais reais; POST anônimo → 201 (linha criada e depois removida);
  DELETE anônimo → 200; PUT anônimo em id inexistente → 500 do PostgREST (chegou ao banco, não 401/403).
- **Causa:** `admin.auth.getUser()` sem token devolve `null` e a rota **não aborta** (`route.ts:31`).
- **Impacto:** leitura/crição/alteração/remoção de materiais de suporte por qualquer visitante.
- **Correção proposta (pequena):** no topo de cada handler, `getProfile()` e exigir `role === "superadmin"`
  (mesmo padrão de `apply-migration-0041/route.ts:17-20`).

### V3 — Token da API do Vercel legível por anônimo (CRÍTICO)
- **Onde:** policy `platform_config_select_all` em `supabase/migrations/0041_platform_official_home.sql`
  (`using (true)` na tabela `platform_config`); leitura em `lib/vercel.ts:61` (server-side, admin client).
- **Prova:** `GET /rest/v1/platform_config?select=…` como `anon` → 200 com
  `vercel_api_token` (60 chars, prefixo `vcp_`); o token foi usado em `GET https://api.vercel.com/v9/projects` → **200**.
- **Impacto:** controle total do projeto/deploys do Vercel (criar tokens, ver vars de ambiente, destruir projetos).
- **Correção proposta:** nova migration revogando `SELECT` para `anon`/`authenticated` (leitura só via
  `service_role`, que já é o que o app usa) **e rotacionar o token exposto** (ele já está comprometido).

### V4 — Catálogo público cacheado sem TTL (ALTO)
- **Onde:** `app/api/public/catalog/[slug]/route.ts` (GET que só usa `{ params }`, sem `dynamic`).
- **Provas:** (a) site suspenso → 200 com produtos 65s depois; (b) preço `54321` no banco → endpoint `10000`;
  (c) tenant B ativo com RPC ok → endpoint 404 (resposta congelada de antes da ativação).
- **Impacto:** (segurança) conteúdo de tenant desativado continua público até o próximo deploy;
  (integridade) preços/produtos publicados nunca atualizam no site.
- **Correção proposta:** `export const dynamic = "force-dynamic"` (ou `revalidate = 30/60`) na rota —
  a RPC já filtra `site_status` e o cache de 60s fica em `lib/tenant.ts` (módulo).

### V5 — Rotas admin sem verificação de papel (BAIXO)
- **Onde:** `app/api/admin/notifications/route.ts`, `app/api/admin/feedback/count/route.ts`.
- **Prova:** anônimo → `{"total":0,"items":[]}`; usuário comum → 0; superadmin → 6 itens.
- **Impacto:** hoje limitado ao `auth.uid()` do chamador, mas são endpoints `/api/admin/*` fora do padrão
  (amplificadores do V1). Correção: mesmo `getProfile()` + `role === "superadmin"`.

### V6 — Slug suspenso devolve 404 em vez de página de indisponibilidade (BAIXO/funcional)
- **Prova:** `/audit-test-a` na plataforma com site suspenso → `404` (`app/not-found.tsx`) com
  `cache-control: private, no-cache` — enquanto o domínio customizado entrega `/site-indisponivel`.
- **Correção:** na página pública, checar `site_status` via RPC e renderizar `/site-indisponivel`.

### V7 — Rotas congeladas no build (INFO)
- `.next/prerender-manifest.json` contém `/api/gateway`, `/api/ai/providers`,
  `/api/affiliate/public-config`, `/api/demo/official-site-seed` → respondem dados do momento do build.
  Aceitável para config global, mas deve ser decisão explícita (`revalidate`).

### Itens complementares (não bloqueantes)
- **`consultoras_dados` sem RLS** (sem uso no código) → remover ou habilitar RLS.
- **Fluxo de desativação sem transação:** `tenants` e `profiles` são atualizados em statements separados
  (`app/api/admin/users/[id]/route.ts:143-162`) → falha no meio pode deixar estado inconsistente.
- **Sem deleção de objetos no R2** ao excluir tenant (`lib/media.ts`) → retenção de arquivos privados por
  tenant excluído (limite atual: prefixo `usuarios/{tenantId}/…` nunca vem do cliente).
- **`middleware.ts` não cobre `/api/**`** → toda rota de API precisa de guarda própria (foi a causa raiz de V1/V2).

---

## 10. Correções propostas (aguardando autorização)

| Piora ordem | Correção | Risco | Arquivos |
| --- | --- | --- | --- |
| 1 | Gate real em `test-login` (`ENABLE_TEST_ACCOUNTS` + segredo/`NODE_ENV`) | Baixo | `app/api/test-login/route.ts` |
| 2 | Guarda `getProfile() + role==='superadmin'` em `support-materials` (GET/POST/PUT/DELETE) | Baixo | 2 arquivos |
| 3 | Migration revogando `SELECT` de `platform_config` para `anon`/`authenticated` + **rotacionar token Vercel** | Médio (precisa aplicar no Supabase) | `supabase/migrations/` (nova) |
| 4 | `export const dynamic = "force-dynamic"` em `/api/public/catalog/[slug]` | Baixo | 1 arquivo |
| 5 | Guarda admin em `notifications` e `feedback/count` | Baixo | 2 arquivos |

Após: `npx tsc --noEmit`, `npm run build`, commit e push (relatório entregue antes do push, conforme combinado).

---

## 11. Estado do ambiente / pendências

- **Tenants de teste a remover ao final:** `audit-test-a|b|c` (+ `auth.users`, `profiles`, `crm_*`,
  `site_settings`, `pwa_settings`, `tenant_sections`, `domains`, `subscriptions`, `media_files`,
  `affiliate_clicks`, `audit_logs`). Nenhum clique/material/linha de teste remanescente (verificado).
- Arquivos temporários não versionados na raiz: `tmp-admin-test.mjs`, `tmp-restore.mjs`, `tmp-shot.mjs`
  (não serão commitados).
- Servidor de produção local rodando em `http://localhost:3000` (`server-audit.log`).
