export type GrantStatus =
  | "Sem prazo"
  | "Encerrado"
  | "Em breve"
  | "Urgente"
  | "Atenção"
  | "Aberto";

export type Grant = {
  id: string;
  created_at: string;
  updated_at: string | null;

  title: string | null;
  state_scope: string | null;

  opening_date: string | null;
  closing_date: string | null;

  total_value: number | null;
  value_per_project: number | null;

  area: string | null;

  source: string | null;
  source_url: string | null;

  raw_text: string | null;
  original_message: string | null;

  file_url: string | null;
  file_type: string | null;

  sender_name: string | null;
  sender_phone: string | null;

  notes: string | null;

  created_by: string | null;
  extraction_confidence: number | null;
  status_manual_override: string | null;
};

export type CreateGrantInput = Omit<
  Grant,
  "id" | "created_at" | "updated_at"
>;

export type UpdateGrantInput = Partial<CreateGrantInput>;