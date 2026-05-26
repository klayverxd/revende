"use client";

import { useState, useActionState } from "react";
import Link from "next/link";
import { registerAction } from "./actions";
import { createClient as createBrowserClient } from "@/lib/supabase/client";

const initialState = { error: "" };

export default function RegisterPage() {
	const [state, formAction, pending] = useActionState(
		registerAction,
		initialState
	);
	const [oauthPending, setOauthPending] = useState(false);
	const [oauthError, setOauthError] = useState("");

	async function handleGoogleRegister() {
		setOauthPending(true);
		setOauthError("");
		const supabase = createBrowserClient();
		const { error } = await supabase.auth.signInWithOAuth({
			provider: "google",
			options: { redirectTo: `${globalThis.location.origin}/auth/callback` },
		});
		if (error) {
			setOauthError("Não foi possível continuar com Google. Tente novamente.");
			setOauthPending(false);
		}
	}

	return (
		<div className="min-h-screen flex items-center justify-center bg-[#F4F8FD]">
			<div className="w-full max-w-sm">
				<div className="bg-white rounded-2xl shadow-sm border border-[#B5D4F4] px-8 py-10">
					<div className="mb-8 text-center">
						<h1 className="text-2xl font-bold text-[#0C447C] tracking-tight">
							Revendê
						</h1>
						<p className="text-sm text-gray-500 mt-1">Criar nova conta</p>
					</div>

					<button
						type="button"
						onClick={handleGoogleRegister}
						disabled={oauthPending || pending}
						className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed text-sm font-medium py-2.5 transition-colors"
					>
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
							<path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.659 32.657 29.24 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.27 4 24 4 12.954 4 4 12.954 4 24s8.954 20 20 20 20-8.954 20-20c0-1.341-.138-2.65-.389-3.917Z"/>
							<path fill="#FF3D00" d="M6.306 14.691 12.88 19.51C14.66 15.108 18.969 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.27 4 24 4c-7.682 0-14.417 4.337-17.694 10.691Z"/>
							<path fill="#4CAF50" d="M24 44c5.168 0 9.86-1.977 13.409-5.193l-6.19-5.238C29.146 35.091 26.715 36 24 36c-5.219 0-9.624-3.33-11.292-7.957l-6.525 5.025C9.418 39.556 16.227 44 24 44Z"/>
							<path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.786 2.216-2.213 4.137-4.084 5.569l.003-.001 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917Z"/>
						</svg>
						{oauthPending ? "Redirecionando..." : "Continuar com Google"}
					</button>

					<div className="my-5 flex items-center gap-3">
						<div className="h-px flex-1 bg-gray-200" />
						<span className="text-xs text-gray-500">ou</span>
						<div className="h-px flex-1 bg-gray-200" />
					</div>

					{oauthError && (
						<p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">
							{oauthError}
						</p>
					)}

					<form action={formAction} className="space-y-5">
						<div className="space-y-1">
							<label
								htmlFor="nome"
								className="block text-sm font-medium text-gray-700"
							>
								Nome
							</label>
							<input
								id="nome"
								name="nome"
								type="text"
								autoComplete="name"
								required
								className="w-full rounded-lg border border-[#B5D4F4] bg-[#F4F8FD] px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#185FA5] focus:border-transparent"
								placeholder="Seu nome"
							/>
						</div>

						<div className="space-y-1">
							<label
								htmlFor="email"
								className="block text-sm font-medium text-gray-700"
							>
								E-mail
							</label>
							<input
								id="email"
								name="email"
								type="email"
								autoComplete="email"
								required
								className="w-full rounded-lg border border-[#B5D4F4] bg-[#F4F8FD] px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#185FA5] focus:border-transparent"
								placeholder="seu@email.com"
							/>
						</div>

						<div className="space-y-1">
							<label
								htmlFor="password"
								className="block text-sm font-medium text-gray-700"
							>
								Senha
							</label>
							<input
								id="password"
								name="password"
								type="password"
								autoComplete="new-password"
								required
								minLength={6}
								className="w-full rounded-lg border border-[#B5D4F4] bg-[#F4F8FD] px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#185FA5] focus:border-transparent"
								placeholder="Mínimo 6 caracteres"
							/>
						</div>

						{state.error && (
							<p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
								{state.error}
							</p>
						)}

						<button
							type="submit"
							disabled={pending}
							className="w-full rounded-lg bg-[#185FA5] hover:bg-[#0C447C] disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium py-2.5 transition-colors"
						>
							{pending ? "Criando conta…" : "Criar conta"}
						</button>
					</form>

					<p className="mt-6 text-center text-sm text-gray-500">
						Já tem conta?{" "}
						<Link
							href="/login"
							className="text-[#185FA5] hover:underline font-medium"
						>
							Entrar
						</Link>
					</p>
				</div>
			</div>
		</div>
	);
}
