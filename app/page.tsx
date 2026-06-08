"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { GrantStatusBadge } from "@/components/grants/GrantStatusBadge";
import { getGrantStatus } from "@/lib/grants/status";
import { supabase } from "@/lib/supabase/client";

type Grant = {
  id: string;
  code: string | null;
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
  const [userId, setUserId] = useState<string | null>(null);
  const [favoriteGrantIds, setFavoriteGrantIds] = useState<string[]>([]);
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);

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
  async function loadFavorites() {
    const { data: sessionData } = await supabase.auth.getSession();
    const currentUserId = sessionData.session?.user.id;

    if (!currentUserId) return;

    setUserId(currentUserId);

    const { data, error } = await supabase
      .from("grant_favorites")
      .select("grant_id")
      .eq("user_id", currentUserId);

    if (error) {
      console.error(error);
      return;
    }

    setFavoriteGrantIds((data || []).map((item) => item.grant_id));
  }

  loadFavorites();
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

  const grantsWithStatus = useMemo(
    () =>
      databaseGrants.map((grant) => ({
        ...grant,
        status: getGrantStatus(grant.opening_date, grant.closing_date),
      })),
    [databaseGrants]
  );

  const states = [
    ...new Set(databaseGrants.map((g) => g.state_scope).filter(Boolean)),
  ] as string[];

  const areas = [
    ...new Set(databaseGrants.map((g) => g.area).filter(Boolean)),
  ] as string[];

  const senders = [
    ...new Set(databaseGrants.map((g) => g.sender_name).filter(Boolean)),
  ] as string[];

  const filteredGrants = useMemo(() => {
    return grantsWithStatus.filter((grant) => {
      const text = `${grant.title || ""} ${grant.area || ""} ${
        grant.state_scope || ""
      } ${grant.sender_name || ""}`.toLowerCase();

      const matchesSearch = text.includes(search.toLowerCase());
      const matchesState = !stateFilter || grant.state_scope === stateFilter;
      const matchesStatus = !statusFilter || grant.status === statusFilter;
      const matchesArea = !areaFilter || grant.area === areaFilter;
      const matchesSender = !senderFilter || grant.sender_name === senderFilter;
      const matchesOpeningFrom =
        !openingFrom || (grant.opening_date && grant.opening_date >= openingFrom);
      const matchesOpeningTo =
        !openingTo || (grant.opening_date && grant.opening_date <= openingTo);
      const matchesFavorites =
        !showOnlyFavorites || favoriteGrantIds.includes(grant.id);

      return (
  matchesSearch &&
  matchesState &&
  matchesStatus &&
  matchesArea &&
  matchesSender &&
  matchesOpeningFrom &&
  matchesOpeningTo &&
  matchesFavorites
);
    });
  }, [
  search,
  stateFilter,
  statusFilter,
  areaFilter,
  senderFilter,
  openingFrom,
  openingTo,
  grantsWithStatus,
  showOnlyFavorites,
  favoriteGrantIds,
]);

  const totalPages = Math.max(1, Math.ceil(filteredGrants.length / limit));
  const paginatedGrants = filteredGrants.slice((page - 1) * limit, page * limit);

  const total = filteredGrants.length;
  const opened = filteredGrants.filter((g) => g.status === "open").length;
  const attention = filteredGrants.filter(
  (g) => g.status === "attention"
).length;
  const urgent = filteredGrants.filter((g) => g.status === "urgent").length;
  const closed = filteredGrants.filter((g) => g.status === "closed").length;
  const noDeadline = filteredGrants.filter((g) => g.status === "no_deadline").length;

  async function toggleFavorite(grantId: string) {
  if (!userId) {
    alert("Faça login para favoritar editais.");
    return;
  }

  const isFavorite = favoriteGrantIds.includes(grantId);

  if (isFavorite) {
    const { error } = await supabase
      .from("grant_favorites")
      .delete()
      .eq("user_id", userId)
      .eq("grant_id", grantId);

    if (error) {
      alert("Erro ao remover favorito.");
      return;
    }

    setFavoriteGrantIds((current) =>
      current.filter((id) => id !== grantId)
    );

    return;
  }

  const { error } = await supabase.from("grant_favorites").insert([
    {
      user_id: userId,
      grant_id: grantId,
    },
  ]);

  if (error) {
    alert("Erro ao adicionar favorito.");
    return;
  }

  setFavoriteGrantIds((current) => [...current, grantId]);
}
  
  function resetPage() {
    setPage(1);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-8">
        <header className="mb-8 rounded-3xl border border-zinc-800 bg-zinc-950/80 p-4 shadow-2xl shadow-black/40 sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
              <img
                src="/logo.png"
                alt="Terra 7"
                className="h-24 w-24 object-contain opacity-95 sm:h-28 sm:w-28 lg:h-32 lg:w-32"
              />

              <div>
                <p className="mb-2 inline-flex rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-xs font-medium text-green-300">
                  Painel oficial
                </p>

                <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  Terra 7 Editais
                </h1>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
                  Dashboard de catalogação, controle e consulta de oportunidades.
                </p>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-3 lg:flex lg:items-center">
              <Link
                href="/editais/novo"
                className="rounded-xl bg-white px-4 py-3 text-center text-sm font-semibold text-black hover:bg-zinc-200"
              >
                Novo edital
              </Link>

              {isAdmin && (
                <Link
                  href="/admin/users"
                  className="rounded-xl border border-blue-600 px-4 py-3 text-center text-sm font-semibold text-blue-400 hover:bg-blue-900/20"
                >
                  Usuários
                </Link>
              )}

              <button
                onClick={handleLogout}
                className="rounded-xl border border-zinc-700 px-4 py-3 text-sm font-semibold text-zinc-300 hover:bg-zinc-900"
              >
                Sair
              </button>
            </div>
          </div>
        </header>

        <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
  <SummaryCard title="Total" value={total} />
  <SummaryCard title="Abertos" value={opened} color="green" />
  <SummaryCard title="Atenção" value={attention} color="yellow" />
  <SummaryCard title="Urgentes" value={urgent} color="red" />
  <SummaryCard title="Encerrados" value={closed} color="gray" />
  <SummaryCard title="Sem prazo" value={noDeadline} color="neutral" />
</section>

        <section className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                resetPage();
              }}
              placeholder="Buscar por título, área, estado..."
              className="rounded-xl border border-zinc-800 bg-black px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-zinc-500"
            />

            <select
              value={stateFilter}
              onChange={(event) => {
                setStateFilter(event.target.value);
                resetPage();
              }}
              className="rounded-xl border border-zinc-800 bg-black px-4 py-3 text-sm text-white outline-none focus:border-zinc-500"
            >
              <option value="">Todos os estados</option>
              {states.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>

            <select
              value={areaFilter}
              onChange={(event) => {
                setAreaFilter(event.target.value);
                resetPage();
              }}
              className="rounded-xl border border-zinc-800 bg-black px-4 py-3 text-sm text-white outline-none focus:border-zinc-500"
            >
              <option value="">Todas as áreas</option>
              {areas.map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                resetPage();
              }}
              className="rounded-xl border border-zinc-800 bg-black px-4 py-3 text-sm text-white outline-none focus:border-zinc-500"
            >
              <option value="">Todos os status</option>
              <option value="open">Aberto</option>
              <option value="attention">Atenção</option>
              <option value="urgent">Urgente</option>
              <option value="closed">Encerrado</option>
              <option value="no_deadline">Sem prazo</option>
            </select>

            <button
  type="button"
  onClick={() => {
    setShowOnlyFavorites((current) => !current);
    resetPage();
  }}
  className={`rounded-xl border px-4 py-3 text-sm font-medium transition ${
    showOnlyFavorites
      ? "border-yellow-500 bg-yellow-500/10 text-yellow-400"
      : "border-zinc-800 bg-black text-zinc-300"
  }`}
