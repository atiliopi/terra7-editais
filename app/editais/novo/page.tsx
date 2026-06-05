"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function NewGrantPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    const formData = new FormData(event.currentTarget);

    const data = {
      title: getValue(formData, "title"),
      state_scope: getValue(formData, "state_scope"),
      area: getValue(formData, "area"),
      sender_name: getValue(formData, "sender_name"),
      opening_date: getValue(formData, "opening_date"),
      closing_date: getValue(formData, "closing_date"),
      total_value: toNumberOrNull(getValue(formData, "total_value")),
      value_per_project: toNumberOrNull(getValue(formData, "value_per_project")),
      source: getValue(formData, "source"),
      source_url: getValue(formData, "source_url"),
      raw_text: getValue(formData, "raw_text"),
      notes: getValue(formData, "notes"),
    };

    // 🔥 1. contar quantos editais existem
const { count } = await supabase
  .from("grants")
  .select("*", { count: "exact", head: true });

// 🔥 2. gerar código sequencial
const code = `EDITAL-${String((count || 0) + 1).padStart(4, "0")}`;

// 🔥 3. inserir com código
const {
  data: { user },
} = await supabase.auth.getUser();

const { error } = await supabase.from("grants").insert([
  {
    ...data,
    code,
    created_by: user?.id,
  },
]);

    setLoading(false);

    if (error) {
      console.error(error);
      alert("Erro ao salvar edital. Veja o terminal/console.");
      return;
    }

    alert("Edital salvo com sucesso!");

    router.push("/");
  }

  return (
    <main className="min-h-screen bg-black p-6 text-white">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/"
          className="mb-6 inline-block text-sm text-zinc-400 hover:text-white"
        >
          ← Voltar ao dashboard
        </Link>

        <header className="mb-8 rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <h1 className="text-3xl font-bold">Novo edital</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Cadastre manualmente uma nova oportunidade.
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="grid gap-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-6 md:grid-cols-2"
        >
          <Field label="Nome do edital">
            <input
              name="title"
              className={inputClass}
              placeholder="Ex: Edital Cultura SP"
            />
          </Field>

          <Field label="Estado / Abrangência">
            <input
              name="state_scope"
              className={inputClass}
              placeholder="Ex: SP, RJ, Nacional"
            />
          </Field>

          <Field label="Área / Tema">
            <input
              name="area"
              className={inputClass}
              placeholder="Ex: Cultura, Educação"
            />
          </Field>

          <Field label="Responsável pelo envio">
            <input
              name="sender_name"
              className={inputClass}
              placeholder="Ex: Ana Ribeiro"
            />
          </Field>

          <Field label="Data de abertura">
            <input name="opening_date" type="date" className={inputClass} />
          </Field>

          <Field label="Data de encerramento">
            <input name="closing_date" type="date" className={inputClass} />
          </Field>

          <Field label="Valor total">
            <input
              name="total_value"
              className={inputClass}
              placeholder="Ex: 500000"
            />
          </Field>

          <Field label="Valor por projeto">
            <input
              name="value_per_project"
              className={inputClass}
              placeholder="Ex: 50000"
            />
          </Field>

          <Field label="Fonte">
            <input
              name="source"
              className={inputClass}
              placeholder="Ex: Secretaria de Cultura"
            />
          </Field>

          <Field label="Link do edital">
            <input
              name="source_url"
              className={inputClass}
              placeholder="https://..."
            />
          </Field>

          <div className="md:col-span-2">
            <Field label="Texto bruto recebido">
              <textarea
                name="raw_text"
                className={`${inputClass} min-h-32 resize-none`}
                placeholder="Cole aqui o texto original do edital, mensagem do WhatsApp ou resumo recebido."
              />
            </Field>
          </div>

          <div className="md:col-span-2">
            <Field label="Observações manuais">
              <textarea
                name="notes"
                className={`${inputClass} min-h-28 resize-none`}
                placeholder="Ex: verificar documentação, prazo curto, edital interessante..."
              />
            </Field>
          </div>

          <div className="flex gap-3 md:col-span-2">
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black hover:bg-zinc-200 disabled:opacity-60"
            >
              {loading ? "Salvando..." : "Salvar edital"}
            </button>

            <Link
              href="/"
              className="rounded-xl border border-zinc-700 px-5 py-3 text-sm font-semibold text-zinc-200 hover:bg-zinc-900"
            >
              Cancelar
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-zinc-300">
        {label}
      </span>
      {children}
    </label>
  );
}

function getValue(formData: FormData, key: string) {
  const value = formData.get(key);

  if (!value) {
    return null;
  }

  const text = String(value).trim();

  return text === "" ? null : text;
}

function toNumberOrNull(value: string | null) {
  if (!value) {
    return null;
  }

  const normalized = value
    .replace("R$", "")
    .replace(/\./g, "")
    .replace(",", ".")
    .trim();

  const number = Number(normalized);

  return Number.isNaN(number) ? null : number;
}

const inputClass =
  "w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-zinc-500";