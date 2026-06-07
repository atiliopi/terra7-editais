import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type GrantIntent =
  | "create_grant"
  | "query_grants"
  | "update_grant"
  | "out_of_scope";

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

type AiResult = {
  intent: GrantIntent;
  confidence: number;
  reply: string;
  grant: Partial<ParsedGrant> | null;
};

function extractMessage(body: any): string {
  return String(
    body?.payload?.body ||
      body?.payload?._data?.Message?.conversation ||
      body?.payload?._data?.RawMessage?.conversation ||
      body?.message ||
      body?.data?.message?.conversation ||
      body?.data?.message?.extendedTextMessage?.text ||
      body?.payload?.caption ||
      body?.data?.message?.imageMessage?.caption ||
      body?.data?.message?.documentMessage?.caption ||
      body?.data?.message?.videoMessage?.caption ||
      ""
  ).trim();
}

function extractMediaInfo(body: any) {
  const message = body?.data?.message || {};
  const payload = body?.payload || {};

  const hasImage = Boolean(message?.imageMessage || payload?.media?.mimetype?.startsWith?.("image/"));
  const hasDocument = Boolean(message?.documentMessage || payload?.media?.mimetype?.includes?.("pdf"));
  const hasAudio = Boolean(message?.audioMessage || payload?.media?.mimetype?.startsWith?.("audio/"));

  return {
    hasImage,
    hasDocument,
    hasAudio,
    mimetype:
      payload?.media?.mimetype ||
      message?.imageMessage?.mimetype ||
      message?.documentMessage?.mimetype ||
      message?.audioMessage?.mimetype ||
      null,
  };
}

function extractSenderPhone(body: any): string {
  return String(
    body?.payload?._data?.Info?.SenderAlt ||
      body?.payload?.from ||
      body?.data?.key?.remoteJid ||
      ""
  )
    .replace("@s.whatsapp.net", "")
    .replace("@c.us", "")
    .replace("@lid", "")
    .replace(/\D/g, "");
}

function getPhoneVariants(phone: string): string[] {
  const cleanPhone = phone.replace(/\D/g, "");
  const variants = new Set<string>();

  if (cleanPhone) variants.add(cleanPhone);

  if (cleanPhone.startsWith("55") && cleanPhone.length === 12) {
    variants.add(`${cleanPhone.slice(0, 4)}9${cleanPhone.slice(4)}`);
  }

  if (
    cleanPhone.startsWith("55") &&
    cleanPhone.length === 13 &&
    cleanPhone[4] === "9"
  ) {
    variants.add(`${cleanPhone.slice(0, 4)}${cleanPhone.slice(5)}`);
  }

  return Array.from(variants);
}

