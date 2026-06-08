import { NextResponse } from "next/server";

export async function GET() {
  try {
    const response = await fetch(
"https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao?dataInicial=20260101&dataFinal=20261231&codigoModalidadeContratacao=10&pagina=1&tamanhoPagina=10",
      {
        headers: {
          Accept: "application/json",
        },
        cache: "no-store",
      }
    );

    const text = await response.text();

    return NextResponse.json({
      status: response.status,
      success: response.ok,
      preview: text.slice(0, 3000),
    });
  } catch (error: any) {
  return NextResponse.json(
    {
      error: error?.message,
      stack: error?.stack,
    },
    { status: 500 }
  );
}
}