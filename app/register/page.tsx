"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function RegisterPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();

    setLoading(true);

    const cleanPhone = phone.replace(/\D/g, "");

const normalizedPhone = cleanPhone.startsWith("55")
  ? cleanPhone
  : `55${cleanPhone}`;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error || !data.user) {
  setLoading(false);
  console.error("ERRO_CRIAR_CONTA:", error);
  alert(error?.message || "Erro ao criar conta.");
  return;
}

    const { error: profileError } = await supabase.from("profiles").insert({
      id: data.user.id,
      full_name: fullName,
      email,
      phone: normalizedPhone,
      role: "viewer",
      status: "pending",
    });

    setLoading(false);

    if (profileError) {
      alert("Conta criada, mas houve erro ao salvar o perfil.");
      return;
    }

    alert("Conta criada! Aguarde aprovação do administrador.");
    router.push("/login");
  }

  return (
    <main className="min-h-screen bg-black p-6 text-white">
      <div className="mx-auto flex min-h-[80vh] max-w-md flex-col items-center justify-center">
        <img
          src="/logo.png"
          alt="Terra 7"
          className="mb-6 h-50 w-50 object-contain"
        />

        <div className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <h1 className="text-2xl font-bold">
            Criar conta no Terra 7 Editais
          </h1>

          <p className="mt-2 text-sm text-zinc-400">
            Crie sua conta para solicitar acesso ao sistema.
          </p>

          <form onSubmit={handleRegister} className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-2 block text-xs text-zinc-400">Nome</span>

              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                placeholder="Seu nome"
                className="w-full rounded-xl border border-zinc-800 bg-black px-3 py-2 text-white outline-none focus:border-blue-500"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs text-zinc-400">Email</span>

              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="seuemail@email.com"
                className="w-full rounded-xl border border-zinc-800 bg-black px-3 py-2 text-white outline-none focus:border-blue-500"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs text-zinc-400">WhatsApp</span>

              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                placeholder="(11) 99999-9999"
                className="w-full rounded-xl border border-zinc-800 bg-black px-3 py-2 text-white outline-none focus:border-blue-500"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs text-zinc-400">Senha</span>

              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Sua senha"
                className="w-full rounded-xl border border-zinc-800 bg-black px-3 py-2 text-white outline-none focus:border-blue-500"
              />
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? "Criando..." : "Criar conta"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}