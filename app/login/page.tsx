"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);

  async function handleLogin(event: FormEvent) {
    event.preventDefault();

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
    <main className="min-h-screen bg-black px-4 py-6 text-white">
      <div className="mx-auto flex min-h-[85vh] max-w-md flex-col items-center justify-center">
        <img
          src="/logo.png"
          alt="Terra 7"
          className="mb-6 h-32 w-32 object-contain sm:h-40 sm:w-40"
        />

        <section className="w-full rounded-3xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl shadow-black/40 sm:p-6">
          <div className="text-center">
            <p className="mb-3 inline-flex rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-300">
              Acesso restrito
            </p>

            <h1 className="text-2xl font-bold">Entrar no Terra 7 Editais</h1>

            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Acesse sua conta para cadastrar, consultar e organizar editais.
            </p>
          </div>

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-2 block text-xs font-medium text-zinc-400">
                Email
              </span>

              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                placeholder="seuemail@email.com"
                className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-blue-500"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-medium text-zinc-400">
                Senha
              </span>

              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                placeholder="Sua senha"
                className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-blue-500"
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

          <div className="mt-5 space-y-3 text-center text-sm">
            <Link
              href="/forgot-password"
              className="block text-zinc-400 hover:text-white"
            >
              Esqueci minha senha
            </Link>

            <div className="border-t border-zinc-800 pt-4">
              <span className="text-zinc-500">Ainda não tem conta?</span>{" "}
              <Link
                href="/register"
                className="font-semibold text-blue-400 hover:text-blue-300"
              >
                Criar conta
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}