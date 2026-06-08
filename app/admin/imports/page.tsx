"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type ImportSource = {
  id: string;
  name: string;
  category: string;
  description: string;
  status: "active" | "soon";
  color: string;
};

const sources: ImportSource[] = [
  {
    id: "prosas",
    name: "Prosas",
    category: "Fomento e projetos",
    description: "Editais de cultura, impacto social, terceiro setor e projetos.",
    status: "active",
    color: "purple",
  },
  {
    id: "cnpq",
    name: "CNPq",
    category: "Fomento e projetos",
    description: "Chamadas de pesquisa, ciência, tecnologia e bolsas.",
    status: "soon",
    color: "blue",
  },
  {
    id: "finep",
    name: "Finep",
    category: "Fomento e projetos",
    description: "Chamadas de inovação, pesquisa e desenvolvimento.",
    status: "soon",
    color: "cyan",
  },
  {
    id: "sebrae",
    name: "Sebrae",
    category: "Empreendedorismo",
    description: "Oportunidades para negócios, startups e inovação.",
    status: "soon",
    color: "green",
  },
  {
    id: "pncp",
    name: "PNCP",
    category: "Licitações e contratações",
    description: "Contratações públicas nacionais e oportunidades oficiais.",
    status: "soon",
    color: "yellow",
  },
  {
    id: "equatorial",
    name: "Equatorial",
    category: "Energia e sustentabilidade",
    description: "Chamadas de eficiência energética, P&D e projetos sociais.",
    status: "soon",
    color: "orange",
  },
  {
    id: "mds",
    name: "MDS",
    category: "Governo federal",
    description: "Editais, chamadas e oportunidades públicas federais.",
    status: "soon",
    color: "red",
  },
  {
    id: "prefeituras-capitais",
    name: "Prefeituras das capitais",
    category: "Governos locais",
    description: "Chamamentos públicos das capitais brasileiras.",
    status: "soon",
    color: "zinc",
  },
];

const mockHistory = [
  {
    id: "1",
    source: "Prosas",
    category: "Fomento e projetos",
    imported: 0,
    duplicates: 0,
    ignored: 0,
    errors: 0,
    created_at: "Ainda não executado",
  },
];

