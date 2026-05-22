import FinanceiroView from "./FinanceiroView";
import type { AcertoPendenteCard, AcertoHistoricoRow } from "./actions";

interface Props {
	readonly pendentes: AcertoPendenteCard[];
	readonly historico: AcertoHistoricoRow[];
}

export default function ComissaoTab({ pendentes, historico }: Props) {
	return <FinanceiroView pendentes={pendentes} historico={historico} />;
}
