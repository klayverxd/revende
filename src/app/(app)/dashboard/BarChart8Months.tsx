"use client";

import {
	BarChart,
	Bar,
	CartesianGrid,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";

export interface MonthBar {
	mes: string;
	receita: number;
}

interface Props {
	readonly data: MonthBar[];
}

function fmtCurrency(v: number) {
	return v.toLocaleString("pt-BR", {
		style: "currency",
		currency: "BRL",
		maximumFractionDigits: 0,
	});
}

export default function BarChart8Months({ data }: Props) {
	return (
		<div className="h-72 w-full">
			<ResponsiveContainer width="100%" height="100%">
				<BarChart data={data} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
					<CartesianGrid strokeDasharray="3 3" stroke="#d8e7f7" />
					<XAxis
						dataKey="mes"
						stroke="#4b5563"
						tickLine={false}
						axisLine={false}
					/>
					<YAxis
						stroke="#4b5563"
						tickLine={false}
						axisLine={false}
						tickFormatter={v => `R$ ${Math.round(v / 1000)}k`}
					/>
					<Tooltip formatter={v => [fmtCurrency(Number(v ?? 0)), "Receita"]} />
					<Bar dataKey="receita" fill="#185FA5" radius={[6, 6, 0, 0]} />
				</BarChart>
			</ResponsiveContainer>
		</div>
	);
}
