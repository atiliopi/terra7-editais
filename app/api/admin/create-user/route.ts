import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  const body = await request.json();

  const { full_name, email, phone, password, role, status } = body;

  if (!full_name || !email || !password) {
    return NextResponse.json(
      { error: "Nome, email e senha são obrigatórios." },
      { status: 400 }
    );
  }

  const authHeader = request.headers.get("authorization");

  if (!authHeader) {
    return NextResponse.json(
      { error: "Usuário não autenticado." },
      { status: 401 }
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
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
      { error: "Usuário não autenticado." },
      { status: 401 }
    );
  }

  const { data: profile } = await userClient
    .from("profiles")
    .select("role,status")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin" || profile.status !== "approved") {
    return NextResponse.json(
      { error: "Apenas administradores podem criar usuários." },
      { status: 403 }
    );
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: createdUser, error: createError } =
    await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

  if (createError || !createdUser.user) {
    return NextResponse.json(
      { error: createError?.message || "Erro ao criar usuário." },
      { status: 400 }
    );
  }

  const { error: profileError } = await adminClient.from("profiles").insert({
    id: createdUser.user.id,
    full_name,
    email,
    phone,
    role: role || "viewer",
    status: status || "approved",
  });

  if (profileError) {
    return NextResponse.json(
      { error: "Usuário criado, mas erro ao salvar perfil." },
      { status: 400 }
    );
  }

  return NextResponse.json({
    success: true,
  });
}