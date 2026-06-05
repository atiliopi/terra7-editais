"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { GrantStatusBadge } from "@/components/grants/GrantStatusBadge";
import { getGrantStatus } from "@/lib/grants/status";
import { supabase } from "@/lib/supabase/client";
import { DeleteGrantButton } from "@/components/grants/DeleteGrantButton";

type Grant = {
  id: string;
  code: string | null;
  title: string | null;
  state_scope: string | null;
  area: string | null;
  opening_date: string | null;
  closing_date: string | null;
  total_value: number | string | null;
  value_per_project: number | string | null;
  source: string | null;
  source_url: string | null;
  sender_name: string | null;
  created_at: string | null;
  notes: string | null;
  file_url: string | null;
  raw_text: string | null;
};

export default function GrantDetailsPage() {
  const params = useParams();
  const id = params.id as string;

  const [grant, setGrant] = useState<Grant | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    async function loadData() {
      const { data: grantData, error } = await supabase
        .from("grants")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        console.error("Erro ao buscar edital:", error);
      }

      setGrant(grantData || null);

      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;

      if (userId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role,status")
          .eq("id", userId)
          .single();

        if (profile?.role === "admin" && profile?.status === "approved") {
          setIsAdmin(true);
        }
      }

      setLoading(false);
    }

    loadData();
  }, [id]);

  if (loading) {
    return (
      <main className="min-h-screen bg-black p-6 text-white">
        <div className="mx-auto max-w-4xl">
          <p className="text-zinc-400">Carregando edital...</p>
        </div>
      </main>
    );
  }

  if (!grant) {
    return (
      <main className="min-h-screen bg-black p-6 text-white">
        <div className="mx-auto max-w-4xl">
          <p className="text-zinc-400">Edital não encontrado.</p>

          <Link
            href="/"
            className="mt-4 inline-block rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black"
          >
            Voltar
          </Link>
        </div>
      </main>
    );
  }

  const status = getGrantStatus(grant.opening_date, grant.closing_date);

  return (
    <main className="min-h-screen bg-black p-6 text-white">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/"
          className="mb-6 inline-block text-sm text-zinc-400 hover:text-white"
        >
          ← Voltar ao dashboard
        </Link>

        <header className="mb-8 rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-start">
            <div>
              <p className="mb-2 text-xs uppercase tracking-widest text-zinc-500">
                {grant.code || `Edital #${grant.id.slice(0, 8)}`}
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <h1 className="max-w-[700px] text-2xl font-bold leading-tight text-white">
  <span className="block line-clamp-2">
    {grant.title || "Sem título"}
  </span>
</h1>

                <GrantStatusBadge status={status} />
              </div>

              <p className="mt-3 max-w-2xl text-sm text-zinc-400">
                Informações completas do edital, origem do envio e dados capturados.
              </p>
            </div>

            <div className="flex gap-3">
              <Link
                href={`/editais/${id}/editar`}
                className="rounded-xl bg-yellow-400 px-4 py-2 text-sm font-semibold text-black hover:bg-yellow-500"
              >
                Editar edital
              </Link>

              {isAdmin && <DeleteGrantButton id={id} />}
            </div>
          </div>
        </header>

        <section className="grid gap-6 md:grid-cols-2">
          <InfoCard title="Informações principais">
            <Info label="Estado / Abrangência" value={grant.state_scope} />
            <Info label="Área / Tema" value={grant.area} />
            <Info label="Data de abertura" value={formatDateBR(grant.opening_date)} />
            <Info label="Data de encerramento" value={formatDateBR(grant.closing_date)} />
          </InfoCard>

          <InfoCard title="Valores">
            <Info label="Valor total" value={formatValue(grant.total_value)} />
            <Info label="Valor por projeto" value={formatValue(grant.value_per_project)} />
          </InfoCard>

          <InfoCard title="Origem do edital">
            <Info label="Fonte" value={grant.source} />

            {grant.source_url ? (
              <a
                href={grant.source_url}
                target="_blank"
                className="mt-3 inline-block rounded-lg border border-green-500/30 px-3 py-2 text-sm font-medium text-green-400 hover:bg-green-500/10"
              >
                Abrir link do edital
              </a>
            ) : (
              <p className="mt-3 text-sm text-zinc-500">
                Nenhum link cadastrado.
              </p>
            )}
          </InfoCard>

          <InfoCard title="Responsável pelo envio">
            <Info label="Enviado por" value={grant.sender_name} />
            <Info
              label="Data do cadastro"
              value={formatDateBR(grant.created_at?.slice(0, 10) || null)}
            />
          </InfoCard>

          <InfoCard title="Observações manuais">
            <p className="text-sm leading-6 text-zinc-300">
              {grant.notes || "Nenhuma observação cadastrada."}
            </p>
          </InfoCard>

          <InfoCard title="Arquivo original">
            <p className="text-sm text-zinc-500">
              {grant.file_url ? "Arquivo anexado." : "Nenhum arquivo anexado."}
            </p>
          </InfoCard>
        </section>

        <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <h2 className="text-lg font-semibold">Texto bruto recebido</h2>

          <div className="mt-4 rounded-xl border border-zinc-800 bg-black p-4">
            <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-300">
              {grant.raw_text || "Nenhum texto bruto cadastrado."}
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

function InfoCard({
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

function Info({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div>
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-zinc-200">
        {value || "Não informado"}
      </p>
    </div>
  );
}

function formatDateBR(date: string | null) {
  if (!date) return null;

  const [year, month, day] = date.split("-");

  if (!year || !month || !day) return date;

  return `${day}/${month}/${year}`;
}

function formatValue(value: number | string | null) {
  if (!value) return null;

  if (typeof value === "number") {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  }

  return value;
}