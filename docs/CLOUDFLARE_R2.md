# Cloudflare R2 — Armazenamento Central de Mídia

> **Arquivos/mídia → Cloudflare R2** · **Banco/metadados/permissões → Supabase** · **Aplicação → Vercel/Hostinger**
>
> A partir desta implementação, toda imagem enviada pelo sistema passa pelo R2.
> **Nunca** salvar binários no filesystem da aplicação, em base64 no banco ou no Supabase Storage.

---

## 1. Como criar o bucket R2

1. Acesse o painel da Cloudflare → **R2** → **Create bucket**.
2. Nome: `site-doterra-media` (use o mesmo do `R2_BUCKET_NAME`).
3. Região: pode deixar **auto** (o R2 replica globalmente).
4. Em **Settings → Custom Domains**, conecte `media.seu-dominio.com.br` quando tiver o domínio (ou use a URL `.r2.dev` temporária no `R2_PUBLIC_URL`).

## 2. Como criar API Token (R2 Access Key)

1. Cloudflare → **R2** → **Manage R2 API Tokens** → **Create API Token**.
2. Permissão: **Object Read & Write** restrita ao bucket `site-doterra-media`.
3. Copie o **Access Key ID** e o **Secret Access Key** (só são exibidos uma vez).

## 3. Como obter o Account ID

1. No painel da Cloudflare, na home, procure **Account ID** (lado direito, formato `1a2b3c...`).
2. Ou: **R2 → Overview → Account ID**.

## 4. Configurar o bucket

O bucket recebe os arquivos por **prefixo/pasta** — não há um bucket por usuário:

```
usuarios/{tenant_id}/
  logo/
  avatar/
  hero/
  story/
  produtos/
  galeria/
  banners/
  general/
sistema/                    ← mídias da HOME global (Super Admin)
  hero/
  story/
  ...
```

A separação multi-tenant é garantida porque o **backend resolve o tenant do usuário autenticado** — o frontend nunca escolhe o caminho.

## 5. Configurar domínio público / CDN

1. No bucket → **Settings** → **Custom Domains** → **Connect domain**.
2. Aponte `media.seu-dominio.com.br` (CNAME para o domínio `.r2.dev` fornecido na tela).
3. Defina `R2_PUBLIC_URL=https://media.seu-dominio.com.br` nas variáveis de ambiente da Vercel.

## 6. Configurar CORS no bucket

Porque o browser faz **PUT direto ao R2** (via URL pré-assinada), o bucket precisa aceitar essas origens:

1. No bucket → **Settings** → **CORS** → **Edit**.
2. Regra:

```json
[
  {
    "AllowedOrigins": [
      "https://sitedoterra-psi.vercel.app",
      "https://www.sitedoterra.com.br",
      "https://sitedoterra.com.br",
      "http://localhost:3000"
    ],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

> Inclua todos os domínios reais da aplicação (Vercel de produção/preview e local). **Não use `*`** a menos que seja estritamente necessário.

## 7. Variáveis na Vercel

Em **Settings → Environment Variables**, definir **Production**, **Preview** e **Development**:

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME=site-doterra-media`
- `R2_PUBLIC_URL=https://media.sitedoterra.com.br` (ou a URL `.r2.dev`)

Após configurar, faça **Redeploy**.

## 8. Variáveis locais

Copie os mesmos valores para o seu `.env` local (nunca commitar `.env`). O `.env.example` já documenta os nomes.

## 9. Testar

1. Entre no painel do usuário → **Biblioteca de Mídia** (`/painel/midias`) → **+ Enviar imagem**.
2. Confirme o upload; a miniatura deve aparecer.
3. Copie a URL — deve começar com `R2_PUBLIC_URL`.
4. No editor de seções (Meu Site / editor da HOME), o campo **Foto** agora tem o botão **🖼️ Escolher**, que abre a biblioteca.

## 10. Verificar upload no R2

No painel da Cloudflare → **R2 → site-doterra-media → Objects** — o arquivo deve estar em `usuarios/{tenant_id}/...`.

## 11. Verificar exclusão

Na biblioteca, **Excluir** remove o objeto do R2 e o metadado do Supabase. Se a imagem ainda for usada numa seção, a exclusão é **bloqueada** e o sistema lista onde ela é usada.

---

## Arquitetura técnica

### Fluxo de upload (presigned URL — sem passar o binário pela Vercel)

```
Browser ──POST /api/media/presign──▶ API (valida sessão/tenant/arquivo/quota)
Browser ◀──otimizada── { uploadUrl (PUT assinado R2) }
Browser ──PUT uploadUrl──▶ Cloudflare R2 (binário direto)
Browser ──POST /api/media/complete──▶ API (verifica objeto, marca 'uploaded')
```

### Rotas/API criadas

| Rota | Método | Uso |
|---|---|---|
| `/api/media/presign` | POST | Valida e devolve URL pré-assinada de upload (reserva metadado `uploading`) |
| `/api/media/complete` | POST | Confirma o objeto no R2 e marca `uploaded` (+ auditoria) |
| `/api/media` | GET | Lista mídias (`?scope=tenant\|system\|admin&category=&q=&sort=&tenant_id=`) |
| `/api/media/[id]` | DELETE | Exclui do R2 + banco, com checagem de referência |
| `/api/media/stats` | GET | Uso/quota do tenant ou agregado da plataforma (`?all=1`) |

### Tabelas

- **`media_files`**: metadados (id, tenant_id, user_id, storage_key, public_url, original_name, mime_type, file_size, category, folder, status, datas). **Nenhum binário**.
- **`media_actions`**: auditoria de upload/exclusão (usuário, tenant, data, detalhes).
- **`plans.media_quota_bytes`**: limite de armazenamento por plano (padrão 500 MB) — configurável pelo Super Admin em `/admin/planos`.

### Isolamento multi-tenant

- O tenant é sempre resolvido do **usuário autenticado** (`mediaContext()` em `lib/media.ts`).
- Listar/excluir exige `media.user_id === auth.user.id` **ou** superadmin.
- `scope=system` (mídias da HOME global) é **exclusivo do Super Admin**.

### Componentes

- `MediaUploader` — componente central de upload (todos os uploads devem usá-lo).
- `MediaLibrary` — biblioteca (busca, filtro por categoria, copiar URL, excluir).
- `MediaPicker` — abre a biblioteca em modo "escolher" para campos de imagem.

### Testes manuais de segurança

1. Tentar usar `tenant_id` de outro usuário → ignorado (sempre usado o do usuário).
2. Acessar arquivo de outro tenant → 404/403.
3. Excluir arquivo de outro tenant → 403.
4. Upload acima do limite → 413 com mensagem clara.
5. Arquivo inválido/formaato não permitido → 400.
6. Secrets (`R2_*`) nunca aparecem no browser (somente no backend).