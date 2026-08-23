"use client";

import { useDemoStore } from "@/lib/demo/store";

export function PainelDemoTarefas() {
  const { ready, data, update, genId } = useDemoStore();
  if (!ready || !data) return <div className="text-sm text-gray-500">Carregando demonstração...</div>;

  function addTask() {
    const title = prompt("Título da tarefa:");
    if (!title) return;
    const priority = (prompt("Prioridade (baixa/media/alta):", "media") || "media") as "baixa" | "media" | "alta";
    update((d) => ({
      ...d,
      tasks: [
        ...d.tasks,
        {
          id: genId("task"),
          title,
          clientId: null,
          dueDate: new Date(Date.now() + 7 * 86400000).toISOString(),
          done: false,
          priority,
        },
      ],
    }));
  }

  function toggle(id: string) {
    update((d) => ({
      ...d,
      tasks: d.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
    }));
  }

  function remove(id: string) {
    if (!confirm("Excluir tarefa?")) return;
    update((d) => ({ ...d, tasks: d.tasks.filter((t) => t.id !== id) }));
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>Tarefas</h1>
          <p className="text-sm text-gray-500 mt-1">
            {data.tasks.filter((t) => !t.done).length} aberta(s) · {data.tasks.filter((t) => t.done).length} concluída(s)
          </p>
        </div>
        <button
          type="button"
          onClick={addTask}
          className="rounded-lg bg-[#1d5c3a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#16472c]"
        >
          + Nova tarefa
        </button>
      </div>

      <ul className="space-y-2">
        {data.tasks.map((t) => (
          <li
            key={t.id}
            className={`flex items-center gap-3 rounded-xl border bg-white px-4 py-3 ${
              t.done ? "opacity-60 border-gray-100" : "border-gray-200"
            }`}
          >
            <input
              type="checkbox"
              className="h-4 w-4 accent-[#1d5c3a]"
              checked={t.done}
              onChange={() => toggle(t.id)}
            />
            <div className="flex-1">
              <p className={`font-medium ${t.done ? "line-through text-gray-400" : "text-gray-800"}`}>{t.title}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Vencimento: {new Date(t.dueDate).toLocaleDateString("pt-BR")} · Prioridade: {t.priority}
              </p>
            </div>
            <button type="button" onClick={() => remove(t.id)} className="text-xs font-medium text-red-600 hover:underline">
              Excluir
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
