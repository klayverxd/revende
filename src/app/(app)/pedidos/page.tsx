import { redirect } from "next/navigation";

/**
 * A esteira mudou de endereço: /pedidos virou /producao, que é o nome do
 * módulo. Links antigos e a home do PWA continuam funcionando por aqui.
 */
export default function PedidosPage() {
	redirect("/producao");
}
