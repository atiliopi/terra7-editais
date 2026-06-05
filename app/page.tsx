"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { GrantStatusBadge } from "@/components/grants/GrantStatusBadge";
import { getGrantStatus } from "@/lib/grants/status";
import { supabase } from "@/lib/supabase/client";

type Grant = {
  id: string;
  created_at: string;
  title: string | null;
  state_scope: string | null;
  area: string | null;
  opening_date: string | null;
  closing_date: string | null;
  total_value: number | string | null;
  sender_name: string | null;
};


export default function Home() {
  const [databaseGrants, setDatabaseGrants] = useState<Grant[]>([]);
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [areaFilter, setAreaFilter] = useState("");
  const [senderFilter, setSenderFilter] = useState("");
  const [openingFrom, setOpeningFrom] = useState("");
  const [openingTo, setOpeningTo] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    async function loadGrants() {
      const { data, error } = await supabase
        .from("grants")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error(error);
        return;
      }

      setDatabaseGrants(data || []);
    }

    loadGrants();
  }, []);

  useEffect(() => {
  async function checkUser() {
    const { data } = await supabase.auth.getSession();

    const userId = data.session?.user.id;

    if (!userId) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();

    if (profile?.role === "admin") {
      setIsAdmin(true);
    }
  }

  checkUser();
}, []);

  const allGrants = databaseGrants;

  const grantsWithStatus = useMemo(
    () =>
      allGrants.map((grant) => ({
        ...grant,
        status: getGrantStatus(grant.opening_date, grant.closing_date),
      })),
    [allGrants]
  );

  const states = [...new Set(allGrants.map((g) => g.state_scope).filter(Boolean))];
  const areas = [...new Set(allGrants.map((g) => g.area).filter(Boolean))];
  const senders = [...new Set(allGrants.map((g) => g.sender_name).filter(Boolean))];

  const filteredGrants = useMemo(() => {
    return grantsWithStatus.filter((grant) => {
      const text = `${grant.title || ""} ${grant.area || ""} ${grant.state_scope || ""} ${grant.sender_name || ""}`.toLowerCase();

      const matchesSearch = text.includes(search.toLowerCase());
      const matchesState = !stateFilter || grant.state_scope === stateFilter;
      const matchesStatus = !statusFilter || grant.status === statusFilter;
      const matchesArea = !areaFilter || grant.area === areaFilter;
      const matchesSender = !senderFilter || grant.sender_name === senderFilter;
      const matchesOpeningFrom = !openingFrom || (grant.opening_date && grant.opening_date >= openingFrom);
      const matchesOpeningTo = !openingTo || (grant.opening_date && grant.opening_date <= openingTo);

      return matchesSearch && matchesState && matchesStatus && matchesArea && matchesSender && matchesOpeningFrom && matchesOpeningTo;
    });
  }, [search, stateFilter, statusFilter, areaFilter, senderFilter, openingFrom, openingTo, grantsWithStatus]);

  const totalPages = Math.max(1, Math.ceil(filteredGrants.length / limit));
  const paginatedGrants = filteredGrants.slice((page - 1) * limit, page * limit);

  const total = filteredGrants.length;
const opened = filteredGrants.filter((g) => g.status === "open").length;
const urgent = filteredGrants.filter((g) => g.status === "urgent").length;
const closed = filteredGrants.filter((g) => g.status === "closed").length;
const noDeadline = filteredGrants.filter((g) => g.status === "no_deadline").length;

  function resetPage() {
    setPage(1);
  }
  async function handleLogout() {
  await supabase.auth.signOut();
  window.location.href = "/login";
}

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <header className="mb-10 flex items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <img src="/logo.png" alt="Terra 7" className="h-36 w-36 object-contain opacity-95" />

            <div>
              <h1 className="text-4xl font-bold tracking-tight">Terra 7 Editais</h1>
              <p className="mt-1 text-sm text-zinc-400">
                Dashboard de catalogação e controle de oportunidades
              </p>
            </div>
          </div>

         <div className="flex items-center gap-3">
  <Link
    href="/editais/novo"
    className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-zinc-200"
  >
    Novo edital
  </Link>

  {isAdmin && (
    <Link
      href="/admin/users"
      className="rounded-xl border border-blue-600 px-4 py-2 text-sm font-semibold text-blue-400 hover:bg-blue-900/20"
    >
      Gerenciar usuários
    </Link>
  )}

  <button
    onClick={handleLogout}
    className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-300 hover:bg-zinc-900"
  >
    Sair
  </button>
