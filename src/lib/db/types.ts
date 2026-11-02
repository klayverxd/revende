/**
 * GERADO AUTOMATICAMENTE — não edite à mão.
 *
 * Fonte: supabase/migrations/*.sql, aplicadas num Postgres limpo.
 * Regenerar:  npm run db:types
 * Verificar:  npm run db:types:check   (usado no CI)
 *
 * 26 migrations · 26 tabelas · 7 enums
 */

export type Json =
	| string
	| number
	| boolean
	| null
	| { [key: string]: Json | undefined }
	| Json[];

export type Database = {
	public: {
		Tables: {
			acerto: {
				Row: {
					acerto_id: string;
					revendedor_id: string;
					envio_id: string;
					modelo_acerto: Database["public"]["Enums"]["modelo_acerto_enum"];
					comissao_calculada: number | null;
					valor_liquido: number | null;
					valor_a_receber: number | null;
					valor_repassado: number | null;
					status: Database["public"]["Enums"]["acerto_status_enum"];
					data_recebimento: string | null;
					observacao: string | null;
					deleted_at: string | null;
					created_at: string;
					updated_at: string;
					user_id: string | null;
					data_conferencia: string | null;
					criado_por: string | null;
				};
				Insert: {
					acerto_id?: string;
					revendedor_id: string;
					envio_id: string;
					modelo_acerto: Database["public"]["Enums"]["modelo_acerto_enum"];
					comissao_calculada?: number | null;
					valor_liquido?: number | null;
					valor_a_receber?: number | null;
					valor_repassado?: number | null;
					status?: Database["public"]["Enums"]["acerto_status_enum"];
					data_recebimento?: string | null;
					observacao?: string | null;
					deleted_at?: string | null;
					created_at?: string;
					updated_at?: string;
					user_id?: string | null;
					data_conferencia?: string | null;
					criado_por?: string | null;
				};
				Update: {
					acerto_id?: string;
					revendedor_id?: string;
					envio_id?: string;
					modelo_acerto?: Database["public"]["Enums"]["modelo_acerto_enum"];
					comissao_calculada?: number | null;
					valor_liquido?: number | null;
					valor_a_receber?: number | null;
					valor_repassado?: number | null;
					status?: Database["public"]["Enums"]["acerto_status_enum"];
					data_recebimento?: string | null;
					observacao?: string | null;
					deleted_at?: string | null;
					created_at?: string;
					updated_at?: string;
					user_id?: string | null;
					data_conferencia?: string | null;
					criado_por?: string | null;
				};
				Relationships: [
					{
						foreignKeyName: "acerto_envio_id_fkey";
						columns: ["envio_id"];
						isOneToOne: false;
						referencedRelation: "envio";
						referencedColumns: ["envio_id"];
					},
					{
						foreignKeyName: "acerto_revendedor_id_fkey";
						columns: ["revendedor_id"];
						isOneToOne: false;
						referencedRelation: "revendedor";
						referencedColumns: ["revendedor_id"];
					},
				];
			};
			calculo_custo: {
				Row: {
					calculo_id: string;
					equipamento_id: string | null;
					tempo_impressao_min: number;
					materias_primas: Json;
					pct_falhas: number;
					custo_energia: number | null;
					custo_materias_primas: number | null;
					custo_depreciacao: number | null;
					custo_falhas: number | null;
					custo_total: number | null;
					quantidade: number;
					custo_unitario: number | null;
					salvo_em_modelo_id: string | null;
					deleted_at: string | null;
					created_at: string;
					updated_at: string;
					user_id: string | null;
					custo_extra: number | null;
					num_placas: number | null;
					custo_extra_id: string | null;
					criado_por: string | null;
				};
				Insert: {
					calculo_id?: string;
					equipamento_id?: string | null;
					tempo_impressao_min: number;
					materias_primas?: Json;
					pct_falhas?: number;
					custo_energia?: number | null;
					custo_materias_primas?: number | null;
					custo_depreciacao?: number | null;
					custo_falhas?: number | null;
					custo_total?: number | null;
					quantidade?: number;
					custo_unitario?: number | null;
					salvo_em_modelo_id?: string | null;
					deleted_at?: string | null;
					created_at?: string;
					updated_at?: string;
					user_id?: string | null;
					custo_extra?: number | null;
					num_placas?: number | null;
					custo_extra_id?: string | null;
					criado_por?: string | null;
				};
				Update: {
					calculo_id?: string;
					equipamento_id?: string | null;
					tempo_impressao_min?: number;
					materias_primas?: Json;
					pct_falhas?: number;
					custo_energia?: number | null;
					custo_materias_primas?: number | null;
					custo_depreciacao?: number | null;
					custo_falhas?: number | null;
					custo_total?: number | null;
					quantidade?: number;
					custo_unitario?: number | null;
					salvo_em_modelo_id?: string | null;
					deleted_at?: string | null;
					created_at?: string;
					updated_at?: string;
					user_id?: string | null;
					custo_extra?: number | null;
					num_placas?: number | null;
					custo_extra_id?: string | null;
					criado_por?: string | null;
				};
				Relationships: [
					{
						foreignKeyName: "calculo_custo_equipamento_id_fkey";
						columns: ["equipamento_id"];
						isOneToOne: false;
						referencedRelation: "config_equipamento";
						referencedColumns: ["equipamento_id"];
					},
					{
						foreignKeyName: "calculo_custo_salvo_em_modelo_id_fkey";
						columns: ["salvo_em_modelo_id"];
						isOneToOne: false;
						referencedRelation: "modelo";
						referencedColumns: ["modelo_id"];
					},
				];
			};
			cliente: {
				Row: {
					cliente_id: string;
					user_id: string;
					nome: string;
					telefone: string | null;
					email: string | null;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					cliente_id?: string;
					user_id?: string;
					nome: string;
					telefone?: string | null;
					email?: string | null;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					cliente_id?: string;
					user_id?: string;
					nome?: string;
					telefone?: string | null;
					email?: string | null;
					created_at?: string;
					updated_at?: string;
				};
				Relationships: [];
			};
			config_custo_extra: {
				Row: {
					custo_extra_id: string;
					nome: string;
					valor: number;
					ativo: boolean;
					user_id: string | null;
					created_at: string;
					updated_at: string;
					deleted_at: string | null;
				};
				Insert: {
					custo_extra_id?: string;
					nome: string;
					valor: number;
					ativo?: boolean;
					user_id?: string | null;
					created_at?: string;
					updated_at?: string;
					deleted_at?: string | null;
				};
				Update: {
					custo_extra_id?: string;
					nome?: string;
					valor?: number;
					ativo?: boolean;
					user_id?: string | null;
					created_at?: string;
					updated_at?: string;
					deleted_at?: string | null;
				};
				Relationships: [];
			};
			config_energia: {
				Row: {
					id: string;
					preco_kwh: number;
					atualizado_em: string;
					created_at: string;
					updated_at: string;
					user_id: string | null;
					pct_falhas: number;
				};
				Insert: {
					id?: string;
					preco_kwh: number;
					atualizado_em?: string;
					created_at?: string;
					updated_at?: string;
					user_id?: string | null;
					pct_falhas?: number;
				};
				Update: {
					id?: string;
					preco_kwh?: number;
					atualizado_em?: string;
					created_at?: string;
					updated_at?: string;
					user_id?: string | null;
					pct_falhas?: number;
				};
				Relationships: [];
			};
			config_equipamento: {
				Row: {
					equipamento_id: string;
					nome: string;
					potencia_watts: number;
					depreciacao_hora: number;
					ativa: boolean;
					deleted_at: string | null;
					created_at: string;
					updated_at: string;
					user_id: string | null;
					valor_maquina: number | null;
					tempo_meses: number | null;
					horas_por_dia: number | null;
					dias_por_mes: number | null;
				};
				Insert: {
					equipamento_id?: string;
					nome: string;
					potencia_watts: number;
					depreciacao_hora?: number;
					ativa?: boolean;
					deleted_at?: string | null;
					created_at?: string;
					updated_at?: string;
					user_id?: string | null;
					valor_maquina?: number | null;
					tempo_meses?: number | null;
					horas_por_dia?: number | null;
					dias_por_mes?: number | null;
				};
				Update: {
					equipamento_id?: string;
					nome?: string;
					potencia_watts?: number;
					depreciacao_hora?: number;
					ativa?: boolean;
					deleted_at?: string | null;
					created_at?: string;
					updated_at?: string;
					user_id?: string | null;
					valor_maquina?: number | null;
					tempo_meses?: number | null;
					horas_por_dia?: number | null;
					dias_por_mes?: number | null;
				};
				Relationships: [];
			};
			config_materia_prima: {
				Row: {
					materia_prima_id: string;
					nome: string;
					preco_por_unidade: number;
					unidade_medida: string;
					ativo: boolean;
					deleted_at: string | null;
					created_at: string;
					updated_at: string;
					user_id: string | null;
				};
				Insert: {
					materia_prima_id?: string;
					nome: string;
					preco_por_unidade: number;
					unidade_medida: string;
					ativo?: boolean;
					deleted_at?: string | null;
					created_at?: string;
					updated_at?: string;
					user_id?: string | null;
				};
				Update: {
					materia_prima_id?: string;
					nome?: string;
					preco_por_unidade?: number;
					unidade_medida?: string;
					ativo?: boolean;
					deleted_at?: string | null;
					created_at?: string;
					updated_at?: string;
					user_id?: string | null;
				};
				Relationships: [];
			};
			envio: {
				Row: {
					envio_id: string;
					revendedor_id: string;
					data_envio: string;
					status: Database["public"]["Enums"]["envio_status_enum"];
					observacao: string | null;
					deleted_at: string | null;
					created_at: string;
					updated_at: string;
					user_id: string | null;
					criado_por: string | null;
				};
				Insert: {
					envio_id?: string;
					revendedor_id: string;
					data_envio?: string;
					status?: Database["public"]["Enums"]["envio_status_enum"];
					observacao?: string | null;
					deleted_at?: string | null;
					created_at?: string;
					updated_at?: string;
					user_id?: string | null;
					criado_por?: string | null;
				};
				Update: {
					envio_id?: string;
					revendedor_id?: string;
					data_envio?: string;
					status?: Database["public"]["Enums"]["envio_status_enum"];
					observacao?: string | null;
					deleted_at?: string | null;
					created_at?: string;
					updated_at?: string;
					user_id?: string | null;
					criado_por?: string | null;
				};
				Relationships: [
					{
						foreignKeyName: "envio_revendedor_id_fkey";
						columns: ["revendedor_id"];
						isOneToOne: false;
						referencedRelation: "revendedor";
						referencedColumns: ["revendedor_id"];
					},
				];
			};
			envio_draft: {
				Row: {
					id: string;
					user_id: string;
					draft_json: Json;
					updated_at: string;
				};
				Insert: {
					id?: string;
					user_id: string;
					draft_json?: Json;
					updated_at?: string;
				};
				Update: {
					id?: string;
					user_id?: string;
					draft_json?: Json;
					updated_at?: string;
				};
				Relationships: [];
			};
			envio_item: {
				Row: {
					envio_item_id: string;
					envio_id: string;
					modelo_id: string;
					modelo_acerto: Database["public"]["Enums"]["modelo_acerto_enum"];
					qtd_enviada: number;
					preco_unitario: number | null;
					preco_2mais: number | null;
					valor_minimo_unit: number | null;
					preco_origem: Database["public"]["Enums"]["preco_origem_enum"];
					qtd_vendida: number | null;
					qtd_devolvida: number | null;
					valor_total_venda: number | null;
					valor_a_receber: number | null;
					preco_cliente: number | null;
					modo_valor: Database["public"]["Enums"]["modo_valor_enum"];
					deleted_at: string | null;
					created_at: string;
					updated_at: string;
					user_id: string | null;
					criado_por: string | null;
				};
				Insert: {
					envio_item_id?: string;
					envio_id: string;
					modelo_id: string;
					modelo_acerto: Database["public"]["Enums"]["modelo_acerto_enum"];
					qtd_enviada: number;
					preco_unitario?: number | null;
					preco_2mais?: number | null;
					valor_minimo_unit?: number | null;
					preco_origem: Database["public"]["Enums"]["preco_origem_enum"];
					qtd_vendida?: number | null;
					qtd_devolvida?: number | null;
					valor_total_venda?: number | null;
					valor_a_receber?: number | null;
					preco_cliente?: number | null;
					modo_valor?: Database["public"]["Enums"]["modo_valor_enum"];
					deleted_at?: string | null;
					created_at?: string;
					updated_at?: string;
					user_id?: string | null;
					criado_por?: string | null;
				};
				Update: {
					envio_item_id?: string;
					envio_id?: string;
					modelo_id?: string;
					modelo_acerto?: Database["public"]["Enums"]["modelo_acerto_enum"];
					qtd_enviada?: number;
					preco_unitario?: number | null;
					preco_2mais?: number | null;
					valor_minimo_unit?: number | null;
					preco_origem?: Database["public"]["Enums"]["preco_origem_enum"];
					qtd_vendida?: number | null;
					qtd_devolvida?: number | null;
					valor_total_venda?: number | null;
					valor_a_receber?: number | null;
					preco_cliente?: number | null;
					modo_valor?: Database["public"]["Enums"]["modo_valor_enum"];
					deleted_at?: string | null;
					created_at?: string;
					updated_at?: string;
					user_id?: string | null;
					criado_por?: string | null;
				};
				Relationships: [
					{
						foreignKeyName: "envio_item_envio_id_fkey";
						columns: ["envio_id"];
						isOneToOne: false;
						referencedRelation: "envio";
						referencedColumns: ["envio_id"];
					},
					{
						foreignKeyName: "envio_item_modelo_id_fkey";
						columns: ["modelo_id"];
						isOneToOne: false;
						referencedRelation: "modelo";
						referencedColumns: ["modelo_id"];
					},
				];
			};
			etiqueta: {
				Row: {
					etiqueta_id: string;
					nome: string;
					cor: string;
					ordem: number;
					user_id: string | null;
					deleted_at: string | null;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					etiqueta_id?: string;
					nome: string;
					cor?: string;
					ordem?: number;
					user_id?: string | null;
					deleted_at?: string | null;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					etiqueta_id?: string;
					nome?: string;
					cor?: string;
					ordem?: number;
					user_id?: string | null;
					deleted_at?: string | null;
					created_at?: string;
					updated_at?: string;
				};
				Relationships: [];
			};
			membro_equipe: {
				Row: {
					id: string;
					dono_id: string;
					membro_id: string | null;
					email_convidado: string;
					created_at: string;
				};
				Insert: {
					id?: string;
					dono_id?: string;
					membro_id?: string | null;
					email_convidado: string;
					created_at?: string;
				};
				Update: {
					id?: string;
					dono_id?: string;
					membro_id?: string | null;
					email_convidado?: string;
					created_at?: string;
				};
				Relationships: [];
			};
			modelo: {
				Row: {
					modelo_id: string;
					codigo: string | null;
					nome: string;
					descricao: string | null;
					custo_producao: number | null;
					estoque_minimo: number;
					ativo: boolean;
					deleted_at: string | null;
					created_at: string;
					updated_at: string;
					user_id: string | null;
					foto_url: string | null;
					is_coringa: boolean;
				};
				Insert: {
					modelo_id?: string;
					codigo?: string | null;
					nome: string;
					descricao?: string | null;
					custo_producao?: number | null;
					estoque_minimo?: number;
					ativo?: boolean;
					deleted_at?: string | null;
					created_at?: string;
					updated_at?: string;
					user_id?: string | null;
					foto_url?: string | null;
					is_coringa?: boolean;
				};
				Update: {
					modelo_id?: string;
					codigo?: string | null;
					nome?: string;
					descricao?: string | null;
					custo_producao?: number | null;
					estoque_minimo?: number;
					ativo?: boolean;
					deleted_at?: string | null;
					created_at?: string;
					updated_at?: string;
					user_id?: string | null;
					foto_url?: string | null;
					is_coringa?: boolean;
				};
				Relationships: [];
			};
			modelo_preco: {
				Row: {
					preco_id: string;
					modelo_id: string;
					rotulo: string;
					quantidade_minima: number;
					preco: number;
					eh_promocao: boolean;
					ativo: boolean;
					deleted_at: string | null;
					created_at: string;
					updated_at: string;
					user_id: string | null;
				};
				Insert: {
					preco_id?: string;
					modelo_id: string;
					rotulo: string;
					quantidade_minima?: number;
					preco: number;
					eh_promocao?: boolean;
					ativo?: boolean;
					deleted_at?: string | null;
					created_at?: string;
					updated_at?: string;
					user_id?: string | null;
				};
				Update: {
					preco_id?: string;
					modelo_id?: string;
					rotulo?: string;
					quantidade_minima?: number;
					preco?: number;
					eh_promocao?: boolean;
					ativo?: boolean;
					deleted_at?: string | null;
					created_at?: string;
					updated_at?: string;
					user_id?: string | null;
				};
				Relationships: [
					{
						foreignKeyName: "modelo_preco_modelo_id_fkey";
						columns: ["modelo_id"];
						isOneToOne: false;
						referencedRelation: "modelo";
						referencedColumns: ["modelo_id"];
					},
				];
			};
			pedido: {
				Row: {
					pedido_id: string;
					numero_pedido: string;
					data_pedido: string;
					canal: string;
					status: string;
					prioridade: string;
					cliente_nome: string | null;
					cliente_telefone: string | null;
					cliente_email: string | null;
					cliente_referencia: string | null;
					data_prazo: string | null;
					forma_pagamento: string | null;
					status_pagamento: string;
					valor_sinal: number | null;
					desconto_valor: number | null;
					data_inicio_producao: string | null;
					data_conclusao_producao: string | null;
					data_entrega: string | null;
					observacao: string | null;
					deleted_at: string | null;
					created_at: string;
					updated_at: string;
					user_id: string | null;
					taxa_marketplace_pct: number | null;
					custo_envio: number | null;
					outros_encargos: number | null;
					cliente_id: string | null;
					criado_por: string | null;
					titulo: string | null;
					descricao_md: string | null;
					responsavel_id: string | null;
					capa_url: string | null;
					prazo_concluido: boolean;
					ordem_esteira: number | null;
				};
				Insert: {
					pedido_id?: string;
					numero_pedido: string;
					data_pedido?: string;
					canal: string;
					status?: string;
					prioridade?: string;
					cliente_nome?: string | null;
					cliente_telefone?: string | null;
					cliente_email?: string | null;
					cliente_referencia?: string | null;
					data_prazo?: string | null;
					forma_pagamento?: string | null;
					status_pagamento?: string;
					valor_sinal?: number | null;
					desconto_valor?: number | null;
					data_inicio_producao?: string | null;
					data_conclusao_producao?: string | null;
					data_entrega?: string | null;
					observacao?: string | null;
					deleted_at?: string | null;
					created_at?: string;
					updated_at?: string;
					user_id?: string | null;
					taxa_marketplace_pct?: number | null;
					custo_envio?: number | null;
					outros_encargos?: number | null;
					cliente_id?: string | null;
					criado_por?: string | null;
					titulo?: string | null;
					descricao_md?: string | null;
					responsavel_id?: string | null;
					capa_url?: string | null;
					prazo_concluido?: boolean;
					ordem_esteira?: number | null;
				};
				Update: {
					pedido_id?: string;
					numero_pedido?: string;
					data_pedido?: string;
					canal?: string;
					status?: string;
					prioridade?: string;
					cliente_nome?: string | null;
					cliente_telefone?: string | null;
					cliente_email?: string | null;
					cliente_referencia?: string | null;
					data_prazo?: string | null;
					forma_pagamento?: string | null;
					status_pagamento?: string;
					valor_sinal?: number | null;
					desconto_valor?: number | null;
					data_inicio_producao?: string | null;
					data_conclusao_producao?: string | null;
					data_entrega?: string | null;
					observacao?: string | null;
					deleted_at?: string | null;
					created_at?: string;
					updated_at?: string;
					user_id?: string | null;
					taxa_marketplace_pct?: number | null;
					custo_envio?: number | null;
					outros_encargos?: number | null;
					cliente_id?: string | null;
					criado_por?: string | null;
					titulo?: string | null;
					descricao_md?: string | null;
					responsavel_id?: string | null;
					capa_url?: string | null;
					prazo_concluido?: boolean;
					ordem_esteira?: number | null;
				};
				Relationships: [
					{
						foreignKeyName: "pedido_cliente_id_fkey";
						columns: ["cliente_id"];
						isOneToOne: false;
						referencedRelation: "cliente";
						referencedColumns: ["cliente_id"];
					},
				];
			};
			pedido_anexo: {
				Row: {
					anexo_id: string;
					pedido_id: string;
					url: string;
					nome: string;
					tipo: string | null;
					tamanho_bytes: number | null;
					user_id: string | null;
					criado_por: string | null;
					deleted_at: string | null;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					anexo_id?: string;
					pedido_id: string;
					url: string;
					nome: string;
					tipo?: string | null;
					tamanho_bytes?: number | null;
					user_id?: string | null;
					criado_por?: string | null;
					deleted_at?: string | null;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					anexo_id?: string;
					pedido_id?: string;
					url?: string;
					nome?: string;
					tipo?: string | null;
					tamanho_bytes?: number | null;
					user_id?: string | null;
					criado_por?: string | null;
					deleted_at?: string | null;
					created_at?: string;
					updated_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: "pedido_anexo_pedido_id_fkey";
						columns: ["pedido_id"];
						isOneToOne: false;
						referencedRelation: "pedido";
						referencedColumns: ["pedido_id"];
					},
				];
			};
			pedido_checklist: {
				Row: {
					checklist_id: string;
					pedido_id: string;
					titulo: string;
					ordem: number;
					user_id: string | null;
					criado_por: string | null;
					deleted_at: string | null;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					checklist_id?: string;
					pedido_id: string;
					titulo: string;
					ordem?: number;
					user_id?: string | null;
					criado_por?: string | null;
					deleted_at?: string | null;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					checklist_id?: string;
					pedido_id?: string;
					titulo?: string;
					ordem?: number;
					user_id?: string | null;
					criado_por?: string | null;
					deleted_at?: string | null;
					created_at?: string;
					updated_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: "pedido_checklist_pedido_id_fkey";
						columns: ["pedido_id"];
						isOneToOne: false;
						referencedRelation: "pedido";
						referencedColumns: ["pedido_id"];
					},
				];
			};
			pedido_checklist_item: {
				Row: {
					item_id: string;
					checklist_id: string;
					texto: string;
					concluido: boolean;
					concluido_em: string | null;
					ordem: number;
					user_id: string | null;
					criado_por: string | null;
					deleted_at: string | null;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					item_id?: string;
					checklist_id: string;
					texto: string;
					concluido?: boolean;
					concluido_em?: string | null;
					ordem?: number;
					user_id?: string | null;
					criado_por?: string | null;
					deleted_at?: string | null;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					item_id?: string;
					checklist_id?: string;
					texto?: string;
					concluido?: boolean;
					concluido_em?: string | null;
					ordem?: number;
					user_id?: string | null;
					criado_por?: string | null;
					deleted_at?: string | null;
					created_at?: string;
					updated_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: "pedido_checklist_item_checklist_id_fkey";
						columns: ["checklist_id"];
						isOneToOne: false;
						referencedRelation: "pedido_checklist";
						referencedColumns: ["checklist_id"];
					},
				];
			};
			pedido_comentario: {
				Row: {
					comentario_id: string;
					pedido_id: string;
					texto_md: string;
					user_id: string | null;
					criado_por: string | null;
					deleted_at: string | null;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					comentario_id?: string;
					pedido_id: string;
					texto_md: string;
					user_id?: string | null;
					criado_por?: string | null;
					deleted_at?: string | null;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					comentario_id?: string;
					pedido_id?: string;
					texto_md?: string;
					user_id?: string | null;
					criado_por?: string | null;
					deleted_at?: string | null;
					created_at?: string;
					updated_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: "pedido_comentario_pedido_id_fkey";
						columns: ["pedido_id"];
						isOneToOne: false;
						referencedRelation: "pedido";
						referencedColumns: ["pedido_id"];
					},
				];
			};
			pedido_etiqueta: {
				Row: {
					pedido_id: string;
					etiqueta_id: string;
					user_id: string | null;
					created_at: string;
				};
				Insert: {
					pedido_id: string;
					etiqueta_id: string;
					user_id?: string | null;
					created_at?: string;
				};
				Update: {
					pedido_id?: string;
					etiqueta_id?: string;
					user_id?: string | null;
					created_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: "pedido_etiqueta_etiqueta_id_fkey";
						columns: ["etiqueta_id"];
						isOneToOne: false;
						referencedRelation: "etiqueta";
						referencedColumns: ["etiqueta_id"];
					},
					{
						foreignKeyName: "pedido_etiqueta_pedido_id_fkey";
						columns: ["pedido_id"];
						isOneToOne: false;
						referencedRelation: "pedido";
						referencedColumns: ["pedido_id"];
					},
				];
			};
			pedido_item: {
				Row: {
					item_id: string;
					pedido_id: string;
					tipo: string;
					modelo_id: string | null;
					descricao_custom: string | null;
					tempo_impressao_min: number | null;
					peso_g: number | null;
					num_placas: number | null;
					quantidade: number;
					preco_venda_unit: number | null;
					custo_unit: number | null;
					observacao: string | null;
					produto_codigo_snapshot: string | null;
					produto_nome_snapshot: string | null;
					custo_unit_snapshot: number | null;
					equipamento_id: string | null;
					materia_prima_id: string | null;
					created_at: string;
					user_id: string | null;
					updated_at: string;
					deleted_at: string | null;
					criado_por: string | null;
				};
				Insert: {
					item_id?: string;
					pedido_id: string;
					tipo: string;
					modelo_id?: string | null;
					descricao_custom?: string | null;
					tempo_impressao_min?: number | null;
					peso_g?: number | null;
					num_placas?: number | null;
					quantidade?: number;
					preco_venda_unit?: number | null;
					custo_unit?: number | null;
					observacao?: string | null;
					produto_codigo_snapshot?: string | null;
					produto_nome_snapshot?: string | null;
					custo_unit_snapshot?: number | null;
					equipamento_id?: string | null;
					materia_prima_id?: string | null;
					created_at?: string;
					user_id?: string | null;
					updated_at?: string;
					deleted_at?: string | null;
					criado_por?: string | null;
				};
				Update: {
					item_id?: string;
					pedido_id?: string;
					tipo?: string;
					modelo_id?: string | null;
					descricao_custom?: string | null;
					tempo_impressao_min?: number | null;
					peso_g?: number | null;
					num_placas?: number | null;
					quantidade?: number;
					preco_venda_unit?: number | null;
					custo_unit?: number | null;
					observacao?: string | null;
					produto_codigo_snapshot?: string | null;
					produto_nome_snapshot?: string | null;
					custo_unit_snapshot?: number | null;
					equipamento_id?: string | null;
					materia_prima_id?: string | null;
					created_at?: string;
					user_id?: string | null;
					updated_at?: string;
					deleted_at?: string | null;
					criado_por?: string | null;
				};
				Relationships: [
					{
						foreignKeyName: "pedido_item_equipamento_id_fkey";
						columns: ["equipamento_id"];
						isOneToOne: false;
						referencedRelation: "config_equipamento";
						referencedColumns: ["equipamento_id"];
					},
					{
						foreignKeyName: "pedido_item_materia_prima_id_fkey";
						columns: ["materia_prima_id"];
						isOneToOne: false;
						referencedRelation: "config_materia_prima";
						referencedColumns: ["materia_prima_id"];
					},
					{
						foreignKeyName: "pedido_item_modelo_id_fkey";
						columns: ["modelo_id"];
						isOneToOne: false;
						referencedRelation: "modelo";
						referencedColumns: ["modelo_id"];
					},
					{
						foreignKeyName: "pedido_item_pedido_id_fkey";
						columns: ["pedido_id"];
						isOneToOne: false;
						referencedRelation: "pedido";
						referencedColumns: ["pedido_id"];
					},
				];
			};
			producao: {
				Row: {
					producao_id: string;
					modelo_id: string;
					quantidade: number;
					custo_unitario: number | null;
					data_producao: string;
					observacao: string | null;
					deleted_at: string | null;
					created_at: string;
					updated_at: string;
					user_id: string | null;
					criado_por: string | null;
				};
				Insert: {
					producao_id?: string;
					modelo_id: string;
					quantidade: number;
					custo_unitario?: number | null;
					data_producao?: string;
					observacao?: string | null;
					deleted_at?: string | null;
					created_at?: string;
					updated_at?: string;
					user_id?: string | null;
					criado_por?: string | null;
				};
				Update: {
					producao_id?: string;
					modelo_id?: string;
					quantidade?: number;
					custo_unitario?: number | null;
					data_producao?: string;
					observacao?: string | null;
					deleted_at?: string | null;
					created_at?: string;
					updated_at?: string;
					user_id?: string | null;
					criado_por?: string | null;
				};
				Relationships: [
					{
						foreignKeyName: "producao_modelo_id_fkey";
						columns: ["modelo_id"];
						isOneToOne: false;
						referencedRelation: "modelo";
						referencedColumns: ["modelo_id"];
					},
				];
			};
			revendedor: {
				Row: {
					revendedor_id: string;
					nome: string;
					telefone: string | null;
					email: string | null;
					endereco: string | null;
					modelo_acerto: Database["public"]["Enums"]["modelo_acerto_enum"];
					comissao_fixa: number;
					comissao_pct: number;
					ativo: boolean;
					deleted_at: string | null;
					created_at: string;
					updated_at: string;
					valor_minimo_padrao: number | null;
					user_id: string | null;
					extrato_token: string;
					extrato_ativo: boolean;
				};
				Insert: {
					revendedor_id?: string;
					nome: string;
					telefone?: string | null;
					email?: string | null;
					endereco?: string | null;
					modelo_acerto?: Database["public"]["Enums"]["modelo_acerto_enum"];
					comissao_fixa?: number;
					comissao_pct?: number;
					ativo?: boolean;
					deleted_at?: string | null;
					created_at?: string;
					updated_at?: string;
					valor_minimo_padrao?: number | null;
					user_id?: string | null;
					extrato_token?: string;
					extrato_ativo?: boolean;
				};
				Update: {
					revendedor_id?: string;
					nome?: string;
					telefone?: string | null;
					email?: string | null;
					endereco?: string | null;
					modelo_acerto?: Database["public"]["Enums"]["modelo_acerto_enum"];
					comissao_fixa?: number;
					comissao_pct?: number;
					ativo?: boolean;
					deleted_at?: string | null;
					created_at?: string;
					updated_at?: string;
					valor_minimo_padrao?: number | null;
					user_id?: string | null;
					extrato_token?: string;
					extrato_ativo?: boolean;
				};
				Relationships: [];
			};
			revendedor_modelo_preco: {
				Row: {
					rev_preco_id: string;
					revendedor_id: string;
					modelo_id: string;
					rotulo: string;
					quantidade_minima: number;
					preco: number | null;
					valor_minimo: number | null;
					eh_promocao: boolean;
					ativo: boolean;
					deleted_at: string | null;
					created_at: string;
					updated_at: string;
					user_id: string | null;
				};
				Insert: {
					rev_preco_id?: string;
					revendedor_id: string;
					modelo_id: string;
					rotulo: string;
					quantidade_minima?: number;
					preco?: number | null;
					valor_minimo?: number | null;
					eh_promocao?: boolean;
					ativo?: boolean;
					deleted_at?: string | null;
					created_at?: string;
					updated_at?: string;
					user_id?: string | null;
				};
				Update: {
					rev_preco_id?: string;
					revendedor_id?: string;
					modelo_id?: string;
					rotulo?: string;
					quantidade_minima?: number;
					preco?: number | null;
					valor_minimo?: number | null;
					eh_promocao?: boolean;
					ativo?: boolean;
					deleted_at?: string | null;
					created_at?: string;
					updated_at?: string;
					user_id?: string | null;
				};
				Relationships: [
					{
						foreignKeyName: "revendedor_modelo_preco_modelo_id_fkey";
						columns: ["modelo_id"];
						isOneToOne: false;
						referencedRelation: "modelo";
						referencedColumns: ["modelo_id"];
					},
					{
						foreignKeyName: "revendedor_modelo_preco_revendedor_id_fkey";
						columns: ["revendedor_id"];
						isOneToOne: false;
						referencedRelation: "revendedor";
						referencedColumns: ["revendedor_id"];
					},
				];
			};
			venda_direta: {
				Row: {
					venda_id: string;
					data_venda: string;
					canal: Database["public"]["Enums"]["canal_venda_enum"];
					forma_pagamento: Database["public"]["Enums"]["forma_pagamento_enum"];
					desconto: number;
					valor_total: number;
					observacao: string | null;
					cliente_nome: string | null;
					cliente_contato: string | null;
					deleted_at: string | null;
					created_at: string;
					updated_at: string;
					user_id: string | null;
					criado_por: string | null;
				};
				Insert: {
					venda_id?: string;
					data_venda?: string;
					canal: Database["public"]["Enums"]["canal_venda_enum"];
					forma_pagamento: Database["public"]["Enums"]["forma_pagamento_enum"];
					desconto?: number;
					valor_total: number;
					observacao?: string | null;
					cliente_nome?: string | null;
					cliente_contato?: string | null;
					deleted_at?: string | null;
					created_at?: string;
					updated_at?: string;
					user_id?: string | null;
					criado_por?: string | null;
				};
				Update: {
					venda_id?: string;
					data_venda?: string;
					canal?: Database["public"]["Enums"]["canal_venda_enum"];
					forma_pagamento?: Database["public"]["Enums"]["forma_pagamento_enum"];
					desconto?: number;
					valor_total?: number;
					observacao?: string | null;
					cliente_nome?: string | null;
					cliente_contato?: string | null;
					deleted_at?: string | null;
					created_at?: string;
					updated_at?: string;
					user_id?: string | null;
					criado_por?: string | null;
				};
				Relationships: [];
			};
			venda_direta_item: {
				Row: {
					item_id: string;
					venda_id: string;
					modelo_id: string | null;
					quantidade: number;
					preco_unitario: number;
					preco_origem: Database["public"]["Enums"]["preco_origem_enum"];
					subtotal: number;
					deleted_at: string | null;
					created_at: string;
					updated_at: string;
					user_id: string | null;
					descricao_livre: string | null;
					criado_por: string | null;
				};
				Insert: {
					item_id?: string;
					venda_id: string;
					modelo_id?: string | null;
					quantidade: number;
					preco_unitario: number;
					preco_origem: Database["public"]["Enums"]["preco_origem_enum"];
					subtotal: number;
					deleted_at?: string | null;
					created_at?: string;
					updated_at?: string;
					user_id?: string | null;
					descricao_livre?: string | null;
					criado_por?: string | null;
				};
				Update: {
					item_id?: string;
					venda_id?: string;
					modelo_id?: string | null;
					quantidade?: number;
					preco_unitario?: number;
					preco_origem?: Database["public"]["Enums"]["preco_origem_enum"];
					subtotal?: number;
					deleted_at?: string | null;
					created_at?: string;
					updated_at?: string;
					user_id?: string | null;
					descricao_livre?: string | null;
					criado_por?: string | null;
				};
				Relationships: [
					{
						foreignKeyName: "venda_direta_item_modelo_id_fkey";
						columns: ["modelo_id"];
						isOneToOne: false;
						referencedRelation: "modelo";
						referencedColumns: ["modelo_id"];
					},
					{
						foreignKeyName: "venda_direta_item_venda_id_fkey";
						columns: ["venda_id"];
						isOneToOne: false;
						referencedRelation: "venda_direta";
						referencedColumns: ["venda_id"];
					},
				];
			};
		};
		Views: Record<string, never>;
		Functions: Record<string, never>;
		Enums: {
			acerto_status_enum: "PENDENTE" | "RECEBIDO";
			canal_venda_enum: "PRESENCIAL" | "WHATSAPP" | "FEIRA" | "EVENTO" | "INSTAGRAM" | "OUTRO";
			envio_status_enum: "ABERTO" | "CONFERIDO" | "ENCERRADO";
			forma_pagamento_enum: "PIX" | "DINHEIRO" | "CARTAO" | "OUTRO";
			modelo_acerto_enum: "COMISSAO" | "VALOR_MINIMO";
			modo_valor_enum: "CALCULADO" | "MANUAL";
			preco_origem_enum: "MODELO" | "REVENDEDOR" | "MANUAL";
		};
		CompositeTypes: Record<string, never>;
	};
};

/** Atalho para a linha de uma tabela: `Row<"pedido">`. */
export type Row<T extends keyof Database["public"]["Tables"]> =
	Database["public"]["Tables"][T]["Row"];

/** Atalho para o payload de insert: `Insert<"pedido">`. */
export type Insert<T extends keyof Database["public"]["Tables"]> =
	Database["public"]["Tables"][T]["Insert"];

/** Atalho para um enum: `Enum<"modelo_acerto_enum">`. */
export type Enum<T extends keyof Database["public"]["Enums"]> =
	Database["public"]["Enums"][T];
