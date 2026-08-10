# Contas de Teste — Super Admin e Cliente Teste

Documentação operacional das contas de **teste** criadas para o sistema.

> ⚠️ As duas contas são **claramente de TESTE** e não devem ser confundidas com
> usuários reais. Nenhum pagamento real é feito: os registros de Stripe usam
> identificadores fictícios com prefixo `TESTE`.

---

## 1. Contas criadas

| Papel | E-mail | Role | Acesso |
| --- | --- | --- | --- |
| Super Admin | `superadmin.teste@exemplo.com` | `superadmin` | `/admin` (todas as áreas administrativas) |
| Cliente Teste | `cliente.teste@exemplo.com` | `user` | `/painel` (painel do usuário) |

Site público do Cliente Teste:
**`https://sitedoterra-psi.vercel.app/cliente-teste`**

### Situação financeira do Cliente Teste (registros internos, sem cobrança real)

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
TEST_SUPERADMIN_EMAIL=superadmin.teste@exemplo.com
TEST_SUPERADMIN_PASSWORD=COLOQUE_UMA_SENHA
TEST_USER_EMAIL=cliente.teste@exemplo.com
TEST_USER_PASSWORD=COLOQUE_UMA_SENHA
```

- `ENABLE_TEST_ACCOUNTS` é o gate de autorização lido pela API `POST /api/test-login`.
- `NEXT_PUBLIC_ENABLE_TEST_ACCOUNTS` controla se os botões aparecem no frontend.
- As senhas **nunca** devem ser escritas no código ou commitadas. Ficam apenas em `.env` (ignorado pelo Git).
- `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são usadas apenas pelo script de seed no servidor.

---

## 3. Como criar/atualizar os usuários (seed idempotente)

```bash
npm run seed:test
```

O script `scripts/seed-test-users.mjs`:

1. procura cada usuário por e-mail (em `profiles` / `auth.users`);
2. cria se não existir, atualiza se existir (senha + perfil);
3. garante a `role` (`superadmin` / `user`);
4. garante o tenant/site (`cliente-teste`, `site_status = active`);
5. garante plano, assinatura ativa e pagamentos de teste (R$ 297 + R$ 47);
6. garante `site_settings` e seções da HOME ativas (HERO, SOBRE, DEPOIMENTOS, VÍDEO, AGENDAMENTO, PRODUTOS, FAQ e CTA).

Pode ser re-executado quantas vezes quiser — **não duplica dados**.
Se as contas já existirem, elas são reutilizadas e apenas corrigidas.

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
2. Na área **"ACESSO RÁPIDO — TESTES"** clique em:
   - **Entrar como Super Admin** → autentica no servidor e redireciona para `/admin`;
   - **Entrar como Cliente Teste** → redireciona para `/painel`;
3. O login é feito **server-side** (`POST /api/test-login`), as senhas nunca passam pelo navegador.

---

## 6. Como remover as contas de teste

> ⚠️ Remover apaga também tenant, assinatura, pagamentos e seções vinculados (cascade).

1. No painel Supabase (Authentication → Users) ou via SQL:

```sql
delete from auth.users
where email in ('superadmin.teste@exemplo.com', 'cliente.teste@exemplo.com');
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
- **Banco (RLS):** políticas de RLS garantem isolamento multi-tenant; a função `public.is_superadmin()` libera acesso administrativo. O Cliente Teste só enxerga os próprios dados.
- **Login rápido:** `POST /api/test-login` só funciona com a flag habilitada e usa credenciais do servidor.

O Cliente Teste **não** consegue acessar `/admin/usuarios`, configurações globais, editor global da HOME, pagamentos ou sites de outros tenants (frontend + API + RLS).
