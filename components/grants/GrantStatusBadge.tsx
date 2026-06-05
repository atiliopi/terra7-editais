import type { GrantStatus } from "@/lib/grants/status";

type Props = {
  status: GrantStatus;
};

const labels: Record<GrantStatus, string> = {
  soon: "Em breve",
  open: "Aberto",
  attention: "Atenção",
  urgent: "Urgente",
  closed: "Encerrado",
  no_deadline: "Sem prazo",
};

const styles: Record<GrantStatus, string> = {
  soon: "border-blue-500/30 bg-blue-500/10 text-blue-300",
  open: "border-green-500/30 bg-green-500/10 text-green-300",
  attention: "border-yellow-500/30 bg-yellow-500/10 text-yellow-300",
  urgent: "border-red-500/30 bg-red-500/10 text-red-300",
  closed: "border-zinc-600 bg-zinc-800 text-zinc-300",
  no_deadline: "border-white/30 bg-white/10 text-white",
};

export function GrantStatusBadge({ status }: Props) {
  return (
    <span
      className={`inline-flex min-w-[100px] justify-center whitespace-nowrap rounded-full border px-3 py-1 text-xs font-semibold ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}