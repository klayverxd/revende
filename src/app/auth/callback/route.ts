import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function GET(request: NextRequest) {
	const requestUrl = new URL(request.url);
	const code = requestUrl.searchParams.get("code");

	if (!code) {
		return NextResponse.redirect(new URL("/login?error=auth", request.url));
	}

	const response = NextResponse.redirect(new URL("/dashboard", request.url));

	const supabase = createServerClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
		{
			cookies: {
				getAll() {
					return request.cookies.getAll();
				},
				setAll(cookiesToSet) {
					cookiesToSet.forEach(({ name, value, options }) =>
						response.cookies.set(name, value, options)
					);
				},
			},
		}
	);

	const { data, error } = await supabase.auth.exchangeCodeForSession(code);

	if (error) {
		return NextResponse.redirect(new URL("/login?error=auth", request.url));
	}

	// Vincula convite pendente — SECURITY DEFINER ignora RLS e usa o JWT
	// da sessão recém-criada (cookies ainda não propagados na request)
	if (data.session) {
		await supabase.rpc("vincular_convite_pendente");
	}

	return response;
}
