import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type PncpItem = {
  numeroControlePNCP?: string;
  objetoCompra?: string;
  dataAberturaProposta?: string;
  dataEncerramentoProposta?: string;
  valorTotalEstimado?: number | null;
  valorTotalHomologado?: number | null;
  modalidadeNome?: string;
  tipoInstrumentoConvocatorioNome?: string;
  linkSistemaOrigem?: string | null;
  linkProcessoEletronico?: string | null;
  unidadeOrgao?: {
    ufNome?: string;
    ufSigla?: string;
    municipioNome?: string;
    nomeUnidade?: string;
  };
  orgaoEntidade?: {
    razaoSocial?: string;
  };
};

function toDateOnly(value?: string | null) {
  if (!value) return null;
  return value.slice(0, 10);
}

function toPncpDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}${month}${day}`;
}

function isClosed(closingDate: string | null) {
  if (!closingDate) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const closing = new Date(`${closingDate}T00:00:00`);
  return today > closing;
}

function getDateRange() {
  const today = new Date();
  const end = new Date(today.getFullYear(), 11, 31);

  return {
    start: toPncpDate(today),
    end: toPncpDate(end),
  };
}

function getOfficialUrl(item: PncpItem) {
  if (item.linkProcessoEletronico) return item.linkProcessoEletronico;
  if (item.linkSistemaOrigem) return item.linkSistemaOrigem;

  return `https://pncp.gov.br/app/editais?q=${encodeURIComponent(
    item.numeroControlePNCP || item.objetoCompra || "PNCP"
  )}`;
}

function buildNotes(item: PncpItem) {
  return [
    "Fonte oficial: PNCP",
    item.numeroControlePNCP
      ? `Número de controle PNCP: ${item.numeroControlePNCP}`
      : null,
    item.modalidadeNome ? `Modalidade: ${item.modalidadeNome}` : null,
    item.tipoInstrumentoConvocatorioNome
      ? `Instrumento: ${item.tipoInstrumentoConvocatorioNome}`
      : null,
    item.orgaoEntidade?.razaoSocial
      ? `Órgão: ${item.orgaoEntidade.razaoSocial}`
      : null,
    item.unidadeOrgao?.municipioNome
      ? `Município: ${item.unidadeOrgao.municipioNome}`
      : null,
    item.unidadeOrgao?.ufSigla ? `UF: ${item.unidadeOrgao.ufSigla}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function POST() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { start, end } = getDateRange();

    const modalidade = 10;
    const tamanhoPagina = 10;
    const maxPages = 5;
    const maxImports = 5;

    let imported = 0;
    let duplicates = 0;
    let ignoredClosed = 0;
    let errors = 0;
    let processed = 0;

    const details = [];

    for (let page = 1; page <= maxPages; page++) {
      if (imported >= maxImports) break;

      const url = `https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao?dataInicial=${start}&dataFinal=${end}&codigoModalidadeContratacao=${modalidade}&pagina=${page}&tamanhoPagina=${tamanhoPagina}`;

      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
        },
        cache: "no-store",
      });

      if (!response.ok) {
        const text = await response.text();

        return NextResponse.json(
          {
            error: "Não foi possível consultar a API do PNCP.",
            status: response.status,
            details: text.slice(0, 1000),
          },
          { status: 500 }
        );
      }

     const raw = await response.text();

if (!raw.trim()) {
  break;
}

let result;

try {
  result = JSON.parse(raw);
} catch (error) {
  console.error("ERRO_JSON_PNCP:", raw.slice(0, 1000));
  break;
}

const items: PncpItem[] = result?.data || [];

      if (!items.length) break;

      for (const item of items) {
        if (imported >= maxImports) break;

        processed++;

        try {
          const title = item.objetoCompra?.trim();

          if (!title) {
            errors++;
            details.push({
              title: "Sem título",
              status: "error",
              error: "Objeto da compra não informado.",
            });
            continue;
          }

          const openingDate = toDateOnly(item.dataAberturaProposta);
          const closingDate = toDateOnly(item.dataEncerramentoProposta);

          if (isClosed(closingDate)) {
            ignoredClosed++;
            details.push({
              title,
              status: "closed_ignored",
            });
            continue;
          }

          const sourceUrl = getOfficialUrl(item);

          const { data: duplicateByUrl } = await supabase
            .from("grants")
            .select("id, code")
            .eq("source_url", sourceUrl)
            .maybeSingle();

          if (duplicateByUrl) {
            duplicates++;
            details.push({
              title,
              status: "duplicate",
              code: duplicateByUrl.code,
            });
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
            details.push({
              title,
              status: "duplicate",
              code: duplicateByTitle.code,
            });
            continue;
          }

          const { count } = await supabase
            .from("grants")
            .select("*", { count: "exact", head: true });

          const code = `EDITAL-${String((count || 0) + 1).padStart(4, "0")}`;

          const { error: insertError } = await supabase.from("grants").insert([
            {
              code,
              title,
              state_scope: item.unidadeOrgao?.ufNome || null,
              area: "Contratações públicas",
              opening_date: openingDate,
              closing_date: closingDate,
              total_value:
                item.valorTotalEstimado || item.valorTotalHomologado || null,
              value_per_project: null,
              source: "PNCP",
              source_url: sourceUrl,
              sender_name: "Terra7 IA",
              notes: buildNotes(item),
              raw_text: JSON.stringify(item, null, 2),
            },
          ]);

          if (insertError) {
            errors++;
            details.push({
              title,
              status: "error",
              error: insertError.message,
            });
            continue;
          }

          imported++;
          details.push({
            title,
            status: "imported",
            code,
          });
        } catch (error) {
          console.error("ERRO_IMPORTAR_PNCP_ITEM:", error);
          errors++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      source: "PNCP",
      processed,
      imported,
      duplicates,
      ignoredClosed,
      errors,
      details,
      message: `PNCP: ${imported} importados, ${duplicates} duplicados, ${ignoredClosed} encerrados ignorados, ${errors} erros.`,
    });
  } catch (error) {
    console.error("ERRO_IMPORTAR_PNCP:", error);

    return NextResponse.json(
      { error: "Erro interno ao importar editais do PNCP." },
      { status: 500 }
    );
  }
}