function safeJsonParse(value: string): any | null {
  try {
    return JSON.parse(value);
  } catch {
    const match = value.match(/\{[\s\S]*\}/);
    if (!match) return null;

    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function normalizeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value !== "string") return null;

  const clean = value
    .replace(/R\$/gi, "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const number = Number(clean);

  return Number.isFinite(number) ? number : null;
}

function normalizeDate(value: unknown): string | null {
  if (!value || typeof value !== "string") return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const ddmmyyyy = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (ddmmyyyy) {
    const [, dd, mm, yyyy] = ddmmyyyy;
    return `${yyyy}-${mm}-${dd}`;
  }

  const ddmm = value.match(/^(\d{2})\/(\d{2})$/);
  if (ddmm) {
    const [, dd, mm] = ddmm;
    const year = new Date().getFullYear();
    return `${year}-${mm}-${dd}`;
  }

  return null;
}

function normalizeParsedGrant(
  parsed: Partial<ParsedGrant>,
  fallbackTitle: string
): ParsedGrant {
  const missingFields: string[] = [];

  const normalized: ParsedGrant = {
    title: parsed.title?.trim() || fallbackTitle.slice(0, 90),
    state_scope: parsed.state_scope?.trim() || null,
    area: parsed.area?.trim() || null,
    opening_date: normalizeDate(parsed.opening_date),
    closing_date: normalizeDate(parsed.closing_date),
    total_value: normalizeNumber(parsed.total_value),
    value_per_project: normalizeNumber(parsed.value_per_project),
    source: parsed.source?.trim() || "WhatsApp",
    source_url: parsed.source_url?.trim() || null,
    sender_name: parsed.sender_name?.trim() || null,
    notes: parsed.notes?.trim() || null,
  };

  if (!normalized.state_scope) missingFields.push("Estado ou abrangência");
  if (!normalized.area) missingFields.push("Área ou tema");
  if (!normalized.closing_date) missingFields.push("Data de encerramento");
  if (!normalized.total_value) missingFields.push("Valor total");
  if (!normalized.source_url) missingFields.push("Link do edital");

  if (missingFields.length > 0) {
    const missingText = `Informações pendentes:\n${missingFields
      .map((field) => `- ${field}`)
      .join("\n")}`;

    normalized.notes = normalized.notes
      ? `${normalized.notes}\n\n${missingText}`
      : missingText;
  }

  return normalized;
}

function isClearlyOutOfScope(message: string): boolean {
  const text = message
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  const greetings = [
    "oi",
    "ola",
    "olá",
    "bom dia",
    "boa tarde",
    "boa noite",
    "tudo bem",
    "teste",
    "testando",
    "ok",
    "obrigado",
    "obrigada",
    "valeu",
  ];

  return greetings.includes(text);
}

function getOutOfScopeReply() {
  return "Sou o Terra7 e posso ajudar apenas com cadastro, consulta e atualização de editais e oportunidades.";
}

async function askOpenAI(message: string, mediaInfo: ReturnType<typeof extractMediaInfo>): Promise<AiResult> {
  const currentYear = new Date().getFullYear();

  const contentForUser = `
Mensagem recebida:
${message || "[sem texto]"}

Mídia detectada:
${JSON.stringify(mediaInfo)}
`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `
Você é Terra7.

Você atua exclusivamente com:
- cadastro de editais;
- atualização de editais;
- consulta de editais;
- organização de oportunidades;
- chamadas públicas;
- bolsas;
- premiações;
- programas;
- processos seletivos;
- oportunidades de fomento.

Você nunca deve se apresentar como ChatGPT, OpenAI ou assistente virtual.

Classifique a intenção da mensagem e extraia os dados.

Retorne APENAS JSON válido neste formato:

{
  "intent": "create_grant" | "query_grants" | "update_grant" | "out_of_scope",
  "confidence": number,
  "reply": string,
  "grant": {
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
  } | null
}

Regras obrigatórias:
- Mensagens como "oi", "bom dia", "boa tarde", "tudo bem", "teste" são out_of_scope.
- Política, futebol, religião, entretenimento e assuntos gerais são out_of_scope.
- Se for out_of_scope, reply deve ser: "${getOutOfScopeReply()}"
- Se for edital, chamada, bolsa, premiação, programa ou oportunidade, use create_grant.
- Nunca bloqueie cadastro de edital por falta de informação.
- Não invente informações.
- Se faltar dado, use null.
- Liste os dados ausentes em notes.
- "Inscrições até", "até", "encerra em", "prazo final" e "data limite" indicam closing_date.
- Datas DD/MM/YYYY devem virar YYYY-MM-DD.
- Datas DD/MM devem usar o ano ${currentYear}.
- Valores como "R$ 100.000", "100 mil", "valor total 100000" devem virar número.
- "Maranhão" ou "MA" deve virar "Maranhão".
- "São Paulo" ou "SP" deve virar "São Paulo".
- "Piauí" ou "PI" deve virar "Piauí".
- "Rio de Janeiro" ou "RJ" deve virar "Rio de Janeiro".
- "Minas Gerais" ou "MG" deve virar "Minas Gerais".
- "Bahia" ou "BA" deve virar "Bahia".
- "cultura" deve virar área "Cultura".
- "educação" deve virar área "Educação".
- "saúde" deve virar área "Saúde".
- "tecnologia" deve virar área "Tecnologia".
- "inovação" deve virar área "Inovação".
- "empreendedorismo" deve virar área "Empreendedorismo".
- "esporte" deve virar área "Esporte".
- "meio ambiente" deve virar área "Meio Ambiente".
- Se houver PDF, imagem ou áudio mas sem texto extraído, não cadastre ainda; retorne out_of_scope explicando que o processamento de mídia precisa ser ativado na próxima etapa.
          `,
        },
        {
          role: "user",
          content: contentForUser,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Erro OpenAI: ${response.status}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("OpenAI retornou conteúdo vazio");
  }

  const parsed = safeJsonParse(content);

  if (!parsed) {
    throw new Error("OpenAI retornou JSON inválido");
  }

  return {
    intent: parsed.intent || "out_of_scope",
    confidence:
      typeof parsed.confidence === "number" ? parsed.confidence : 0,
    reply: parsed.reply || getOutOfScopeReply(),
    grant: parsed.grant || null,
  };
}

