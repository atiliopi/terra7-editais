"use client";

import { useEffect, useState, type FormEvent } from "react";
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

const smallInputClass =
  "w-full min-w-[160px] rounded-lg border border-zinc-700 bg-black px-3 py-2 text-sm text-white outline-none focus:border-zinc-500";

const buttonClass =
  "rounded-xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60";

export default function AdminUsersPage() {
  const router = useRouter();

  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

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

  function handleChange(id: string, field: keyof Profile, value: string) {
    setUsers((prev) =>
      prev.map((user) =>
        user.id === id ? { ...user, [field]: value } : user
      )
    );
  }

  async function updateUser(id: string, values: Partial<Profile>) {
    setSavingId(id);

    const payload = {
      full_name: values.full_name,
      email: values.email,
      phone: values.phone,
      role: values.role,
      status: values.status,
    };

    const { error } = await supabase
      .from("profiles")
      .update(payload)
      .eq("id", id);

    setSavingId(null);

    if (error) {
      alert("Erro ao salvar usuário.");
      return;
    }

    await loadUsers();
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

    const { error } = await supabase
      .from("profiles")
      .delete()
      .eq("id", userId);

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
                <p className="mb-2 inline-flex rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-300">
                  Área administrativa
                </p>

                <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  Gerenciar usuários
                </h1>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
                  Crie, aprove, bloqueie e organize os usuários do Terra7.
                </p>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:flex lg:items-center">
              <button
                onClick={exportUsersCsv}
                className={`${buttonClass} bg-green-600 text-white hover:bg-green-700`}
              >
                Exportar público Meta Ads
              </button>

              <a
                href="/"
                className={`${buttonClass} border border-zinc-700 text-center text-zinc-300 hover:bg-zinc-900`}
              >
                Dashboard
              </a>
            </div>
          </div>
        </header>

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
              <span className="mb-2 block text-sm text-zinc-400">Telefone</span>
              <input
                value={newUser.phone}
                onChange={(event) =>
                  setNewUser({ ...newUser, phone: event.target.value })
                }
                placeholder="(00) 00000-0000"
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

        <section className="hidden overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950 lg:block">
          <table className="w-full min-w-[1180px] text-left text-sm">
            <thead className="bg-zinc-900 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-4">Nome</th>
                <th className="px-4 py-4">Email</th>
                <th className="px-4 py-4">Telefone</th>
                <th className="px-4 py-4">Status</th>
                <th className="px-4 py-4">Perfil</th>
                <th className="px-4 py-4 text-right">Ações</th>
              </tr>
            </thead>

            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t border-zinc-800">
                  <td className="px-4 py-4">
                    <input
                      value={user.full_name || ""}
                      onChange={(event) =>
                        handleChange(user.id, "full_name", event.target.value)
                      }
                      className={smallInputClass}
                    />
                  </td>

                  <td className="px-4 py-4">
                    <input
                      value={user.email || ""}
                      onChange={(event) =>
                        handleChange(user.id, "email", event.target.value)
                      }
                      className={smallInputClass}
                    />
                  </td>

                  <td className="px-4 py-4">
                    <input
                      value={user.phone || ""}
                      onChange={(event) =>
                        handleChange(user.id, "phone", event.target.value)
                      }
                      className={smallInputClass}
                    />
                  </td>

                  <td className="px-4 py-4">
                    <select
                      value={user.status || "pending"}
                      onChange={(event) =>
                        handleChange(user.id, "status", event.target.value)
                      }
                      className={smallInputClass}
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
                      className={smallInputClass}
                    >
                      <option value="viewer">Usuário</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>

                  <td className="px-4 py-4 align-middle">
                     <div className="grid min-w-[300px] grid-cols-2 gap-2">
                      <button
                        onClick={() => updateUser(user.id, user)}
                        disabled={savingId === user.id}
                        className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                      >
                        {savingId === user.id ? "Salvando..." : "Salvar"}
                      </button>

                      <button
                        onClick={() =>
                          updateUser(user.id, { ...user, status: "approved" })
                        }
                        className="rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-700"
                      >
                        Aprovar
                      </button>

                      <button
                        onClick={() => resetPassword(user.id)}
                        className="rounded-lg bg-purple-600 px-3 py-2 text-xs font-semibold text-white hover:bg-purple-700"
                      >
                        Redefinir senha
                      </button>

                      <button
                        onClick={() =>
                          updateUser(user.id, { ...user, status: "blocked" })
                        }
                        className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700"
                      >
                        Bloquear
                      </button>

                      <button
                        onClick={() => deleteUser(user.id)}
                        className="col-span-2 rounded-lg bg-zinc-700 px-3 py-2 text-xs font-semibold text-white hover:bg-zinc-600"
                      >
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="grid gap-4 lg:hidden">
          {users.map((user) => (
            <article
              key={user.id}
              className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 shadow-lg shadow-black/30"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-zinc-500">
                    Usuário
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-white">
                    {user.full_name || "Sem nome"}
                  </h3>
                  <p className="mt-1 break-all text-sm text-zinc-400">
                    {user.email || "Email não informado"}
                  </p>
                </div>

                <span className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300">
                  {user.status || "pending"}
                </span>
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
                  {savingId === user.id ? "Salvando..." : "Salvar"}
                </button>

                <button
                  onClick={() =>
                    updateUser(user.id, { ...user, status: "approved" })
                  }
                  className={`${buttonClass} bg-green-600 text-white hover:bg-green-700`}
                >
                  Aprovar
                </button>

                <button
                  onClick={() => resetPassword(user.id)}
                  className={`${buttonClass} bg-purple-600 text-white hover:bg-purple-700`}
                >
                  Redefinir senha
                </button>

                <button
                  onClick={() =>
                    updateUser(user.id, { ...user, status: "blocked" })
                  }
                  className={`${buttonClass} bg-red-600 text-white hover:bg-red-700`}
                >
                  Bloquear
                </button>

                <button
                  onClick={() => deleteUser(user.id)}
                  className={`${buttonClass} bg-zinc-700 text-white hover:bg-zinc-600 sm:col-span-2`}
                >
                  Excluir
                </button>
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}