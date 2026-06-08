import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");

  if (!url) {
    return NextResponse.json(
      { error: "URL não informada" },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Terra7Editais/1.0",
      },
      cache: "no-store",
    });

    const html = await response.text();

    const hrefs = Array.from(
  html.matchAll(/href=["']([^"']+)["']/gi)
).map((match) => match[1]);

const scripts = Array.from(
  html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)
).map((match) => match[1]);

const possibleApis = Array.from(
  html.matchAll(/https?:\/\/[^"' ]+|\/api\/[^"' ]+|\/[a-zA-Z0-9/_-]*feed[a-zA-Z0-9/_-]*/gi)
).map((match) => match[0]);

const editalMatches = html.match(
  /(edital|editais|chamada|chamadas|oportunidade|oportunidades|inscri[cç][aã]o)/gi
);

const firstText = html
  .replace(/<[^>]+>/g, " ")
  .replace(/\s+/g, " ")
  .slice(0, 5000);

return NextResponse.json({
  status: response.status,
  htmlSize: html.length,
  linksFound: hrefs.length,
  sampleLinks: hrefs.slice(0, 50),

  scriptSources: scripts,
  possibleApis: possibleApis.slice(0, 50),

  editalWordsFound: editalMatches?.length || 0,
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