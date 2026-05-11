import { createClient } from "@supabase/supabase-js";

/**
 * Client com service role — bypassa o RLS.
 * Usar apenas em Server Components / Server Actions.
 * Nunca expor ao cliente.
 */
export function createAdminClient() {
	return createClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.SUPABASE_SERVICE_ROLE_KEY!
	);
}
