import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type EquatorialGrant = {
  url: string;
  title: string;
};

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

function extractEquatorialLinks(html: string) {
  const links = new Map<string, string>();

  const matches = Array.from(
    html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi)
  );

  for (const match of matches) {
    const href = match[1];
    const title = stripHtml(match[2]);

    if (!href.includes("equatorialenergia.com.br/")) continue;
    if (href.includes("/category/")) continue;
    if (href.includes("/feed/")) continue;
    if (title.length < 10) continue;

    const lower = `${href} ${title}`.toLowerCase();

    const looksLikeOpportunity =
      lower.includes("edital") ||
      lower.includes("patrocínio") ||
      lower.includes("patrocinio") ||
      lower.includes("projetos sociais") ||
      lower.includes("projetos culturais") ||
      lower.includes("projetos esportivos") ||
      lower.includes("seleção pública") ||
      lower.includes("selecao publica");

    if (!looksLikeOpportunity) continue;

    links.set(href, title);
  }

  return Array.from(links.entries()).map(([url, title]) => ({ url, title }));
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

Extraia dados de uma oportunidade, edital ou chamada da Equatorial Energia.

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
- Se o texto citar Maranhão, use "Maranhão".
- Se citar sete estados ou vários estados, use "Nacional" somente se fizer sentido amplo; caso contrário descreva em notes.
- Se não souber estado, use null.
- Se não souber valor, use null.
- Se não souber datas, use null.
- Se faltar informação, registre em notes.
- Áreas prováveis: Projetos sociais, Cultura, Esporte, Sustentabilidade, Educação, Responsabilidade social.
- Datas devem estar em YYYY-MM-DD.
          `,
        },
        {
          role: "user",
          content: `
Título provável:
${fallbackTitle}

Texto da oportunidade:
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
      "https://www.equatorialenergia.com.br/category/responsabilidade-social/",
      {
        headers: {
          "User-Agent": "Terra7Editais/1.0",
          Accept: "text/html",
        },
        cache: "no-store",
      }
    );

    if (!listResponse.ok) {
      return NextResponse.json(
        { error: "Não foi possível acessar a lista da Equatorial." },
        { status: 500 }
      );
    }

    const listHtml = await listResponse.text();
    const links: EquatorialGrant[] = extractEquatorialLinks(listHtml);

    let imported = 0;
    let duplicates = 0;
    let ignoredClosed = 0;
    let errors = 0;

    const details = [];

    for (const item of links) {
      if (imported >= 5) break;

      try {
        const { data: duplicateByUrl } = await supabase
          .from("grants")
          .select("id, code")
          .eq("source_url", item.url)
          .maybeSingle();

        if (duplicateByUrl) {
          duplicates++;
          details.push({
            title: item.title,
            status: "duplicate",
            code: duplicateByUrl.code,
          });
          continue;
        }

        const detailResponse = await fetch(item.url, {
          headers: {
            "User-Agent": "Terra7Editais/1.0",
            Accept: "text/html",
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

        const title = ai.title || item.title;
        const openingDate = normalizeDate(ai.opening_date);
        const closingDate = normalizeDate(ai.closing_date);

        if (isClosed(closingDate)) {
          ignoredClosed++;
          continue;
        }

        const { data: duplicateByTitle } = await supabase
          .from("grants")
          .select("id, code")
          .ilike("title", title)
          .limit(1)
          .maybeSingle();

        if (duplicateByTitle) {
          duplicates++;
          continue;
        }

        const { count } = await supabase
          .from("grants")
          .select("*", { count: "exact", head: true });

        const code = `EDITAL-${String((count || 0) + 1).padStart(4, "0")}`;

        const notes = [
          "Fonte oficial: Equatorial Energia",
          ai.notes,
          !closingDate
            ? "Data de encerramento não informada. Consultar link oficial."
            : null,
          !ai.total_value
            ? "Valor total não informado. Consultar link oficial."
            : null,
        ]
          .filter(Boolean)
          .join("\n\n");

        const { error: insertError } = await supabase.from("grants").insert([
          {
            code,
            title,
            state_scope: ai.state_scope,
            area: ai.area || "Responsabilidade social",
            opening_date: openingDate,
            closing_date: closingDate,
            total_value: ai.total_value,
            value_per_project: ai.value_per_project,
            source: "Equatorial",
            source_url: item.url,
            sender_name: "Terra7 IA",
            notes,
            raw_text: rawText.slice(0, 20000),
          },
        ]);

        if (insertError) {
          errors++;
          continue;
        }

        imported++;
        details.push({
          title,
          status: "imported",
          code,
        });
      } catch (error) {
        console.error("ERRO_IMPORTAR_EQUATORIAL_ITEM:", error);
        errors++;
      }
    }

    return NextResponse.json({
      success: true,
      source: "Equatorial",
      processed: links.length,
      imported,
      duplicates,
      ignoredClosed,
      errors,
      details,
      message: `Equatorial: ${imported} importados, ${duplicates} duplicados, ${ignoredClosed} encerrados ignorados, ${errors} erros.`,
    });
  } catch (error) {
    console.error("ERRO_IMPORTAR_EQUATORIAL:", error);

    return NextResponse.json(
      { error: "Erro interno ao importar editais da Equatorial." },
      { status: 500 }
    );
  }
}