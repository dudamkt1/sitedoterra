import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/crm-auth";

export const runtime = "nodejs";

/** PUT /api/crm/charges/[id] — atualiza cobrança (inclusive status/baixa). */
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const { error, admin, tenant, user } = await requireTenant();
  if (error) return error;
  const body = await request.json();
  const payload: Record<string, unknown> = {};
  for (const k of ["due_date", "payment_method", "notes", "client_id", "sale_id"] as const) {
    if (body[k] !== undefined) payload[k] = body[k] === "" ? null : body[k];
  }
  if (body.amount_cents !== undefined) {
    const amount = Math.round(Number(body.amount_cents) || 0);
    if (amount <= 0) return NextResponse.json({ error: "Valor inválido." }, { status: 400 });
    payload.amount_cents = amount;
  }
  if (body.status !== undefined) {
    payload.status = String(body.status);
    if (body.status === "Pago" && body.paid_at === undefined) payload.paid_at = new Date().toISOString();
    if (body.status !== "Pago") payload.paid_at = null;
  }

  const { data: current } = await admin.from("crm_charges").select("client_id, sale_id, amount_cents, status, payment_method, due_date").eq("id", params.id).eq("tenant_id", tenant!.id).maybeSingle();
  
  const wasNotPaid = current?.status !== "Pago";
  const isNowPaid = body.status === "Pago";

  const { error: err } = await admin.from("crm_charges").update(payload).eq("id", params.id).eq("tenant_id", tenant!.id);
  if (err) return NextResponse.json({ error: "Erro ao atualizar cobrança." }, { status: 500 });

  // Se mudou para Pago: sincroniza com Financeiro e Vendas
  if (isNowPaid && wasNotPaid && current) {
    // 1. Cria entrada financeira (receita)
    const financialEntry = {
      tenant_id: tenant!.id,
      user_id: user!.id,
      client_id: current.client_id || null,
      type: "income" as const,
      category: "Cobrança quitada",
      description: `Baixa de cobrança${current.payment_method ? ` (${current.payment_method})` : ""}`,
      amount_cents: current.amount_cents,
      entry_date: new Date().toISOString().slice(0, 10),
      payment_method: current.payment_method || null,
      notes: `Origem: cobrança #${params.id.slice(0, 8)}`,
    };
    await admin.from("crm_financial_entries").insert(financialEntry);

    // 2. Timeline do cliente
    if (current.client_id) {
      await admin.from("crm_client_timeline").insert({
        tenant_id: tenant!.id,
        client_id: current.client_id,
        event_type: "beneficio",
        title: "Cobrança quitada",
        description: `Pagamento recebido — ${(current.amount_cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
        event_at: new Date().toISOString(),
      });
    }

    // 3. Se há venda relacionada, atualiza status da venda para Pago
    if (current.sale_id) {
      await admin.from("crm_sales").update({ status: "Pago", payment_method: current.payment_method }).eq("id", current.sale_id).eq("tenant_id", tenant!.id);
      
      // Timeline do cliente para a venda
      if (current.client_id) {
        await admin.from("crm_client_timeline").insert({
          tenant_id: tenant!.id,
          client_id: current.client_id,
          event_type: "venda",
          title: "Venda quitada via cobrança",
          description: `Pagamento da cobrança #${params.id.slice(0, 8)} vinculado à venda`,
          event_at: new Date().toISOString(),
        });
      }
    }
  }

  // Se mudou de Pago para outro status: remove entrada financeira correspondente
  if (wasNotPaid === false && isNowPaid === false && current) {
    await admin.from("crm_financial_entries").delete().eq("notes", `Origem: cobrança #${params.id.slice(0, 8)}`).eq("tenant_id", tenant!.id);
    
    // Se há venda relacionada, reabre a venda
    if (current.sale_id) {
      await admin.from("crm_sales").update({ status: "Pendente" }).eq("id", current.sale_id).eq("tenant_id", tenant!.id);
    }
  }

  await admin.from("audit_logs").insert({
    actor_id: user!.id,
    actor_role: "user",
    action: "crm_charge_update",
    entity_type: "crm_charges",
    entity_id: params.id,
    metadata: { fields: Object.keys(payload), statusChanged: isNowPaid || body.status !== current?.status },
  });
  return NextResponse.json({ success: true });
}

/** DELETE /api/crm/charges/[id] — remove cobrança. */
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const { error, admin, tenant, user } = await requireTenant();
  if (error) return error;

  const { data: current } = await admin.from("crm_charges").select("status, amount_cents").eq("id", params.id).eq("tenant_id", tenant!.id).maybeSingle();
  
  const { error: err } = await admin.from("crm_charges").delete().eq("id", params.id).eq("tenant_id", tenant!.id);
  if (err) return NextResponse.json({ error: "Erro ao excluir cobrança." }, { status: 500 });

  // Remove entrada financeira correspondente se a cobrança estava paga
  if (current?.status === "Pago") {
    await admin.from("crm_financial_entries").delete().eq("notes", `Origem: cobrança #${params.id.slice(0, 8)}`).eq("tenant_id", tenant!.id);
  }

  await admin.from("audit_logs").insert({
    actor_id: user!.id,
    actor_role: "user",
    action: "crm_charge_delete",
    entity_type: "crm_charges",
    entity_id: params.id,
    metadata: {},
  });
  return NextResponse.json({ success: true });
}