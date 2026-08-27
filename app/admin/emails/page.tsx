import AdminEmailConfig from "@/components/admin/AdminEmailConfig";

export const dynamic = "force-dynamic";

export default function AdminEmailsPage() {
  return (
    <div>
      <h1 className="text-3xl font-semibold mb-1" style={{ fontFamily: "var(--font-display)" }}>
        E-mails — SMTP / Remetente
      </h1>
      <p className="text-sm text-gray-500 mb-8">
        Configure o servidor que enviará os e-mails do site (recuperação de senha e outros). O que for salvo aqui passa a ser usado automaticamente no lugar do e-mail padrão do Supabase, com seu logo e remetente personalizado.
      </p>
      <AdminEmailConfig />
    </div>
  );
}
