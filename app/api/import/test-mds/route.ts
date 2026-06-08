import { NextResponse } from "next/server";

export async function GET() {
  try {
   
      const url =
  "https://www.gov.br/mds/pt-br/acesso-a-informacao/participacao-social/editais-de-chamamento-publico";

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Terra7Editais/1.0",
        Accept: "text/html",
      },
      cache: "no-store",
    });

    const html = await response.text();

    const hrefs = Array.from(
      html.matchAll(/href=["']([^"']+)["']/gi)
    ).map((match) => match[1]);

    const titles = Array.from(
      html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi)
    )
      .map((match) => ({
        href: match[1],
        text: match[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
      }))
      .filter((item) => item.text.length > 5)
      .slice(0, 50);

    const firstText = html
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .slice(0, 5000);

      const editalPages = hrefs.filter(
  (link) =>
    link.includes("editais-de-chamamento-publico") ||
    link.includes("editais-em-selecao") ||
    link.includes("edital-sociedade-civil")
);

    const editalMatches = html.match(
      /(edital|editais|chamada|chamamento|oportunidade|inscri[cç][aã]o)/gi
    );

    const editalLinks = hrefs.filter(
  (link) =>
    link.toLowerCase().includes("edital") ||
    link.toLowerCase().includes("chamamento") ||
    link.toLowerCase().includes("selecao") ||
    link.toLowerCase().includes("seleção")
);

    return NextResponse.json({
      status: response.status,
      htmlSize: html.length,
      linksFound: hrefs.length,
      editalWordsFound: editalMatches?.length || 0,
      editalLinks: editalLinks.slice(0, 100),
      editalPages,
      sampleLinks: hrefs.slice(0, 50),
      titles,
      sampleText: firstText,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: String(error),
      },
      { status: 500 }
    );
  }
}