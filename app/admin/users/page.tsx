"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
  status: string | null;
};

type NewUser = {
  full_name: string;
  email: string;
  phone: string;
  password: string;
  role: string;
  status: string;
};

const inputClass =
  "w-full rounded-xl border border-zinc-700 bg-black px-3 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-zinc-500";

const buttonClass =
  "inline-flex items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60";

const actionButtonClass =
  "inline-flex h-9 items-center justify-center rounded-lg px-3 text-[11px] font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60";

export default function AdminUsersPage() {
  const router = useRouter();

  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  const [newUser, setNewUser] = useState<NewUser>({
    full_name: "",
    email: "",
    phone: "",
    password: "",
    role: "viewer",
    status: "approved",
  });

  async function loadUsers() {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;

    if (!userId) {
      router.push("/login");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role,status")
      .eq("id", userId)
      .single();

    if (!profile || profile.role !== "admin") {
      router.push("/");
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      alert("Erro ao carregar usuários.");
      setLoading(false);
      return;
    }

    setUsers(data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const text = `${user.full_name || ""} ${user.email || ""} ${
        user.phone || ""
      }`.toLowerCase();

      return (
        text.includes(search.toLowerCase()) &&
        (!statusFilter || user.status === statusFilter) &&
        (!roleFilter || user.role === roleFilter)
      );
    });
  }, [users, search, statusFilter, roleFilter]);

  function getInitials(name: string | null, email: string | null) {
    const base = name || email || "U";

    return base
      .split(" ")
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();
  }

  async function updateUser(id: string, values: Partial<Profile>) {
    setSavingId(id);

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: values.full_name,
        email: values.email,
        phone: values.phone,
        role: values.role,
        status: values.status,
      })
      .eq("id", id);

    setSavingId(null);

    if (error) {
      alert("Erro ao salvar usuário.");
      return;
    }

    await loadUsers();
  }

  function handleChange(id: string, field: keyof Profile, value: string) {
    setUsers((prev) =>
      prev.map((user) =>
        user.id === id ? { ...user, [field]: value } : user
      )
    );
  }

  async function createUser(event: FormEvent) {
    event.preventDefault();

    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;

    if (!accessToken) {
      alert("Sessão expirada. Faça login novamente.");
      router.push("/login");
      return;
    }

    const response = await fetch("/api/admin/create-user", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(newUser),
    });

    const result = await response.json();

    if (!response.ok) {
      alert(result.error || "Erro ao criar usuário.");
      return;
    }

    alert("Usuário criado com sucesso.");

    setNewUser({
      full_name: "",
      email: "",
      phone: "",
      password: "",
      role: "viewer",
      status: "approved",
    });

    setShowCreateForm(false);
    await loadUsers();
  }

  async function resetPassword(userId: string) {
    const newPassword = prompt("Digite a nova senha para este usuário:");

    if (!newPassword) return;

    if (newPassword.length < 6) {
      alert("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }

    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;

    if (!accessToken) {
      alert("Sessão expirada. Faça login novamente.");
      router.push("/login");
      return;
    }

    const response = await fetch("/api/admin/reset-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        userId,
        newPassword,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      alert(result.error || "Erro ao redefinir senha.");
      return;
    }

    alert("Senha redefinida com sucesso.");
  }

  async function deleteUser(userId: string) {
    const confirmDelete = confirm("Tem certeza que deseja excluir este usuário?");

    if (!confirmDelete) return;

    const { error } = await supabase.from("profiles").delete().eq("id", userId);

    if (error) {
      alert("Erro ao excluir usuário.");
      return;
    }

    await loadUsers();
  }

  function exportUsersCsv() {
    const headers = ["Nome", "Email", "Telefone"];

    const rows = users.map((user) => [
      user.full_name || "",
      user.email || "",
      user.phone || "",
    ]);

    const csvContent = [headers, ...rows]
      .map((row) =>
        row
          .map((value) => `"${String(value).replaceAll('"', '""')}"`)
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "usuarios-meta-ads-terra7.csv";
    link.click();

    URL.revokeObjectURL(url);
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
      <div className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6 sm:py-8">
        <header className="mb-6 rounded-3xl border border-zinc-800 bg-gradient-to-b from-zinc-950 to-black p-5 shadow-2xl shadow-black/40">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-600/20 text-3xl">
                👥
              </div>

              <div>
                <h1 className="text-3xl font-bold tracking-tight">Usuários</h1>
                <p className="mt-1 text-sm text-zinc-400">
                  Gerencie os usuários do sistema
                </p>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-3 lg:flex">
              <button
                onClick={() => setShowCreateForm((current) => !current)}
                className={`${buttonClass} bg-purple-600 text-white hover:bg-purple-700`}
              >
                + Novo usuário
              </button>

              <button
                onClick={exportUsersCsv}
                className={`${buttonClass} bg-green-600 text-white hover:bg-green-700`}
              >
                Exportar público Meta Ads
              </button>

              <a
                href="/"
                className={`${buttonClass} border border-zinc-700 text-zinc-300 hover:bg-zinc-900`}
              >
                Dashboard
              </a>
            </div>
          </div>

          <div className="mt-6 grid gap-3 lg:grid-cols-[1fr_240px_220px_150px]">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nome, email ou telefone..."
              className={inputClass}
            />

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className={inputClass}
            >
              <option value="">Todos os status</option>
              <option value="approved">Aprovado</option>
              <option value="pending">Pendente</option>
              <option value="blocked">Bloqueado</option>
            </select>

            <select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value)}
              className={inputClass}
            >
              <option value="">Todos os perfis</option>
              <option value="viewer">Usuário</option>
              <option value="admin">Admin</option>
            </select>

            <button
              onClick={() => {
                setSearch("");
                setStatusFilter("");
                setRoleFilter("");
              }}
              className={`${buttonClass} border border-zinc-700 text-zinc-300 hover:bg-zinc-900`}
            >
              ↻ Limpar
            </button>
          </div>
        </header>

        {showCreateForm && (
          <form
            onSubmit={createUser}
            className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 sm:p-6"
          >
            <h2 className="mb-4 text-xl font-semibold">Criar usuário</h2>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <label>
                <span className="mb-2 block text-sm text-zinc-400">Nome</span>
                <input
                  value={newUser.full_name}
                  onChange={(event) =>
                    setNewUser({ ...newUser, full_name: event.target.value })
                  }
                  required
                  placeholder="Nome completo"
                  className={inputClass}
                />
              </label>

              <label>
                <span className="mb-2 block text-sm text-zinc-400">Email</span>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(event) =>
                    setNewUser({ ...newUser, email: event.target.value })
                  }
                  required
                  placeholder="email@exemplo.com"
                  className={inputClass}
                />
              </label>

              <label>
                <span className="mb-2 block text-sm text-zinc-400">
                  Telefone
                </span>
                <input
                  value={newUser.phone}
                  onChange={(event) =>
                    setNewUser({ ...newUser, phone: event.target.value })
                  }
                  placeholder="5598999999999"
                  className={inputClass}
                />
              </label>

              <label>
                <span className="mb-2 block text-sm text-zinc-400">
                  Senha inicial
                </span>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(event) =>
                    setNewUser({ ...newUser, password: event.target.value })
                  }
                  required
                  placeholder="Senha do usuário"
                  className={inputClass}
                />
              </label>

              <label>
                <span className="mb-2 block text-sm text-zinc-400">
                  Tipo de usuário
                </span>
                <select
                  value={newUser.role}
                  onChange={(event) =>
                    setNewUser({ ...newUser, role: event.target.value })
                  }
                  className={inputClass}
                >
                  <option value="viewer">Usuário comum</option>
                  <option value="admin">Admin</option>
                </select>
              </label>

              <label>
                <span className="mb-2 block text-sm text-zinc-400">Status</span>
                <select
                  value={newUser.status}
                  onChange={(event) =>
                    setNewUser({ ...newUser, status: event.target.value })
                  }
                  className={inputClass}
                >
                  <option value="approved">Aprovado</option>
                  <option value="pending">Pendente</option>
                  <option value="blocked">Bloqueado</option>
                </select>
              </label>
            </div>

            <button
              type="submit"
              className="mt-5 w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 sm:w-auto"
            >
              Criar usuário
            </button>
          </form>
        )}

        <section className="hidden rounded-2xl border border-zinc-800 bg-zinc-950 xl:block">
          <table className="w-full table-fixed text-left text-sm">
            <colgroup>
              <col className="w-[21%]" />
              <col className="w-[22%]" />
              <col className="w-[15%]" />
              <col className="w-[11%]" />
              <col className="w-[10%]" />
              <col className="w-[21%]" />
            </colgroup>

            <thead className="bg-zinc-900 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-4">Nome</th>
                <th className="px-4 py-4">Email</th>
                <th className="px-4 py-4">Telefone</th>
                <th className="px-4 py-4">Status</th>
                <th className="px-4 py-4">Perfil</th>
                <th className="px-4 py-4">Ações</th>
              </tr>
            </thead>

            <tbody>
              {filteredUsers.map((user) => (
                <tr
                  key={user.id}
                  className="border-t border-zinc-800 hover:bg-zinc-900/40"
                >
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-purple-700 text-xs font-bold">
                        {getInitials(user.full_name, user.email)}
                      </div>

                      <input
                        value={user.full_name || ""}
                        onChange={(event) =>
                          handleChange(user.id, "full_name", event.target.value)
                        }
                        className="min-w-0 flex-1 border-none bg-transparent text-sm font-semibold text-white outline-none"
                      />
                    </div>
                  </td>

                  <td className="px-4 py-4">
                    <input
                      value={user.email || ""}
                      onChange={(event) =>
                        handleChange(user.id, "email", event.target.value)
                      }
                      className="w-full border-none bg-transparent text-sm text-white outline-none"
                    />
                  </td>

                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <span className="shrink-0 text-green-400">☘</span>
                      <input
                        value={user.phone || ""}
                        onChange={(event) =>
                          handleChange(user.id, "phone", event.target.value)
                        }
                        className="min-w-0 flex-1 border-none bg-transparent text-sm text-white outline-none"
                      />
                    </div>
                  </td>

                  <td className="px-4 py-4">
                    <select
                      value={user.status || "pending"}
                      onChange={(event) =>
                        handleChange(user.id, "status", event.target.value)
                      }
                      className={`w-full rounded-lg border px-2 py-2 text-xs font-semibold outline-none ${
                        user.status === "approved"
                          ? "border-green-500/30 bg-green-500/10 text-green-300"
                          : user.status === "blocked"
                          ? "border-red-500/30 bg-red-500/10 text-red-300"
                          : "border-yellow-500/30 bg-yellow-500/10 text-yellow-300"
                      }`}
                    >
                      <option value="pending">Pendente</option>
                      <option value="approved">Aprovado</option>
                      <option value="blocked">Bloqueado</option>
                    </select>
                  </td>

                  <td className="px-4 py-4">
                    <select
                      value={user.role || "viewer"}
                      onChange={(event) =>
                        handleChange(user.id, "role", event.target.value)
                      }
                      className="w-full rounded-lg border border-blue-500/30 bg-blue-500/10 px-2 py-2 text-xs font-semibold text-blue-200 outline-none"
                    >
                      <option value="viewer">Usuário</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>

                  <td className="px-4 py-4">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => updateUser(user.id, user)}
                        disabled={savingId === user.id}
                        className={`${actionButtonClass} bg-blue-600 hover:bg-blue-700`}
                      >
                        💾 {savingId === user.id ? "..." : "Salvar"}
                      </button>

                      <button
                        onClick={() =>
                          updateUser(user.id, { ...user, status: "approved" })
                        }
                        className={`${actionButtonClass} bg-green-600 hover:bg-green-700`}
                      >
                        ✓ Aprovar
                      </button>

                      <button
                        onClick={() => resetPassword(user.id)}
                        className={`${actionButtonClass} bg-purple-600 hover:bg-purple-700`}
                      >
                        🔑 Senha
                      </button>

                      <button
                        onClick={() =>
                          updateUser(user.id, { ...user, status: "blocked" })
                        }
                        className={`${actionButtonClass} bg-red-600 hover:bg-red-700`}
                      >
                        🔒 Bloquear
                      </button>

                      <button
                        onClick={() => deleteUser(user.id)}
                        className={`${actionButtonClass} col-span-2 bg-zinc-700 hover:bg-zinc-600`}
                      >
                        🗑 Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex items-center justify-between border-t border-zinc-800 px-5 py-4 text-sm text-zinc-400">
            <span>
              Mostrando {filteredUsers.length} de {users.length} usuários
            </span>

            <div className="flex items-center gap-2">
              <button className="rounded-lg border border-zinc-800 px-4 py-2 text-zinc-600">
                Anterior
              </button>
              <span className="rounded-lg bg-purple-600 px-4 py-2 font-semibold text-white">
                1
              </span>
              <button className="rounded-lg border border-zinc-800 px-4 py-2 text-zinc-600">
                Próximo
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:hidden">
          {filteredUsers.map((user) => (
            <article
              key={user.id}
              className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 shadow-lg shadow-black/30"
            >
              <div className="mb-4 flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-purple-700 text-sm font-bold">
                  {getInitials(user.full_name, user.email)}
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-semibold text-white">
                    {user.full_name || "Sem nome"}
                  </h3>
                  <p className="mt-1 break-all text-sm text-zinc-400">
                    {user.email || "Email não informado"}
                  </p>
                  <p className="mt-1 text-sm text-green-400">
                    ☘ {user.phone || "Telefone não informado"}
                  </p>
                </div>
              </div>

              <div className="grid gap-3">
                <label>
                  <span className="mb-2 block text-sm text-zinc-400">Nome</span>
                  <input
                    value={user.full_name || ""}
                    onChange={(event) =>
                      handleChange(user.id, "full_name", event.target.value)
                    }
                    className={inputClass}
                  />
                </label>

                <label>
                  <span className="mb-2 block text-sm text-zinc-400">Email</span>
                  <input
                    value={user.email || ""}
                    onChange={(event) =>
                      handleChange(user.id, "email", event.target.value)
                    }
                    className={inputClass}
                  />
                </label>

                <label>
                  <span className="mb-2 block text-sm text-zinc-400">
                    Telefone
                  </span>
                  <input
                    value={user.phone || ""}
                    onChange={(event) =>
                      handleChange(user.id, "phone", event.target.value)
                    }
                    className={inputClass}
                  />
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label>
                    <span className="mb-2 block text-sm text-zinc-400">
                      Status
                    </span>
                    <select
                      value={user.status || "pending"}
                      onChange={(event) =>
                        handleChange(user.id, "status", event.target.value)
                      }
                      className={inputClass}
                    >
                      <option value="pending">Pendente</option>
                      <option value="approved">Aprovado</option>
                      <option value="blocked">Bloqueado</option>
                    </select>
                  </label>

                  <label>
                    <span className="mb-2 block text-sm text-zinc-400">
                      Perfil
                    </span>
                    <select
                      value={user.role || "viewer"}
                      onChange={(event) =>
                        handleChange(user.id, "role", event.target.value)
                      }
                      className={inputClass}
                    >
                      <option value="viewer">Usuário</option>
                      <option value="admin">Admin</option>
                    </select>
                  </label>
                </div>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <button
                  onClick={() => updateUser(user.id, user)}
                  disabled={savingId === user.id}
                  className={`${buttonClass} bg-blue-600 text-white hover:bg-blue-700`}
                >
                  💾 {savingId === user.id ? "Salvando..." : "Salvar"}
                </button>

                <button
                  onClick={() =>
                    updateUser(user.id, { ...user, status: "approved" })
                  }
                  className={`${buttonClass} bg-green-600 text-white hover:bg-green-700`}
                >
                  ✓ Aprovar
                </button>

                <button
                  onClick={() => resetPassword(user.id)}
                  className={`${buttonClass} bg-purple-600 text-white hover:bg-purple-700`}
                >
                  🔑 Redefinir senha
                </button>

                <button
                  onClick={() =>
                    updateUser(user.id, { ...user, status: "blocked" })
                  }
                  className={`${buttonClass} bg-red-600 text-white hover:bg-red-700`}
                >
                  🔒 Bloquear
                </button>

                <button
                  onClick={() => deleteUser(user.id)}
                  className={`${buttonClass} bg-zinc-700 text-white hover:bg-zinc-600 sm:col-span-2`}
                >
                  🗑 Excluir
                </button>
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}