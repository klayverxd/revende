"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

interface Props {
	readonly revendedorId: string;
}

export function CopiarLinkExtrato({ revendedorId }: Props) {
	const [copied, setCopied] = useState(false);

	async function handleCopy() {
		const url = `${window.location.origin}/r/${revendedorId}`;
		await navigator.clipboard.writeText(url);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	}

	return (
		<Button variant="secondary" size="sm" onClick={handleCopy}>
			{copied ? "Link copiado!" : "Copiar link do extrato"}
		</Button>
	);
}
