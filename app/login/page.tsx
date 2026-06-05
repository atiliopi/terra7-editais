"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();

    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      alert("Email ou senha inválidos.");
      return;
    }

    router.push("/");
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
          <h1 className="text-2xl font-bold">Entrar no Terra 7 Editais</h1>

          <p className="mt-2 text-sm text-zinc-400">
            Acesse sua conta para gerenciar editais.
          </p>

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-2 block text-xs font-medium text-zinc-400">
                Email
              </span>

              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="seuemail@email.com"
                className="w-full rounded-xl border border-zinc-800 bg-black px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-blue-500"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-medium text-zinc-400">
                Senha
              </span>

              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Sua senha"
                className="w-full rounded-xl border border-zinc-800 bg-black px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-blue-500"
              />
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}