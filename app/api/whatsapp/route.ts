import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type ParsedGrant = {
  title: string | null;
  state_scope: string | null;
  area: string | null;
  opening_date: string | null;
  closing_date: string | null;
  total_value: number | null;
  value_per_project: number | null;
  source: string | null;
  source_url: string | null;
  sender_name: string | null;
  notes: string | null;
};

function extractMessage(body: any): string {
  return (
    body?.message ||
    body?.data?.message?.conversation ||
    body?.data?.message?.extendedTextMessage?.text ||
    ""
  );
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const secret = url.searchParams.get("secret");

  if (
    process.env.WHATSAPP_WEBHOOK_SECRET &&
    secret !== process.env.WHATSAPP_WEBHOOK_SECRET
  ) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = await request.json();

  const isFromMe = body?.data?.key?.fromMe === true;

  if (isFromMe) {
    return NextResponse.json({
      ignored: true,
      reason: "Mensagem enviada pelo próprio WhatsApp",
    });
  }

  const message = extractMessage(body);

  if (!message.trim()) {
    return NextResponse.json({ error: "Mensagem vazia" }, { status: 400 });
  }

  const currentYear = new Date().getFullYear();

  const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `
Você extrai dados de editais.

Retorne APENAS JSON válido neste formato:

{
  "title": string | null,
  "state_scope": string | null,
  "area": string | null,
  "opening_date": "YYYY-MM-DD" | null,
  "closing_date": "YYYY-MM-DD" | null,
  "total_value": number | null,
  "value_per_project": number | null,
  "source": string | null,
  "source_url": string | null,
  "sender_name": string | null,
  "notes": string | null
}

Regras:
- Se aparecer "até 30/06", isso é closing_date.
- Se não houver ano, use ${currentYear}.
- Se aparecer "valor 100000", isso é total_value.
- Se aparecer estado, preencha state_scope.
- Se aparecer área/tema, preencha area.
- Se não souber, use null.
          `,
        },
        {
          role: "user",
          content: message,
        },
      ],
    }),
  });

  const aiData = await aiResponse.json();

  let parsed: ParsedGrant = {
    title: message,
    state_scope: null,
    area: null,
    opening_date: null,
    closing_date: null,
    total_value: null,
    value_per_project: null,
    source: "WhatsApp",
    source_url: null,
    sender_name: "WhatsApp",
    notes: null,
  };

  try {
    parsed = JSON.parse(aiData.choices[0].message.content);
  } catch {
    // Mantém fallback caso a IA retorne algo inválido
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { count } = await supabase
    .from("grants")
    .select("*", { count: "exact", head: true });

  const code = `EDITAL-${String((count || 0) + 1).padStart(4, "0")}`;

  const { error } = await supabase.from("grants").insert([
    {
      code,
      title: parsed.title || message,
      state_scope: parsed.state_scope,
      area: parsed.area || "Geral",
      opening_date: parsed.opening_date,
      closing_date: parsed.closing_date,
      total_value: parsed.total_value,
      value_per_project: parsed.value_per_project,
      source: parsed.source || "WhatsApp",
      source_url: parsed.source_url,
      sender_name: parsed.sender_name || "WhatsApp",
      notes: parsed.notes,
      raw_text: message,
    },
  ]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    code,
    parsed,
  });
}