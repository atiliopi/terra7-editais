"use client";

import { useEffect, useState } from "react";
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

export default function AdminUsersPage() {
  const router = useRouter();

  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [newUser, setNewUser] = useState({
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

    const { data } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    setUsers(data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function updateUser(id: string, values: Partial<Profile>) {
    setSavingId(id);

    const { error } = await supabase
      .from("profiles")
      .update(values)
      .eq("id", id);

    setSavingId(null);

    if (error) {
      alert("Erro ao salvar");
      return;
    }

    loadUsers();
  }

  function handleChange(
    id: string,
    field: keyof Profile,
    value: string
  ) {
    setUsers((prev) =>
      prev.map((u) =>
        u.id === id ? { ...u, [field]: value } : u
      )
    );
  }

  async function createUser(e: React.FormEvent) {
  e.preventDefault();

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

  loadUsers();
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
    <main className="min-h-screen bg-black p-6 text-white">
      <div className="mx-auto max-w-6xl">

        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img
              src="/logo.png"
              className="h-36 w-36 object-contain"
            />
            <h1 className="text-2xl font-bold">
              Gerenciar usuários
            </h1>
          </div>

      <div className="flex items-center gap-3">
  <button
    onClick={exportUsersCsv}
    className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
  >
    Exportar público Meta Ads
  </button>

  <a
    href="/"
    className="rounded-xl border px-4 py-2"
  >
    ← Dashboard
  </a>
</div>
        </div>

        <form
  onSubmit={createUser}
  className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-6"
>
  <h2 className="mb-4 text-lg font-semibold">Criar usuário</h2>

  <div className="grid gap-4 md:grid-cols-3">
    <label>
      <span className="mb-2 block text-xs text-zinc-400">Nome</span>
      <input
        value={newUser.full_name}
        onChange={(e) =>
          setNewUser({ ...newUser, full_name: e.target.value })
        }
        required
        placeholder="Nome completo"
        className="w-full rounded-xl border border-zinc-700 bg-black px-3 py-2 text-sm text-white outline-none"
      />
    </label>

    <label>
      <span className="mb-2 block text-xs text-zinc-400">Email</span>
      <input
        type="email"
        value={newUser.email}
        onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
        required
        placeholder="email@exemplo.com"
        className="w-full rounded-xl border border-zinc-700 bg-black px-3 py-2 text-sm text-white outline-none"
      />
    </label>

    <label>
      <span className="mb-2 block text-xs text-zinc-400">Telefone</span>
      <input
        value={newUser.phone}
        onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
        placeholder="(00) 00000-0000"
        className="w-full rounded-xl border border-zinc-700 bg-black px-3 py-2 text-sm text-white outline-none"
      />
    </label>

    <label>
      <span className="mb-2 block text-xs text-zinc-400">Senha inicial</span>
      <input
        type="password"
        value={newUser.password}
        onChange={(e) =>
          setNewUser({ ...newUser, password: e.target.value })
        }
        required
        placeholder="Senha do usuário"
        className="w-full rounded-xl border border-zinc-700 bg-black px-3 py-2 text-sm text-white outline-none"
      />
    </label>

    <label>
      <span className="mb-2 block text-xs text-zinc-400">Tipo de usuário</span>
      <select
        value={newUser.role}
        onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
        className="w-full rounded-xl border border-zinc-700 bg-black px-3 py-2 text-sm text-white outline-none"
      >
        <option value="viewer">Usuário comum</option>
        <option value="admin">Admin</option>
      </select>
    </label>

    <label>
      <span className="mb-2 block text-xs text-zinc-400">Status</span>
      <select
        value={newUser.status}
        onChange={(e) => setNewUser({ ...newUser, status: e.target.value })}
        className="w-full rounded-xl border border-zinc-700 bg-black px-3 py-2 text-sm text-white outline-none"
      >
        <option value="approved">Aprovado</option>
        <option value="pending">Pendente</option>
        <option value="blocked">Bloqueado</option>
      </select>
    </label>
  </div>

  <button
    type="submit"
    className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
  >
    Criar usuário
  </button>
</form>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900 text-xs text-zinc-400">
              <tr>
                <th className="px-4 py-4">Nome</th>
                <th className="px-4 py-4">Email</th>
                <th className="px-4 py-4">Telefone</th>
                <th className="px-4 py-4">Status</th>
                <th className="px-4 py-4">Role</th>
                <th className="px-4 py-4 text-right">Ações</th>
              </tr>
            </thead>

            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t border-zinc-800">

                  {/* NOME EDITÁVEL */}
                  <td className="px-4 py-4">
                    <input
                      value={user.full_name || ""}
                      onChange={(e) =>
                        handleChange(user.id, "full_name", e.target.value)
                      }
                      className="w-full bg-black border border-zinc-700 rounded px-2 py-1"
                    />
                  </td>

                  {/* EMAIL EDITÁVEL */}
                  <td className="px-4 py-4">
                    <input
                      value={user.email || ""}
                      onChange={(e) =>
                        handleChange(user.id, "email", e.target.value)
                      }
                      className="w-full bg-black border border-zinc-700 rounded px-2 py-1"
                    />
                  </td>

                  {/* TELEFONE EDITÁVEL */}
                  <td className="px-4 py-4">
                    <input
                      value={user.phone || ""}
                      onChange={(e) =>
                        handleChange(user.id, "phone", e.target.value)
                      }
                      className="w-full bg-black border border-zinc-700 rounded px-2 py-1"
                    />
                  </td>

                  {/* STATUS */}
                  <td className="px-4 py-4">
                    <select
                      value={user.status || "pending"}
                      onChange={(e) =>
                        handleChange(user.id, "status", e.target.value)
                      }
                      className="bg-black border border-zinc-700 rounded px-2 py-1"
                    >
                      <option value="pending">Pendente</option>
                      <option value="approved">Aprovado</option>
                      <option value="blocked">Bloqueado</option>
                    </select>
                  </td>

                  {/* ROLE */}
                  <td className="px-4 py-4">
                    <select
                      value={user.role || "viewer"}
                      onChange={(e) =>
                        handleChange(user.id, "role", e.target.value)
                      }
                      className="bg-black border border-zinc-700 rounded px-2 py-1"
                    >
                      <option value="viewer">Usuário</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>

                  {/* AÇÕES */}
                  <td className="px-4 py-4 text-right">
                    <div className="flex justify-end gap-2">

                      <button
                        onClick={() => updateUser(user.id, user)}
                        disabled={savingId === user.id}
                        className="bg-blue-600 px-3 py-1 rounded text-white"
                      >
                        Salvar
                      </button>

                      <button
                        onClick={() =>
                          updateUser(user.id, { status: "approved" })
                        }
                        className="bg-green-600 px-3 py-1 rounded"
                      >
                        Aprovar
                      </button>

                      <button
  onClick={() => resetPassword(user.id)}
  className="bg-purple-600 px-3 py-1 rounded text-white hover:bg-purple-700"
>
  Redefinir senha
</button>

                      <button
                        onClick={() =>
                          updateUser(user.id, { status: "blocked" })
                        }
                        className="bg-red-600 px-3 py-1 rounded"
                      >
                        Bloquear
                      </button>

                      <button
  onClick={async () => {
    const confirmDelete = confirm(
      "Tem certeza que deseja excluir este usuário?"
    );

    if (!confirmDelete) return;

    const { error } = await supabase
      .from("profiles")
      .delete()
      .eq("id", user.id);

    if (error) {
      alert("Erro ao excluir usuário.");
      return;
    }

    loadUsers();
  }}
  className="bg-zinc-700 px-3 py-1 rounded text-white hover:bg-zinc-600"
>
  Excluir
</button>

                    </div>
                  </td>

                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </main>
  );
}