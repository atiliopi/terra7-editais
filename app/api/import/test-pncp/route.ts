import { NextResponse } from "next/server";

export async function GET() {
  try {
    const response = await fetch(
"https://pncp.gov.br/api/consulta/v1/modalidades",
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
  } catch (error) {
    return NextResponse.json(
      {
        error: String(error),
      },
      { status: 500 }
    );
  }
}