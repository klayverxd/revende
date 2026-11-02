"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { useToast } from "@/components/ui";
import { urlExtrato } from "@/lib/tokens";
import { regenerarTokenExtrato, definirExtratoAtivo } from "../actions";

interface Props {
	readonly revendedorId: string;
	readonly token: string;
	readonly ativo: boolean;
}

/**
 * O link usa `extrato_token`, nunca o `revendedor_id`. Trocar o token revoga
 * o link anterior imediatamente — é o que permite entregar o link a um
 * revendedor e cortar o acesso depois, sem apagar o cadastro.
 */
export function CopiarLinkExtrato({ revendedorId, token, ativo }: Props) {
	const [copied, setCopied] = useState(false);
	const [pendente, startTransition] = useTransition();
	const { showToast } = useToast();

	async function handleCopy() {
		await navigator.clipboard.writeText(
			urlExtrato(window.location.origin, token)
		);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	}

	function handleRegenerar() {
		if (
			!window.confirm(
				"Gerar um link novo? O link atual para de funcionar na hora — quem já tem ele não conseguirá mais abrir o extrato."
			)
		) {
			return;
		}
		startTransition(async () => {
			try {
				await regenerarTokenExtrato(revendedorId);
				showToast("Link novo gerado. O anterior foi revogado.", "success");
			} catch {
				showToast("Não foi possível gerar o link", "error");
			}
		});
	}

	function handleToggle() {
		startTransition(async () => {
			try {
				await definirExtratoAtivo(revendedorId, !ativo);
				showToast(
					ativo ? "Extrato desativado" : "Extrato reativado",
					"success"
				);
			} catch {
				showToast("Não foi possível alterar o extrato", "error");
			}
		});
	}

	return (
		<div className="flex flex-wrap items-center gap-2">
			<Button
				variant="secondary"
				size="sm"
				onClick={handleCopy}
				disabled={!ativo}
				title={
					ativo ? undefined : "Reative o extrato para compartilhar o link"
				}
			>
				{copied ? "Link copiado!" : "Copiar link do extrato"}
			</Button>
			<Button
				variant="ghost"
				size="sm"
				onClick={handleRegenerar}
				loading={pendente}
			>
				Gerar link novo
			</Button>
			<Button
				variant="ghost"
				size="sm"
				onClick={handleToggle}
				loading={pendente}
			>
				{ativo ? "Desativar extrato" : "Reativar extrato"}
			</Button>
		</div>
	);
}
