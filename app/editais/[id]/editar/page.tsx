"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function EditarEditalPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    title: "",
    state_scope: "",
    area: "",
    opening_date: "",
    closing_date: "",
    total_value: "",
    value_per_project: "",
    source: "",
    source_url: "",
    sender_name: "",
    notes: "",
    raw_text: "",
  });

  useEffect(() => {
    if (!id) return;

    async function loadGrant() {
      const { data, error } = await supabase
        .from("grants")
        .select("*")
        .eq("id", id)
        .single();

      if (error || !data) {
        alert("Erro ao carregar edital.");
        router.push("/");
        return;
      }

      setForm({
        title: data.title || "",
        state_scope: data.state_scope || "",
        area: data.area || "",
        opening_date: data.opening_date || "",
        closing_date: data.closing_date || "",
        total_value: data.total_value || "",
        value_per_project: data.value_per_project || "",
        source: data.source || "",
        source_url: data.source_url || "",
        sender_name: data.sender_name || "",
        notes: data.notes || "",
        raw_text: data.raw_text || "",
      });

      setLoading(false);
    }

    loadGrant();
  }, [id, router]);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const { error } = await supabase
      .from("grants")
      .update({
        title: form.title,
        state_scope: form.state_scope,
        area: form.area,
        opening_date: form.opening_date || null,
        closing_date: form.closing_date || null,
        total_value: form.total_value || null,
        value_per_project: form.value_per_project || null,
        source: form.source,
        source_url: form.source_url,
        sender_name: form.sender_name,
        notes: form.notes,
        raw_text: form.raw_text,
      })
      .eq("id", id);

    setSaving(false);

    if (error) {
      alert("Erro ao salvar alterações.");
      return;
    }

    router.push(`/editais/${id}`);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black p-6 text-white">
        <div className="mx-auto max-w-5xl">
          <p className="text-zinc-400">Carregando edital...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black p-6 text-white">
      <div className="mx-auto max-w-5xl">
        <Link
          href={`/editais/${id}`}
          className="mb-6 inline-block text-sm text-zinc-400 hover:text-white"
        >
          ← Voltar para o edital
        </Link>

        <form onSubmit={handleSubmit} className="space-y-6">
          <header className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
            <p className="mb-2 text-xs uppercase tracking-widest text-zinc-500">
              Editando edital #{id.slice(0, 8)}
            </p>

            <h1 className="text-3xl font-bold tracking-tight">
              Editar edital
            </h1>

            <p className="mt-3 text-sm text-zinc-400">
              Atualize as informações do edital e salve as alterações.
            </p>
          </header>

          <section className="grid gap-6 md:grid-cols-2">
            <Card title="Informações principais">
              <Field
                label="Título do edital"
                name="title"
                value={form.title}
                onChange={handleChange}
                placeholder="Ex: Edital de incentivo ao esporte"
              />

              <Field
                label="Estado / Abrangência"
                name="state_scope"
                value={form.state_scope}
                onChange={handleChange}
                placeholder="Ex: Piauí, Ceará, Nacional"
              />

              <Field
                label="Área / Tema"
                name="area"
                value={form.area}
                onChange={handleChange}
                placeholder="Ex: Esporte, Cultura, Educação"
              />

              <Field
                label="Data de abertura"
                type="date"
                name="opening_date"
                value={form.opening_date}
                onChange={handleChange}
              />

              <Field
                label="Data de encerramento"
                type="date"
                name="closing_date"
                value={form.closing_date}
                onChange={handleChange}
              />
            </Card>

            <Card title="Valores">
              <Field
                label="Valor total"
                name="total_value"
                value={form.total_value}
                onChange={handleChange}
                placeholder="Ex: 600000"
              />

              <Field
                label="Valor por projeto"
                name="value_per_project"
                value={form.value_per_project}
                onChange={handleChange}
                placeholder="Ex: 100000"
              />
            </Card>

            <Card title="Origem do edital">
              <Field
                label="Fonte"
                name="source"
                value={form.source}
                onChange={handleChange}
                placeholder="Ex: Instagram, site oficial, Diário Oficial"
              />

              <Field
                label="Link da fonte"
                name="source_url"
                value={form.source_url}
                onChange={handleChange}
                placeholder="https://..."
              />
            </Card>

            <Card title="Responsável pelo envio">
              <Field
                label="Enviado por"
                name="sender_name"
                value={form.sender_name}
                onChange={handleChange}
                placeholder="Nome de quem enviou o edital"
              />
            </Card>
          </section>

          <Card title="Observações manuais">
            <Textarea
              label="Observações"
              name="notes"
              value={form.notes}
              onChange={handleChange}
              placeholder="Informações extras sobre o edital"
            />
          </Card>

          <Card title="Texto bruto recebido">
            <Textarea
              label="Texto bruto"
              name="raw_text"
              value={form.raw_text}
              onChange={handleChange}
              placeholder="Texto original recebido sobre o edital"
            />
          </Card>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Salvando..." : "Salvar alterações"}
            </button>

            <Link
              href={`/editais/${id}`}
              className="rounded-xl border border-zinc-700 px-5 py-3 text-sm font-semibold text-zinc-300 hover:bg-zinc-900"
            >
              Cancelar
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
      <h2 className="mb-5 text-lg font-semibold">{title}</h2>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  name,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-medium text-zinc-400">
        {label}
      </span>

      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full rounded-xl border border-zinc-800 bg-black px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-blue-500"
      />
    </label>
  );
}

function Textarea({
  label,
  name,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-medium text-zinc-400">
        {label}
      </span>

      <textarea
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={5}
        className="w-full rounded-xl border border-zinc-800 bg-black px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-blue-500"
      />
    </label>
  );
}