</div>
        </header>

        <section className="mb-8 grid gap-4 md:grid-cols-5">
          <SummaryCard title="Total filtrado" value={total} />
          <SummaryCard title="Abertos" value={opened} color="green" />
          <SummaryCard title="Urgentes" value={urgent} color="red" />
          <SummaryCard title="Encerrados" value={closed} color="gray" />
          <SummaryCard title="Sem prazo" value={noDeadline} color="neutral" />
        </section>

        <section className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
          <div className="grid gap-4 md:grid-cols-3">
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                resetPage();
              }}
              placeholder="Buscar edital, área ou enviado por..."
              className="rounded-xl border border-zinc-800 bg-black px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500"
            />

            <select value={stateFilter} onChange={(e) => { setStateFilter(e.target.value); resetPage(); }} className="rounded-xl border border-zinc-800 bg-black px-4 py-3 text-sm text-white outline-none">
              <option value="">Todos os estados</option>
              {states.map((state) => <option key={state} value={state || ""}>{state}</option>)}
            </select>

            <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); resetPage(); }} className="rounded-xl border border-zinc-800 bg-black px-4 py-3 text-sm text-white outline-none">
              <option value="">Todos os status</option>
              <option value="Aberto">Aberto</option>
              <option value="Atenção">Atenção</option>
              <option value="Urgente">Urgente</option>
              <option value="Em breve">Em breve</option>
              <option value="Encerrado">Encerrado</option>
              <option value="Sem prazo">Sem prazo</option>
            </select>

            <select value={areaFilter} onChange={(e) => { setAreaFilter(e.target.value); resetPage(); }} className="rounded-xl border border-zinc-800 bg-black px-4 py-3 text-sm text-white outline-none">
              <option value="">Todas as áreas</option>
              {areas.map((area) => <option key={area} value={area || ""}>{area}</option>)}
            </select>

            <select value={senderFilter} onChange={(e) => { setSenderFilter(e.target.value); resetPage(); }} className="rounded-xl border border-zinc-800 bg-black px-4 py-3 text-sm text-white outline-none">
              <option value="">Todos que enviaram</option>
              {senders.map((sender) => <option key={sender} value={sender || ""}>{sender}</option>)}
            </select>

            <div>
              <p className="mb-1 text-xs text-zinc-500">Data de abertura: início e fim</p>
              <div className="grid grid-cols-2 gap-3">
                <input type="date" value={openingFrom} onChange={(e) => { setOpeningFrom(e.target.value); resetPage(); }} className="rounded-xl border border-zinc-800 bg-black px-4 py-3 text-sm text-white outline-none" />
                <input type="date" value={openingTo} onChange={(e) => { setOpeningTo(e.target.value); resetPage(); }} className="rounded-xl border border-zinc-800 bg-black px-4 py-3 text-sm text-white outline-none" />
              </div>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-zinc-900 text-zinc-400">
              <tr>
                <th className="px-4 py-4">ID</th>
                <th className="px-4 py-4">Edital</th>
                <th className="px-4 py-4">Estado</th>
                <th className="px-4 py-4">Área</th>
                <th className="px-4 py-4">Encerramento</th>
                <th className="px-4 py-4">Status</th>
                <th className="px-4 py-4">Valor</th>
                <th className="px-4 py-4">Enviado por</th>
                <th className="px-4 py-4">Ação</th>
              </tr>
            </thead>

            <tbody>
              {paginatedGrants.map((grant) => (
                <tr key={grant.id} className="border-t border-zinc-800 hover:bg-zinc-900/70">
                  <td className="px-4 py-4 text-zinc-500">
  {grant.code
    ? grant.code.replace("EDITAL-", "")
    : grant.id.slice(0, 8)}
</td>
                 <td className="max-w-[200px] px-4 py-4 font-medium text-white">
  <span
    title={grant.title || ""}
    className="block leading-5 whitespace-pre-line break-words"
  >
    {grant.title
      ? grant.title
          .slice(0, 50) // limite total
          .match(/.{1,25}/g) // quebra a cada 25
          ?.join("\n")
      : "Sem título"}
  </span>
</td>
                  <td className="px-4 py-4 text-zinc-300">{grant.state_scope || "Não informado"}</td>
                  <td className="px-4 py-4 text-zinc-300">{grant.area || "Não informado"}</td>
                  <td className="px-4 py-4 text-zinc-300">{formatDateBR(grant.closing_date)}</td>
                  <td className="px-4 py-4"><GrantStatusBadge status={grant.status} /></td>
                  <td className="px-4 py-4 text-zinc-300">{formatValue(grant.total_value)}</td>
                  <td className="px-4 py-4 text-zinc-300">{grant.sender_name || "Não informado"}</td>
                  <td className="px-4 py-4">
                    <Link href={`/editais/${grant.id}`} className="rounded-lg border border-zinc-700 px-3 py-1 text-xs text-zinc-200 hover:bg-zinc-800">
                      Ver detalhes
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <div className="mt-4 flex flex-col gap-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <span>Mostrar:</span>
            {[10, 20, 40].map((size) => (
              <button key={size} onClick={() => { setLimit(size); setPage(1); }} className={`rounded-lg border px-3 py-1 text-sm ${limit === size ? "border-white bg-white text-black" : "border-zinc-700 text-zinc-300 hover:bg-zinc-800"}`}>
                {size}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 text-sm text-zinc-400">
            <button disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded-lg border border-zinc-700 px-3 py-1 disabled:cursor-not-allowed disabled:opacity-40">
              Página anterior
            </button>

            <span>Página {page} de {totalPages}</span>

            <button disabled={page === totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} className="rounded-lg border border-zinc-700 px-3 py-1 disabled:cursor-not-allowed disabled:opacity-40">
              Próxima página
            </button>
          </div>
         </div>
      </div>

      <footer className="border-t border-zinc-800 py-6 text-center text-sm text-zinc-500">
        <p>Feito com amor em São Luís, MA 💚💛❤️</p>
        <p className="mt-1">
          © {new Date().getFullYear()} Terra7 Editais. Todos os direitos reservados.
        </p>
      </footer>
    </main>
  );
}

function SummaryCard({ title, value, color = "white" }: { title: string; value: number; color?: "white" | "green" | "red" | "gray" | "neutral" }) {
  const colors = {
    white: "text-white",
    green: "text-green-400",
    red: "text-red-400",
    gray: "text-zinc-400",
    neutral: "text-zinc-300",
  };

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
      <p className="text-sm text-zinc-500">{title}</p>
      <strong className={`mt-2 block text-3xl ${colors[color]}`}>{value}</strong>
    </div>
  );
}

function formatDateBR(date: string | null) {
  if (!date) return "Não informado";
  const [year, month, day] = date.split("-");
  if (!year || !month || !day) return date;
  return `${day}/${month}/${year}`;
}

function formatValue(value: number | string | null) {
  if (!value) return "Não informado";

  if (typeof value === "number") {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  }

  return value;
}