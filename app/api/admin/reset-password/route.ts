import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  const body = await request.json();

  const { userId, newPassword } = body;

  if (!userId || !newPassword) {
    return NextResponse.json(
      { error: "Dados inválidos." },
      { status: 400 }
    );
  }

  const authHeader = request.headers.get("authorization");

  if (!authHeader) {
    return NextResponse.json(
      { error: "Não autenticado." },
      { status: 401 }
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

  const {
    data: { user },
  } = await userClient.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Não autenticado." },
      { status: 401 }
    );
  }

  const { data: profile } = await userClient
    .from("profiles")
    .select("role,status")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return NextResponse.json(
      { error: "Apenas admin pode fazer isso." },
      { status: 403 }
    );
  }

  const adminClient = createClient(supabaseUrl, serviceKey);

  const { error } = await adminClient.auth.admin.updateUserById(userId, {
    password: newPassword,
  });

  if (error) {
    return NextResponse.json(
      { error: "Erro ao atualizar senha." },
      { status: 400 }
    );
  }

  return NextResponse.json({ success: true });
}