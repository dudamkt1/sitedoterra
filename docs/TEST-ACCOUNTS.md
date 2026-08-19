# Conta Única de Teste — Super Admin e Usuário

Documentação operacional da conta de **teste** única do sistema.

> ⚠️ A conta é **claramente de TESTE** e não deve ser confundida com usuários
> reais. Nenhum pagamento real é feito: os registros de Stripe usam
> identificadores fictícios com prefixo `TESTE`.

---

## 1. Conta criada

| Papel | E-mail | Role | Acesso |
| --- | --- | --- | --- |
| Usuário Teste / Super Admin | `contato@keroimpresso.com.br` | `superadmin` | `/admin` (todas as áreas administrativas) e `/painel` |

Site público da conta:
**`https://sitedoterra-psi.vercel.app/usuarioteste`**

### Situação financeira da conta (registros internos, sem cobrança real)

- Ativação: **R$ 297,00 — PAGO** (`payments.type = activation`, `status = succeeded`)
- Assinatura: **R$ 47,00/mês — ATIVA** (`subscriptions.status = active`)
- Site: **ATIVO** (`tenants.site_status = active`)
- Conta: **ATIVA** (`profiles.status = active`)
- Domínio próprio: **Não configurado** (nenhum registro em `domains`)

---

## 2. Variáveis de ambiente necessárias

```bash
# Gate de autorização (server-side) + visibilidade dos botões (frontend)
ENABLE_TEST_ACCOUNTS=true
NEXT_PUBLIC_ENABLE_TEST_ACCOUNTS=true

# Credenciais das contas de teste (ficam SOMENTE no servidor / .env)
TEST_SUPERADMIN_EMAIL=contato@keroimpresso.com.br
TEST_SUPERADMIN_PASSWORD=COLOQUE_UMA_SENHA
TEST_USER_EMAIL=contato@keroimpresso.com.br
TEST_USER_PASSWORD=COLOQUE_UMA_SENHA
```

- `ENABLE_TEST_ACCOUNTS` é o gate de autorização lido pela API `POST /api/test-login`.
- `NEXT_PUBLIC_ENABLE_TEST_ACCOUNTS` controla se os botões aparecem no frontend.
- As senhas **nunca** devem ser escritas no código ou commitadas. Ficam apenas em `.env` (ignorado pelo Git).
- `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são usadas apenas pelo script de seed no servidor.

---

## 3. Como criar/atualizar a conta (seed idempotente)

```bash
npm run seed:test
```

O script `scripts/seed-test-users.mjs`:

1. procura a conta por e-mail (em `profiles` / `auth.users`);
2. cria se não existir, atualiza se existir (senha + perfil);
3. garante a `role` `superadmin`;
4. garante o tenant/site (`usuarioteste`, `site_status = active`);
5. garante plano, assinatura ativa e pagamentos de teste (R$ 297 + R$ 47);
6. garante `site_settings` e seções da HOME ativas (HERO, SOBRE, DEPOIMENTOS, VÍDEO, AGENDAMENTO, PRODUTOS, FAQ e CTA).

Pode ser re-executado quantas vezes quiser — **não duplica dados**.
Se a conta já existir, ela é reutilizada e apenas corrigida.

---

## 4. Como ativar / desativar o Acesso Rápido

Ativar:

```bash
ENABLE_TEST_ACCOUNTS=true
NEXT_PUBLIC_ENABLE_TEST_ACCOUNTS=true
```

Desativar (comportamento padrão):

```bash
ENABLE_TEST_ACCOUNTS=false
NEXT_PUBLIC_ENABLE_TEST_ACCOUNTS=false
```

Com as flags em `false`:
- os botões **não aparecem** na tela de login;
- a API `POST /api/test-login` responde `403`.

> Depois de alterar variáveis de ambiente, reinicie o servidor (`npm run dev`) e, no
> Vercel, faça um novo deploy para aplicar.

---

## 5. Como usar o Acesso Rápido

1. Abra `/login`;
2. Na área **"ACESSO RÁPIDO — TESTES"** clique no botão
   **Entrar como contato@keroimpresso.com.br**;
3. O login é feito **server-side** (`POST /api/test-login`), as senhas nunca passam pelo navegador.
   Como a conta é `superadmin`, ela abre tanto `/admin` quanto `/painel`.

---

## 6. Como remover a conta de teste

> ⚠️ Remover apaga também tenant, assinatura, pagamentos e seções vinculados (cascade).

1. No painel Supabase (Authentication → Users) ou via SQL:

```sql
delete from auth.users
where email = 'contato@keroimpresso.com.br';
```

2. (Alternativa) via Admin API:

```js
const admin = supabaseAdminClient;
admin.auth.admin.deleteUser(userId);
```

3. Para desligar o acesso rápido, volte as flags para `false` (seção 4).

---

## 7. Fluxo de acesso (como a autorização é validada)

- **Frontend:** `app/admin/layout.tsx` redireciona para `/painel` qualquer perfil que não seja `superadmin`.
- **Servidor/API:** rotas como `/api/admin/*`, `/api/sections` e `/api/site` revalidam o perfil no servidor (role + tenant do usuário logado).
- **Banco (RLS):** políticas de RLS garantem isolamento multi-tenant; a função `public.is_superadmin()` libera acesso administrativo. A conta única é superadmin e enxerga os próprios dados e a área administrativa.
- **Login rápido:** `POST /api/test-login` só funciona com a flag habilitada e usa credenciais do servidor.

A conta única é `superadmin`, portanto acessa `/admin` e também o `/painel` quando quiser.
