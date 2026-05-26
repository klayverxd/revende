"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type RegisterState = { error: string };

export async function registerAction(
	_prevState: RegisterState,
	formData: FormData
): Promise<RegisterState> {
	const email = (formData.get("email") as string).trim().toLowerCase();
	const password = formData.get("password") as string;
	const nome = (formData.get("nome") as string).trim();

	if (!email || !password || !nome) {
		return { error: "Preencha todos os campos." };
	}
	if (password.length < 6) {
		return { error: "A senha deve ter pelo menos 6 caracteres." };
	}

	const supabase = await createClient();

	const { data, error } = await supabase.auth.signUp({
		email,
		password,
		options: { data: { nome } },
	});

	if (error) {
		if (error.message.toLowerCase().includes("already registered")) {
			return { error: "Este e-mail já está cadastrado. Faça login." };
		}
		return { error: "Não foi possível criar a conta. Tente novamente." };
	}

	// Vincula automaticamente convite pendente para este e-mail
	if (data.user) {
		await supabase
			.from("membro_equipe")
			.update({ membro_id: data.user.id })
			.eq("email_convidado", email)
			.is("membro_id", null);
	}

	redirect("/dashboard");
}