>
  {showOnlyFavorites
  ? `★ Meus favoritos (${favoriteGrantIds.length})`
  : `☆ Meus favoritos (${favoriteGrantIds.length})`}
</button>

            <select
              value={senderFilter}
              onChange={(event) => {
                setSenderFilter(event.target.value);
                resetPage();
              }}
              className="rounded-xl border border-zinc-800 bg-black px-4 py-3 text-sm text-white outline-none focus:border-zinc-500"
            >
              <option value="">Todos os remetentes</option>
              {senders.map((sender) => (
                <option key={sender} value={sender}>
                  {sender}
                </option>
              ))}
            </select>

            <label className="flex flex-col gap-2">
  <span className="text-xs font-medium text-zinc-500">
    Data inicial
  </span>

  <input
    type="date"
    value={openingFrom}
    onChange={(event) => {
      setOpeningFrom(event.target.value);
      resetPage();
    }}
    className="rounded-xl border border-zinc-800 bg-black px-4 py-3 text-sm text-white outline-none focus:border-zinc-500"
  />
</label>

<label className="flex flex-col gap-2">
  <span className="text-xs font-medium text-zinc-500">
    Data final
  </span>

  <input
    type="date"
    value={openingTo}
    onChange={(event) => {
      setOpeningTo(event.target.value);
      resetPage();
    }}
    className="rounded-xl border border-zinc-800 bg-black px-4 py-3 text-sm text-white outline-none focus:border-zinc-500"
  />
