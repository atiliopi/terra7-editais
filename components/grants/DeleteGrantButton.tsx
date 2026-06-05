"use client";

import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export function DeleteGrantButton({ id }: { id: string }) {
  const router = useRouter();

  async function handleDelete() {
    const confirmDelete = confirm("Tem certeza que deseja excluir este edital?");

    if (!confirmDelete) return;

    const { error } = await supabase
      .from("grants")
      .delete()
      .eq("id", id);

    if (error) {
      alert("Erro ao excluir edital.");
      return;
    }

    alert("Edital excluído com sucesso.");

    router.push("/");
  }

  return (
    <button
      onClick={handleDelete}
      className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
    >
      Excluir edital
    </button>
  );
}