"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui";

/**
 * Boundary de erro das rotas autenticadas.
 *
 * Antes disso o projeto não tinha nenhum `error.tsx`: uma única query do
 * Supabase que falhasse derrubava a rota inteira e o usuário via a tela de
 * erro crua do Next, sem caminho de volta.
 */
export default function ErroDoApp({
	error,
	reset,
}: {
	readonly error: Error & { digest?: string };
	readonly reset: () => void;
}) {
	useEffect(() => {
		// Sem serviço de observabilidade ainda; o console do servidor é o que
		// existe. O `digest` é o que correlaciona com o log da Vercel.
		console.error("Erro na rota:", error);
	}, [error]);

	return (
		<div className="flex flex-col items-center justify-center gap-4 py-16 px-4 text-center">
			<div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
				<span className="text-red-800 text-xl font-bold">!</span>
			</div>

			<div className="flex flex-col gap-1">
				<h2 className="text-lg font-semibold text-gray-900">
					Algo deu errado nesta tela
				</h2>
				<p className="text-sm text-gray-600 max-w-md">
					Seus dados estão salvos. Tente carregar de novo — se continuar, volte
					ao início e tente por outro caminho.
				</p>
			</div>

			{error.digest && (
				<p className="text-xs text-gray-400 font-mono">
					Referência: {error.digest}
				</p>
			)}

			<div className="flex gap-2">
				<Button onClick={reset}>Tentar de novo</Button>
				<Button
					variant="secondary"
					onClick={() => {
						window.location.href = "/dashboard";
					}}
				>
					Ir para o início
				</Button>
			</div>
		</div>
	);
}
