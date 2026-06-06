"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleResetPassword(event: FormEvent) {
    event.preventDefault();

    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });

    setLoading(false);

    if (error) {
      alert("Não foi possível enviar o email de recuperação.");
      return;
    }

    setSent(true);
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
            <p className="mb-3 inline-flex rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs font-medium text-purple-300">
              Recuperação de acesso
            </p>

            <h1 className="text-2xl font-bold">Recuperar senha</h1>

            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Informe seu email para receber o link de recuperação.
            </p>
          </div>

          {!sent ? (
            <form onSubmit={handleResetPassword} className="mt-6 space-y-4">
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
                  className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-purple-500"
                />
              </label>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-purple-600 px-4 py-3 text-sm font-semibold text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Enviando..." : "Enviar link de recuperação"}
              </button>
            </form>
          ) : (
            <div className="mt-6 rounded-2xl border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-300">
              Enviamos um link de recuperação para seu email. Verifique sua caixa
              de entrada e também o spam.
            </div>
          )}

          <div className="mt-5 border-t border-zinc-800 pt-4 text-center text-sm">
            <Link href="/login" className="text-zinc-400 hover:text-white">
              Voltar para o login
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}