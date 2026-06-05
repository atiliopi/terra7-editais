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
    body?.payload?.body ||
    body?.payload?._data?.Message?.conversation ||
    body?.payload?._data?.RawMessage?.conversation ||
    body?.message ||
    body?.data?.message?.conversation ||
    body?.data?.message?.extendedTextMessage?.text ||
    ""
  );
}

function extractSenderPhone(body: any): string {
  return (
    body?.payload?._data?.Info?.SenderAlt?.replace("@s.whatsapp.net", "") ||
    body?.payload?.from?.replace("@c.us", "").replace("@lid", "") ||
    body?.data?.key?.remoteJid?.replace("@s.whatsapp.net", "").replace("@c.us", "") ||
    ""
  ).replace(/\D/g, "");
}

function getPhoneVariants(phone: string): string[] {
  const cleanPhone = phone.replace(/\D/g, "");
  const variants = new Set<string>();

  if (cleanPhone) variants.add(cleanPhone);

  // Exemplo:
  // WAHA pode enviar 559887219020
  // usuário pode cadastrar 5598987219020
  if (cleanPhone.startsWith("55") && cleanPhone.length === 12) {
    variants.add(`${cleanPhone.slice(0, 4)}9${cleanPhone.slice(4)}`);
  }

  // Caso venha com nono dígito e precise comparar sem ele
  if (cleanPhone.startsWith("55") && cleanPhone.length === 13 && cleanPhone[4] === "9") {
    variants.add(`${cleanPhone.slice(0, 4)}${cleanPhone.slice(5)}`);
  }

  return Array.from(variants);
}