export default function AdminImportsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [runningSource, setRunningSource] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("");

  useEffect(() => {
    async function checkAdmin() {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;

      if (!userId) {
        router.push("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();

      if (profile?.role !== "admin") {
        router.push("/");
        return;
      }

      setLoading(false);
    }

    checkAdmin();
  }, [router]);

  const categories = useMemo(() => {
    return Array.from(new Set(sources.map((source) => source.category)));
  }, []);

  const filteredSources = selectedCategory
    ? sources.filter((source) => source.category === selectedCategory)
    : sources;

  async function handleImport(source: ImportSource) {
  if (source.status !== "active") {
    alert("Essa fonte ainda está em preparação.");
    return;
  }

  setRunningSource(source.id);

  try {
    const response = await fetch(`/api/import/${source.id}`, {
      method: "POST",
    });

    const result = await response.json();

    if (!response.ok) {
      alert(result.error || "Erro ao importar editais.");
      return;
    }

    alert(result.message || "Importação concluída.");
  } finally {
    setRunningSource(null);
  }
}

  if (loading) {
    return (
      <main className="min-h-screen bg-black p-6 text-white">
        <p>Carregando...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-8">
        <header className="mb-6 rounded-3xl border border-zinc-800 bg-gradient-to-b from-zinc-950 to-black p-5 shadow-2xl shadow-black/40">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="mb-3 inline-flex rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs font-medium text-yellow-300">
                Terra7 IA
              </p>

              <h1 className="text-3xl font-bold tracking-tight">
                Importação de editais
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
                Central para importar oportunidades de fontes confiáveis, evitar
                duplicidade e alimentar o Terra7 automaticamente.
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:flex">
              <Link
                href="/"
                className="rounded-xl border border-zinc-700 px-4 py-3 text-center text-sm font-semibold text-zinc-300 hover:bg-zinc-900"
              >
                Dashboard
              </Link>

              <Link
                href="/admin/users"
                className="rounded-xl border border-blue-600 px-4 py-3 text-center text-sm font-semibold text-blue-400 hover:bg-blue-900/20"
              >
                Usuários
              </Link>
            </div>
          </div>
        </header>

        <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard title="Fontes cadastradas" value={sources.length} />
          <SummaryCard
            title="Fontes ativas"
            value={sources.filter((source) => source.status === "active").length}
            color="green"
          />
          <SummaryCard
            title="Em preparação"
            value={sources.filter((source) => source.status === "soon").length}
            color="yellow"
          />
          <SummaryCard title="Importações hoje" value={0} color="blue" />
        </section>

        <section className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
          <div className="grid gap-3 md:grid-cols-[1fr_220px]">
            <select
              value={selectedCategory}
              onChange={(event) => setSelectedCategory(event.target.value)}
              className="rounded-xl border border-zinc-800 bg-black px-4 py-3 text-sm text-white outline-none focus:border-zinc-500"
            >
              <option value="">Todas as categorias</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>

            <button
              onClick={() => setSelectedCategory("")}
              className="rounded-xl border border-zinc-700 px-4 py-3 text-sm font-semibold text-zinc-300 hover:bg-zinc-900"
            >
              Limpar filtro
            </button>
          </div>
        </section>

        <section className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredSources.map((source) => (
            <article
              key={source.id}
              className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 shadow-lg shadow-black/30"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    {source.category}
                  </p>

                  <h2 className="mt-1 text-xl font-bold text-white">
                    {source.name}
                  </h2>
                </div>

                <StatusBadge status={source.status} />
              </div>

              <p className="min-h-[48px] text-sm leading-6 text-zinc-400">
                {source.description}
              </p>

              <div className="mt-5 grid grid-cols-3 gap-2 rounded-xl border border-zinc-800 bg-black p-3 text-center text-xs">
                <MiniStat label="Importados" value="0" />
                <MiniStat label="Duplicados" value="0" />
                <MiniStat label="Ignorados" value="0" />
              </div>

              <button
                onClick={() => handleImport(source)}
                disabled={runningSource === source.id}
                className={`mt-5 w-full rounded-xl px-4 py-3 text-sm font-semibold transition ${
                  source.status === "active"
                    ? "bg-green-600 text-white hover:bg-green-700"
                    : "cursor-not-allowed border border-zinc-700 text-zinc-500"
                }`}
              >
                {source.status === "active"
                  ? runningSource === source.id
                    ? "Importando..."
                    : "Importar agora"
                  : "Em breve"}
              </button>
            </article>
          ))}
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-950">
          <div className="border-b border-zinc-800 p-5">
            <h2 className="text-xl font-semibold">Histórico de importações</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Resumo das últimas execuções por fonte.
            </p>
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-zinc-900 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-5 py-4">Data</th>
                  <th className="px-5 py-4">Fonte</th>
                  <th className="px-5 py-4">Categoria</th>
                  <th className="px-5 py-4">Importados</th>
                  <th className="px-5 py-4">Duplicados</th>
                  <th className="px-5 py-4">Encerrados ignorados</th>
                  <th className="px-5 py-4">Erros</th>
                </tr>
              </thead>

              <tbody>
                {mockHistory.map((item) => (
                  <tr key={item.id} className="border-t border-zinc-800">
                    <td className="px-5 py-4 text-zinc-400">{item.created_at}</td>
                    <td className="px-5 py-4 text-white">{item.source}</td>
                    <td className="px-5 py-4 text-zinc-300">{item.category}</td>
                    <td className="px-5 py-4 text-green-400">{item.imported}</td>
                    <td className="px-5 py-4 text-yellow-400">{item.duplicates}</td>
                    <td className="px-5 py-4 text-zinc-400">{item.ignored}</td>
                    <td className="px-5 py-4 text-red-400">{item.errors}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 p-4 md:hidden">
            {mockHistory.map((item) => (
              <article
                key={item.id}
                className="rounded-xl border border-zinc-800 bg-black p-4"
              >
                <p className="text-xs text-zinc-500">{item.created_at}</p>
                <h3 className="mt-1 font-semibold text-white">{item.source}</h3>
                <p className="text-sm text-zinc-400">{item.category}</p>

                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <MobileStat label="Importados" value={item.imported} />
                  <MobileStat label="Duplicados" value={item.duplicates} />
                  <MobileStat label="Ignorados" value={item.ignored} />
                  <MobileStat label="Erros" value={item.errors} />
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
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
  color?: "white" | "green" | "yellow" | "blue";
}) {
  const colors = {
    white: "text-white",
    green: "text-green-400",
    yellow: "text-yellow-400",
    blue: "text-blue-400",
  };

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
      <p className="text-sm text-zinc-500">{title}</p>
      <strong className={`mt-2 block text-3xl ${colors[color]}`}>
        {value}
      </strong>
    </div>
  );
}

function StatusBadge({ status }: { status: "active" | "soon" }) {
  if (status === "active") {
    return (
      <span className="rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-xs font-semibold text-green-300">
        Ativo
      </span>
    );
  }

  return (
    <span className="rounded-full border border-zinc-700 bg-zinc-800 px-3 py-1 text-xs font-semibold text-zinc-400">
      Em breve
    </span>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <strong className="block text-lg text-white">{value}</strong>
      <span className="text-zinc-500">{label}</span>
    </div>
  );
}

function MobileStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-zinc-800 p-3">
      <span className="block text-xs text-zinc-500">{label}</span>
      <strong className="text-white">{value}</strong>
    </div>
  );
}