import Link from "next/link";

/**
 * 404 da aplicação inteira.
 *
 * Serve também o `notFound()` do extrato público (`/r/[token]`), e por isso é
 * deliberadamente genérico: não distingue "token não existe" de "token
 * desativado" de "rota inexistente". Qualquer diferença aqui confirmaria a
 * existência de um token para quem estivesse sondando.
 */
export default function NaoEncontrado() {
	return (
		<div className="min-h-screen bg-[#F4F8FD] flex items-center justify-center px-4">
			<div className="flex flex-col items-center gap-4 text-center max-w-md">
				<p className="text-5xl font-bold text-[#B5D4F4]">404</p>

				<div className="flex flex-col gap-1">
					<h1 className="text-lg font-semibold text-gray-900">
						Página não encontrada
					</h1>
					<p className="text-sm text-gray-600">
						O endereço não existe, ou o link que você recebeu não está mais
						válido.
					</p>
				</div>

				<Link
					href="/dashboard"
					className="text-sm font-medium text-[#185FA5] hover:text-[#0C447C] underline"
				>
					Ir para o início
				</Link>
			</div>
		</div>
	);
}