</label>

            <button
              onClick={() => {
                setSearch("");
                setStateFilter("");
                setStatusFilter("");
                setAreaFilter("");
                setSenderFilter("");
                setOpeningFrom("");
                setOpeningTo("");
                setPage(1);
              }}
              className="rounded-xl border border-zinc-700 px-4 py-3 text-sm font-semibold text-zinc-300 hover:bg-zinc-900"
            >
              Limpar filtros
            </button>
          </div>
        </section>

        <section className="hidden overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950 md:block">
          <table className="min-w-[1180px] w-full border-collapse text-left text-sm">
            <thead className="bg-zinc-900 text-xs uppercase tracking-wide text-zinc-500">
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
              {paginatedGrants.map((grant, index) => (
                <tr
                  key={grant.id}
                  className="border-t border-zinc-800 hover:bg-zinc-900/70"
                >
                  <td className="px-4 py-4 text-zinc-500">
  <div className="flex items-center gap-2">
    <button
      type="button"
      onClick={() => toggleFavorite(grant.id)}
      className="text-lg text-yellow-400 hover:scale-110"
      title={
        favoriteGrantIds.includes(grant.id)
          ? "Remover dos favoritos"
          : "Adicionar aos favoritos"
      }
    >
      {favoriteGrantIds.includes(grant.id) ? "★" : "☆"}
    </button>

    <span>
  {String(filteredGrants.length - ((page - 1) * limit + index)).padStart(4, "0")}
</span>
  </div>
</td>

                  <td className="max-w-[240px] px-4 py-4 font-medium text-white">
                    <span title={grant.title || ""} className="line-clamp-2">
                      {grant.title || "Sem título"}
                    </span>
                  </td>

                  <td className="px-4 py-4 text-zinc-300">
                    {grant.state_scope || "Não informado"}
                  </td>

                  <td className="px-4 py-4 text-zinc-300">
                    {grant.area || "Não informado"}
                  </td>

                  <td className="px-4 py-4 text-zinc-300">
                    {formatDateBR(grant.closing_date)}
                  </td>

                  <td className="whitespace-nowrap px-4 py-4">
                   <GrantStatusBadge status={grant.status} />
                  </td>

                  <td className="px-4 py-4 text-zinc-300">
                    {formatValue(grant.total_value)}
                  </td>

                  <td className="px-4 py-4 text-zinc-300">
                    {grant.sender_name || "Não informado"}
                  </td>

                  <td className="whitespace-nowrap px-4 py-4">
                    <Link
                      href={`/editais/${grant.id}`}
                      className="inline-flex min-w-[120px] justify-center whitespace-nowrap rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
                    >
                      Ver detalhes
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="grid gap-4 md:hidden">
          {paginatedGrants.map((grant, index) => (
            <article
              key={grant.id}
              className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 shadow-lg shadow-black/30"
            >
              <div className="mb-3 flex items-start justify-between gap-3">
  <div className="flex items-start gap-2">
    <button
      type="button"
      onClick={() => toggleFavorite(grant.id)}
      className="mt-1 text-xl text-yellow-400"
      title={
        favoriteGrantIds.includes(grant.id)
          ? "Remover dos favoritos"
          : "Adicionar aos favoritos"
      }
    >
      {favoriteGrantIds.includes(grant.id) ? "★" : "☆"}
    </button>

    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {String(
  filteredGrants.length - ((page - 1) * limit + index)
).padStart(4, "0")}
      </p>

      <h2 className="mt-1 text-base font-semibold leading-6 text-white">
        {grant.title || "Sem título"}
      </h2>
    </div>
  </div>

  <GrantStatusBadge status={grant.status} />
</div>

              <div className="grid gap-2 text-sm text-zinc-300">
                <MobileInfo label="Estado" value={grant.state_scope || "Não informado"} />
                <MobileInfo label="Área" value={grant.area || "Não informado"} />
                <MobileInfo label="Encerramento" value={formatDateBR(grant.closing_date)} />
                <MobileInfo label="Valor" value={formatValue(grant.total_value)} />
                <MobileInfo label="Enviado por" value={grant.sender_name || "Não informado"} />
              </div>

              <Link
                href={`/editais/${grant.id}`}
                className="mt-4 block rounded-xl bg-white px-4 py-3 text-center text-sm font-semibold text-black hover:bg-zinc-200"
              >
                Ver detalhes
              </Link>
            </article>
          ))}
        </section>

        <div className="mt-4 flex flex-col gap-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-400">
            <span>Mostrar:</span>

            {[10, 20, 40].map((size) => (
              <button
                key={size}
                onClick={() => {
                  setLimit(size);
                  setPage(1);
                }}
                className={`rounded-lg border px-3 py-2 text-sm ${
                  limit === size
                    ? "border-white bg-white text-black"
                    : "border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                }`}
              >
                {size}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-3 text-sm text-zinc-400 sm:flex-row sm:items-center">
            <button
              disabled={page === 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="rounded-lg border border-zinc-700 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Página anterior
            </button>

            <span className="text-center">
              Página {page} de {totalPages}
            </span>

            <button
              disabled={page === totalPages}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              className="rounded-lg border border-zinc-700 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Próxima página
            </button>
          </div>
        </div>
      </div>

      <footer className="border-t border-zinc-800 px-4 py-6 text-center text-sm text-zinc-500">
        <p>Feito com amor em São Luís, MA 💚💛❤️</p>
        <p className="mt-1">
          © {new Date().getFullYear()} Terra7 Editais. Todos os direitos reservados.
        </p>
      </footer>
    </main>
  );
}

function SummaryCard({
  title,
  value,
  color = "white",
}: {
  title: string;
  value: number;
  color?: "white" | "green" | "yellow" |"red" | "gray" | "neutral";
}) {
const colors = {
  white: "text-white",
  green: "text-green-400",
  yellow: "text-yellow-400",
  red: "text-red-400",
  gray: "text-zinc-400",
  neutral: "text-zinc-300",
};

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 sm:p-5">
      <p className="text-sm text-zinc-500">{title}</p>
      <strong className={`mt-2 block text-2xl sm:text-3xl ${colors[color]}`}>
        {value}
      </strong>
    </div>
  );
}

function MobileInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-t border-zinc-800 pt-2">
      <span className="text-zinc-500">{label}</span>
      <strong className="text-right font-medium text-zinc-200">{value}</strong>
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