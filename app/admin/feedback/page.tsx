import AdminFeedbackClient from "@/components/admin/feedback/AdminFeedbackClient";
import { SectionTitle } from "@/components/dashboard/ui";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Feedback dos usuários — Admin",
  robots: { index: false, follow: false },
};

export default function AdminFeedbackPage() {
  return (
    <div>
      <SectionTitle sub="Sugestões, dúvidas, críticas e relatos da comunidade.">
        Mensagens recebidas
      </SectionTitle>
      <AdminFeedbackClient />
    </div>
  );
}
