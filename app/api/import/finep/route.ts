import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type AiGrant = {
  title: string | null;
  state_scope: string | null;
  area: string | null;
  opening_date: string | null;
  closing_date: string | null;
  total_value: number | null;
  value_per_project: number | null;
  notes: string | null;
};

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractFinepLinks(html: string) {
  const links = new Map<string, string>();

  const regex =
    /href=["']([^"']*chamadas-publicas\/chamadapublica\/[^"']*)["'][^>]*>(.*?)<\/a>/gi;

  let match;

  while ((match = regex.exec(html)) !== null) {
    const href = match[1];
    const title = stripHtml(match[2]);

    if (!title || title.length < 8) continue;

    const url = href.startsWith("http")
      ? href
      : `https://www.finep.gov.br${href.startsWith("/") ? "" : "/"}${href}`;

    links.set(url, title);
  }

  return Array.from(links.entries())
    .map(([url, title]) => ({ url, title }))
    .slice(0, 5);
}

function normalizeDate(value: string | null) {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return null;
}

function isClosed(closingDate: string | null) {
  if (!closingDate) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const closing = new Date(`${closingDate}T00:00:00`);
  return today > closing;
}

async function extractWithAI(rawText: string, fallbackTitle: string): Promise<AiGrant> {
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
Você é o Terra7.

Extraia dados de uma chamada pública da Finep.

Retorne apenas JSON válido:

{
  "title": string | null,
  "state_scope": string | null,
  "area": string | null,
  "opening_date": "YYYY-MM-DD" | null,
  "closing_date": "YYYY-MM-DD" | null,
  "total_value": number | null,
  "value_per_project": number | null,
  "notes": string | null
}

Regras:
- Não invente dados.
- Só use "Nacional" se o texto disser claramente que a chamada é nacional.
- Se não souber o estado, use null.
- Se não souber valor, use null.
- Se não souber datas, use null.
- Se faltar informação, registre em notes.
- A área mais provável da Finep é "Inovação", "Tecnologia", "Pesquisa" ou "Empreendedorismo".
- Datas devem estar em YYYY-MM-DD.
          `,
        },
        {
          role: "user",
          content: `
Título provável:
${fallbackTitle}

Texto da chamada:
${rawText.slice(0, 12000)}
          `,
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
    throw new Error("OpenAI retornou vazio");
  }

  return JSON.parse(content);
}

export async function POST() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const listResponse = await fetch(
      "https://www.finep.gov.br/chamadas-publicas/chamadaspublicas?situacao=aberta",
      {
        headers: {
          "User-Agent": "Terra7Editais/1.0",
        },
        cache: "no-store",
      }
    );

    if (!listResponse.ok) {
      return NextResponse.json(
        { error: "Não foi possível acessar a lista da Finep." },
        { status: 500 }
      );
    }

    const listHtml = await listResponse.text();
    const links = extractFinepLinks(listHtml);

    let imported = 0;
    let duplicates = 0;
    let ignoredClosed = 0;
    let errors = 0;

    const details = [];

    for (const item of links) {
      try {
        const { data: existingByUrl } = await supabase
          .from("grants")
          .select("id, code")
          .eq("source_url", item.url)
          .maybeSingle();

        if (existingByUrl) {
          duplicates++;
          details.push({
            title: item.title,
            status: "duplicate",
            code: existingByUrl.code,
          });
          continue;
        }

        const detailResponse = await fetch(item.url, {
          headers: {
            "User-Agent": "Terra7Editais/1.0",
          },
          cache: "no-store",
        });

        if (!detailResponse.ok) {
          errors++;
          continue;
        }

        const detailHtml = await detailResponse.text();
        const rawText = stripHtml(detailHtml);

        const ai = await extractWithAI(rawText, item.title);

        const closingDate = normalizeDate(ai.closing_date);
        const openingDate = normalizeDate(ai.opening_date);

        if (isClosed(closingDate)) {
          ignoredClosed++;
          details.push({
            title: ai.title || item.title,
            status: "closed_ignored",
          });
          continue;
        }

        const { data: duplicateByTitle } = await supabase
          .from("grants")
          .select("id, code")
          .ilike("title", ai.title || item.title)
          .limit(1)
          .maybeSingle();

        if (duplicateByTitle) {
          duplicates++;
          details.push({
            title: ai.title || item.title,
            status: "duplicate",
            code: duplicateByTitle.code,
          });
          continue;
        }

        const { count } = await supabase
          .from("grants")
          .select("*", { count: "exact", head: true });

        const code = `EDITAL-${String((count || 0) + 1).padStart(4, "0")}`;

        const missingNotes = [
          !ai.state_scope
            ? "Estado ou abrangência não informado. Consultar link oficial."
            : null,
          !ai.area ? "Área não informada. Consultar link oficial." : null,
          !closingDate
            ? "Data de encerramento não informada. Consultar link oficial."
            : null,
          !ai.total_value
            ? "Valor total não informado. Consultar link oficial."
            : null,
        ].filter(Boolean);

        const notes = [
          ai.notes,
          missingNotes.length
            ? `Informações pendentes:\n${missingNotes
                .map((note) => `- ${note}`)
                .join("\n")}`
            : null,
        ]
          .filter(Boolean)
          .join("\n\n");

        const { error: insertError } = await supabase.from("grants").insert([
          {
            code,
            title: ai.title || item.title,
            state_scope: ai.state_scope,
            area: ai.area || "Inovação",
            opening_date: openingDate,
            closing_date: closingDate,
            total_value: ai.total_value,
            value_per_project: ai.value_per_project,
            source: "Finep",
            source_url: item.url,
            sender_name: "Terra7 IA",
            notes,
            raw_text: rawText.slice(0, 20000),
          },
        ]);

        if (insertError) {
          errors++;
          details.push({
            title: ai.title || item.title,
            status: "error",
            error: insertError.message,
          });
          continue;
        }

        imported++;
        details.push({
          title: ai.title || item.title,
          status: "imported",
          code,
        });
      } catch (error) {
        console.error("ERRO_IMPORTAR_FINEP_ITEM:", error);
        errors++;
      }
    }

    return NextResponse.json({
      success: true,
      source: "Finep",
      processed: links.length,
      imported,
      duplicates,
      ignoredClosed,
      errors,
      details,
      message: `Finep: ${imported} importados, ${duplicates} duplicados, ${ignoredClosed} encerrados ignorados, ${errors} erros.`,
    });
  } catch (error) {
    console.error("ERRO_IMPORTAR_FINEP:", error);

    return NextResponse.json(
      { error: "Erro interno ao importar editais da Finep." },
      { status: 500 }
    );
  }
}