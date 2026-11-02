"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renderiza Markdown na descrição e nos comentários do card.
 *
 * Segurança: o `react-markdown` **não** interpreta HTML bruto por padrão — um
 * `<script>` no texto sai como texto literal. O plugin `rehype-raw`, que
 * habilitaria HTML, é deliberadamente mantido fora; se algum dia entrar,
 * precisa vir com sanitização.
 *
 * `remark-gfm` habilita tabela, riscado, autolink e lista de tarefas
 * (`- [x] feito`), que é o dialeto que as pessoas já escrevem.
 *
 * O estilo vem da classe `.markdown` em globals.css, porque o reset do
 * Tailwind zera headings e listas — sem isso o texto sai todo achatado.
 */
export default function Markdown({
	children,
	className = "",
}: {
	readonly children: string;
	readonly className?: string;
}) {
	return (
		<div className={`markdown ${className}`}>
			<ReactMarkdown
				remarkPlugins={[remarkGfm]}
				components={{
					// Link externo abre em nova aba e sem vazar o referrer.
					a: ({ href, children: filhos }) => (
						<a href={href} target="_blank" rel="noopener noreferrer nofollow">
							{filhos}
						</a>
					),
					// Checkbox do GFM é só leitura: marcar de verdade é papel da
					// checklist do card, que persiste.
					input: props => <input {...props} disabled readOnly />,
				}}
			>
				{children}
			</ReactMarkdown>
		</div>
	);
}
