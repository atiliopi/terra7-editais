export type GrantStatus =
  | "soon"
  | "open"
  | "attention"
  | "urgent"
  | "closed"
  | "no_deadline";

export function getGrantStatus(
  openingDate: string | null,
  closingDate: string | null
): GrantStatus {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Sem prazo: somente quando NÃO existe data de encerramento
  if (!closingDate) {
    return "no_deadline";
  }

  const closing = new Date(`${closingDate}T00:00:00`);

  // Encerrado: data final já passou
  if (today > closing) {
    return "closed";
  }

  // Em breve: só verifica abertura se a data de abertura existir
  if (openingDate) {
    const opening = new Date(`${openingDate}T00:00:00`);

    if (today < opening) {
      return "soon";
    }
  }

  const diffInMs = closing.getTime() - today.getTime();
  const diffInDays = Math.ceil(diffInMs / (1000 * 60 * 60 * 24));

  // Urgente: faltam 5 dias ou menos
  if (diffInDays <= 5) {
    return "urgent";
  }

  // Atenção: faltam entre 6 e 15 dias
  if (diffInDays >= 6 && diffInDays <= 15) {
    return "attention";
  }

  // Aberto: faltam 16 dias ou mais
  return "open";
}