function normalizeParsedGrant(parsed: Partial<ParsedGrant>, fallbackTitle: string): ParsedGrant {
  const missingFields: string[] = [];

  const normalized: ParsedGrant = {
    title: parsed.title?.trim() || fallbackTitle.slice(0, 80),
    state_scope: parsed.state_scope?.trim() || null,
    area: parsed.area?.trim() || null,
    opening_date: parsed.opening_date || null,
    closing_date: parsed.closing_date || null,
    total_value:
      typeof parsed.total_value === "number" && !Number.isNaN(parsed.total_value)
        ? parsed.total_value
        : null,
    value_per_project:
      typeof parsed.value_per_project === "number" && !Number.isNaN(parsed.value_per_project)
        ? parsed.value_per_project
        : null,
    source: parsed.source?.trim() || "WhatsApp",
    source_url: parsed.source_url?.trim() || null,
    sender_name: parsed.sender_name?.trim() || null,
    notes: parsed.notes?.trim() || null,
  };

  if (!normalized.state_scope) missingFields.push("estado/abrangência");
  if (!normalized.area) missingFields.push("área/tema");
  if (!normalized.closing_date) missingFields.push("data de encerramento");
  if (!normalized.total_value) missingFields.push("valor total");
  if (!normalized.source_url) missingFields.push("link do edital");

  if (missingFields.length > 0) {
    const missingText = `Informações não identificadas automaticamente: ${missingFields.join(", ")}. Cadastro criado de forma preliminar para edição posterior.`;

    normalized.notes = normalized.notes
      ? `${normalized.notes}\n\n${missingText}`
      : missingText;
  }

  return normalized;
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

  const isFromMe =
    body?.payload?.fromMe === true ||
    body?.payload?._data?.Info?.IsFromMe === true ||
    body?.data?.key?.fromMe === true;

  if (isFromMe) {
    return NextResponse.json({
      ignored: true,
      reason: "Mensagem enviada pelo próprio WhatsApp",
    });
  }

  const message = extractMessage(body).trim();

  if (!message) {
    return NextResponse.json({
      ignored: true,
      reason: "Mensagem vazia ou formato não suportado",
    });
  }

  const senderPhone = extractSenderPhone(body);
  const phoneVariants = getPhoneVariants(senderPhone);

  if (phoneVariants.length === 0) {
    return NextResponse.json({
      ignored: true,
      reason: "Telefone do remetente não identificado",
    });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: allowedUsers, error: userError } = await supabase
    .from("profiles")
    .select("id, email, phone, status")
    .in("phone", phoneVariants)
    .eq("status", "approved")
    .limit(1);

  const allowedUser = allowedUsers?.[0];

  if (userError || !allowedUser) {
    return NextResponse.json({
      ignored: true,
      reason: "Telefone não autorizado",
      senderPhone,
      phoneVariants,
    });
  }

  const currentYear = new Date().getFullYear();

  let parsed: ParsedGrant = normalizeParsedGrant(
    {
      title: message,
      state_scope: null,
      area: null,
      opening_date: null,
      closing_date: null,
      total_value: null,
      value_per_project: null,
      source: "WhatsApp",
      source_url: null,
      sender_name: null,
      notes: null,
    },
    message
  );

  try {
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
Você é o assistente oficial da Terra7 Editais.
Seu nome é Terra7.

Sua função é exclusivamente auxiliar no cadastro, atualização, validação e organização de editais, oportunidades, chamadas públicas, bolsas, premiações e processos seletivos.

Regras:
- Nunca se apresente como ChatGPT.
- Nunca converse sobre assuntos fora de editais e oportunidades.
- Se a mensagem não for sobre editais, oportunidades, chamadas, bolsas, projetos ou premiações, não cadastre nada.
- Não invente informações.
- Se faltar algum dado, use null.
- O edital pode ser cadastrado mesmo incompleto.
- Use notes para registrar informações pendentes.

Sua tarefa é ler a mensagem recebida pelo WhatsApp e extrair o máximo de informações possíveis.

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

Regras obrigatórias:
- Não invente informações.
- Se faltar um dado, use null.
- O cadastro pode ser criado incompleto.
- Nunca rejeite um edital por falta de informações.
- Em notes, liste de forma curta os campos importantes que não foram identificados.
- Priorize extrair Estado, Área, Data de Encerramento e Valor.
- Se aparecer "Maranhão" ou "MA", state_scope deve ser "Maranhão".
- Se aparecer "São Paulo" ou "SP", state_scope deve ser "São Paulo".
- Se aparecer "Piauí" ou "PI", state_scope deve ser "Piauí".
- Se aparecer "Rio de Janeiro" ou "RJ", state_scope deve ser "Rio de Janeiro".
- Se aparecer "Minas Gerais" ou "MG", state_scope deve ser "Minas Gerais".
- Se aparecer "Bahia" ou "BA", state_scope deve ser "Bahia".
- Se aparecer "cultura", area deve ser "Cultura".
- Se aparecer "educação", area deve ser "Educação".
- Se aparecer "saúde", area deve ser "Saúde".
- Se aparecer "tecnologia", area deve ser "Tecnologia".
- Se aparecer "inovação", area deve ser "Inovação".
- Se aparecer "empreendedorismo", area deve ser "Empreendedorismo".
- Se aparecer "esporte", area deve ser "Esporte".
- Se aparecer "meio ambiente", area deve ser "Meio Ambiente".
- Se aparecer "inscrições até", "até", "encerra em", "prazo final" ou "data limite", isso é closing_date.
- Se a data vier como DD/MM/YYYY, converta para YYYY-MM-DD.
- Se a data vier como DD/MM, use o ano ${currentYear}.
- Se aparecer valor como "R$ 100.000", "100 mil", "valor total 100000", isso é total_value.
- total_value deve ser número, sem R$, pontos ou vírgulas.
- O título deve ser curto, claro e descritivo.
- source deve ser "WhatsApp" se não houver fonte explícita.
            `,
          },
          {
            role: "user",
            content: message,
          },
        ],
      }),
    });

    if (aiResponse.ok) {
      const aiData = await aiResponse.json();
      const content = aiData?.choices?.[0]?.message?.content;

      if (content) {
        parsed = normalizeParsedGrant(JSON.parse(content), message);
      }
    }
  } catch {
    // Se a IA falhar, mantém o cadastro preliminar com a mensagem original.
  }

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
      sender_name: allowedUser.email || parsed.sender_name || "WhatsApp",
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
    senderPhone,
    phoneVariants,
    user: allowedUser.email,
    parsed,
  });
}