export async function POST(request: Request) {
  try {
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

    const message = extractMessage(body);
    const mediaInfo = extractMediaInfo(body);

    if (!message && !mediaInfo.hasImage && !mediaInfo.hasDocument && !mediaInfo.hasAudio) {
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
      .select("id, email, full_name, phone, status")
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

    if (isClearlyOutOfScope(message)) {
      return NextResponse.json({
        ignored: true,
        reason: "Mensagem fora do contexto de editais",
        reply: getOutOfScopeReply(),
      });
    }

    let aiResult: AiResult;

    try {
      aiResult = await askOpenAI(message, mediaInfo);
    } catch (error) {
      console.error("ERRO_OPENAI:", error);

      return NextResponse.json({
        ignored: true,
        reason: "Não foi possível interpretar a mensagem com segurança",
        reply:
          "Sou o Terra7. Não consegui identificar um edital nessa mensagem. Envie o texto do edital ou da oportunidade com as informações disponíveis.",
      });
    }

    console.log("AI_RESULT:", JSON.stringify(aiResult, null, 2));

    if (
      aiResult.intent !== "create_grant" ||
      aiResult.confidence < 0.65 ||
      !aiResult.grant
    ) {
      return NextResponse.json({
        ignored: true,
        intent: aiResult.intent,
        confidence: aiResult.confidence,
        reply: aiResult.reply || getOutOfScopeReply(),
      });
    }

    const parsed = normalizeParsedGrant(aiResult.grant, message);

    const { count } = await supabase
      .from("grants")
      .select("*", { count: "exact", head: true });

    const code = `EDITAL-${String((count || 0) + 1).padStart(4, "0")}`;

    const senderName =
      allowedUser.full_name ||
      parsed.sender_name ||
      allowedUser.email ||
      "WhatsApp";

      const normalizedTitle = parsed.title?.trim();

if (normalizedTitle) {
  let duplicateQuery = supabase
    .from("grants")
    .select("id, code, title, state_scope, closing_date")
    .ilike("title", normalizedTitle);

  if (parsed.state_scope) {
    duplicateQuery = duplicateQuery.eq("state_scope", parsed.state_scope);
  }

  if (parsed.closing_date) {
    duplicateQuery = duplicateQuery.eq("closing_date", parsed.closing_date);
  }

  const { data: duplicateGrant, error: duplicateError } = await duplicateQuery
    .limit(1)
    .maybeSingle();

  if (duplicateError) {
    console.error("ERRO_VERIFICAR_DUPLICIDADE:", duplicateError);
  }

  if (duplicateGrant) {
    return NextResponse.json({
      ignored: true,
      reason: "Edital duplicado",
      duplicate: duplicateGrant,
      reply: `Sou o Terra7. Este edital parece já estar cadastrado como ${duplicateGrant.code || duplicateGrant.id}.`,
    });
  }
}

    const { error } = await supabase.from("grants").insert([
      {
        code,
        title: parsed.title || message.slice(0, 90),
        state_scope: parsed.state_scope,
        area: parsed.area || "Geral",
        opening_date: parsed.opening_date,
        closing_date: parsed.closing_date,
        total_value: parsed.total_value,
        value_per_project: parsed.value_per_project,
        source: parsed.source || "WhatsApp",
        source_url: parsed.source_url,
        sender_name: senderName,
        notes: parsed.notes,
        raw_text: message,
      },
    ]);

    if (error) {
      console.error("ERRO_SUPABASE_INSERT:", error);

      return NextResponse.json(
        {
          error: error.message,
          reply:
            "Sou o Terra7. Identifiquei o edital, mas não consegui salvar no banco de dados.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      code,
      senderPhone,
      phoneVariants,
      user: allowedUser.email,
      senderName,
      parsed,
      reply: `Edital ${code} cadastrado com sucesso.\n\n${parsed.notes || ""}`,
    });
  } catch (error) {
    console.error("ERRO_WEBHOOK_WHATSAPP:", error);

    return NextResponse.json(
      {
        error: "Erro interno no webhook do WhatsApp",
      },
      { status: 500 }
    );
  }
}