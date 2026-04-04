export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      admin_avisos_plataforma: {
        Row: {
          ativo: boolean
          cor: string
          created_at: string
          escopo_global: boolean
          id: string
          incluir_motorista: boolean
          incluir_taxi: boolean
          paginas_motorista: string[] | null
          paginas_taxi: string[] | null
          texto: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cor?: string
          created_at?: string
          escopo_global?: boolean
          id?: string
          incluir_motorista?: boolean
          incluir_taxi?: boolean
          paginas_motorista?: string[] | null
          paginas_taxi?: string[] | null
          texto: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cor?: string
          created_at?: string
          escopo_global?: boolean
          id?: string
          incluir_motorista?: boolean
          incluir_taxi?: boolean
          paginas_motorista?: string[] | null
          paginas_taxi?: string[] | null
          texto?: string
          updated_at?: string
        }
        Relationships: []
      }
      anotacoes: {
        Row: {
          conteudo: string | null
          created_at: string
          id: string
          titulo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          conteudo?: string | null
          created_at?: string
          id?: string
          titulo: string
          updated_at?: string
          user_id: string
        }
        Update: {
          conteudo?: string | null
          created_at?: string
          id?: string
          titulo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      automacoes: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          mappings: Json
          nome: string
          tipo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          mappings?: Json
          nome: string
          tipo: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          mappings?: Json
          nome?: string
          tipo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      automacoes_campos_config: {
        Row: {
          campos: Json
          categoria: string
          created_at: string
          id: string
          subcategoria: string
          updated_at: string
        }
        Insert: {
          campos?: Json
          categoria: string
          created_at?: string
          id?: string
          subcategoria?: string
          updated_at?: string
        }
        Update: {
          campos?: Json
          categoria?: string
          created_at?: string
          id?: string
          subcategoria?: string
          updated_at?: string
        }
        Relationships: []
      }
      cabecalho_contratual: {
        Row: {
          cnpj: string
          created_at: string
          email_oficial: string
          endereco_sede: string
          id: string
          logo_contratual_url: string | null
          nome: string
          razao_social: string
          representante_legal: string | null
          telefone: string
          updated_at: string
          user_id: string
          whatsapp: string
        }
        Insert: {
          cnpj?: string
          created_at?: string
          email_oficial?: string
          endereco_sede?: string
          id?: string
          logo_contratual_url?: string | null
          nome?: string
          razao_social?: string
          representante_legal?: string | null
          telefone?: string
          updated_at?: string
          user_id: string
          whatsapp?: string
        }
        Update: {
          cnpj?: string
          created_at?: string
          email_oficial?: string
          endereco_sede?: string
          id?: string
          logo_contratual_url?: string | null
          nome?: string
          razao_social?: string
          representante_legal?: string | null
          telefone?: string
          updated_at?: string
          user_id?: string
          whatsapp?: string
        }
        Relationships: []
      }
      chamadas_taxi: {
        Row: {
          created_at: string
          data_corrida: string | null
          destino: string | null
          hora_corrida: string | null
          id: string
          nome_cliente: string
          numero_atendimento: number
          observacoes: string | null
          origem: string | null
          qtd_passageiros: number | null
          status: string
          telefone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data_corrida?: string | null
          destino?: string | null
          hora_corrida?: string | null
          id?: string
          nome_cliente: string
          numero_atendimento?: never
          observacoes?: string | null
          origem?: string | null
          qtd_passageiros?: number | null
          status?: string
          telefone: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data_corrida?: string | null
          destino?: string | null
          hora_corrida?: string | null
          id?: string
          nome_cliente?: string
          numero_atendimento?: never
          observacoes?: string | null
          origem?: string | null
          qtd_passageiros?: number | null
          status?: string
          telefone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      configuracoes: {
        Row: {
          cidade: string | null
          cnpj: string | null
          created_at: string
          email: string | null
          endereco_completo: string | null
          endereco_latitude: number | null
          endereco_longitude: number | null
          estado: string | null
          fonte_global: string | null
          id: string
          logo_url: string | null
          network_highlight_shown: boolean
          network_nacional_aceito: string | null
          network_saida_data: string | null
          nome_completo: string | null
          nome_empresa: string | null
          nome_projeto: string | null
          telefone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cidade?: string | null
          cnpj?: string | null
          created_at?: string
          email?: string | null
          endereco_completo?: string | null
          endereco_latitude?: number | null
          endereco_longitude?: number | null
          estado?: string | null
          fonte_global?: string | null
          id?: string
          logo_url?: string | null
          network_highlight_shown?: boolean
          network_nacional_aceito?: string | null
          network_saida_data?: string | null
          nome_completo?: string | null
          nome_empresa?: string | null
          nome_projeto?: string | null
          telefone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cidade?: string | null
          cnpj?: string | null
          created_at?: string
          email?: string | null
          endereco_completo?: string | null
          endereco_latitude?: number | null
          endereco_longitude?: number | null
          estado?: string | null
          fonte_global?: string | null
          id?: string
          logo_url?: string | null
          network_highlight_shown?: boolean
          network_nacional_aceito?: string | null
          network_saida_data?: string | null
          nome_completo?: string | null
          nome_empresa?: string | null
          nome_projeto?: string | null
          telefone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      comunicadores_evolution: {
        Row: {
          connection_status: string
          created_at: string
          escopo: string
          foto_perfil_url: string | null
          id: string
          instance_name: string | null
          nome_dispositivo: string | null
          qr_code_base64: string | null
          rotulo: string
          telefone_conectado: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          connection_status?: string
          created_at?: string
          escopo: string
          foto_perfil_url?: string | null
          id?: string
          instance_name?: string | null
          nome_dispositivo?: string | null
          qr_code_base64?: string | null
          rotulo?: string
          telefone_conectado?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          connection_status?: string
          created_at?: string
          escopo?: string
          foto_perfil_url?: string | null
          id?: string
          instance_name?: string | null
          nome_dispositivo?: string | null
          qr_code_base64?: string | null
          rotulo?: string
          telefone_conectado?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      comunicador_evolution_credenciais: {
        Row: {
          api_key: string
          api_url: string
          comunicador_id: string
          id: string
          updated_at: string
        }
        Insert: {
          api_key?: string
          api_url?: string
          comunicador_id: string
          id?: string
          updated_at?: string
        }
        Update: {
          api_key?: string
          api_url?: string
          comunicador_id?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comunicador_evolution_credenciais_comunicador_id_fkey"
            columns: ["comunicador_id"]
            isOneToOne: true
            referencedRelation: "comunicadores_evolution"
            referencedColumns: ["id"]
          },
        ]
      }
      community_post_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          is_edited: boolean
          post_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_edited?: boolean
          post_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_edited?: boolean
          post_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_post_likes: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_post_media: {
        Row: {
          created_at: string
          id: string
          media_type: string
          media_url: string
          position: number
          post_id: string
          storage_path: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          media_type: string
          media_url: string
          position?: number
          post_id: string
          storage_path?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          media_type?: string
          media_url?: string
          position?: number
          post_id?: string
          storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "community_post_media_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_post_mentions: {
        Row: {
          created_at: string
          id: string
          mentioned_by_user_id: string
          mentioned_user_id: string
          post_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mentioned_by_user_id: string
          mentioned_user_id: string
          post_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mentioned_by_user_id?: string
          mentioned_user_id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_post_mentions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_categories: {
        Row: {
          created_at: string
          created_by_user_id: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_user_id: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      community_posts: {
        Row: {
          author_user_id: string
          category_id: string | null
          content: string
          created_at: string
          id: string
          is_edited: boolean
          updated_at: string
        }
        Insert: {
          author_user_id: string
          category_id?: string | null
          content: string
          created_at?: string
          id?: string
          is_edited?: boolean
          updated_at?: string
        }
        Update: {
          author_user_id?: string
          category_id?: string | null
          content?: string
          created_at?: string
          id?: string
          is_edited?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_posts_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "community_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      contratos: {
        Row: {
          clausulas_adicionais: string
          created_at: string
          id: string
          modelo_contrato: string
          politica_cancelamento: string
          tipo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          clausulas_adicionais?: string
          created_at?: string
          id?: string
          modelo_contrato?: string
          politica_cancelamento?: string
          tipo: string
          updated_at?: string
          user_id: string
        }
        Update: {
          clausulas_adicionais?: string
          created_at?: string
          id?: string
          modelo_contrato?: string
          politica_cancelamento?: string
          tipo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      empty_lags: {
        Row: {
          created_at: string
          data_expiracao: string | null
          data_hora: string | null
          destino: string
          editado_por: string | null
          id: string
          observacoes: string | null
          origem: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_expiracao?: string | null
          data_hora?: string | null
          destino?: string
          editado_por?: string | null
          id?: string
          observacoes?: string | null
          origem?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_expiracao?: string | null
          data_hora?: string | null
          destino?: string
          editado_por?: string | null
          id?: string
          observacoes?: string | null
          origem?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      mentoria_cards: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          id: string
          imagem_url: string
          link_url: string | null
          materiais: string | null
          ordem: number
          tipo: string
          titulo: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          imagem_url?: string
          link_url?: string | null
          materiais?: string | null
          ordem?: number
          tipo?: string
          titulo?: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          imagem_url?: string
          link_url?: string | null
          materiais?: string | null
          ordem?: number
          tipo?: string
          titulo?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: []
      }
      mentoria_progresso: {
        Row: {
          card_id: string
          concluido: boolean
          concluido_em: string | null
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          card_id: string
          concluido?: boolean
          concluido_em?: string | null
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          card_id?: string
          concluido?: boolean
          concluido_em?: string | null
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mentoria_progresso_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "mentoria_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      network: {
        Row: {
          autor_email: string | null
          autor_nome: string | null
          cargo_funcao: string | null
          categoria: string
          cidade: string | null
          cnpj: string | null
          created_at: string
          email_corporativo: string | null
          endereco: string | null
          estado: string | null
          id: string
          nome_contato: string | null
          nome_empresa: string
          observacoes: string | null
          potencial_negocio: string
          responsavel: string | null
          status_contato: string
          telefone_direto: string | null
          tipo_empresa: string | null
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          autor_email?: string | null
          autor_nome?: string | null
          cargo_funcao?: string | null
          categoria?: string
          cidade?: string | null
          cnpj?: string | null
          created_at?: string
          email_corporativo?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          nome_contato?: string | null
          nome_empresa: string
          observacoes?: string | null
          potencial_negocio?: string
          responsavel?: string | null
          status_contato?: string
          telefone_direto?: string | null
          tipo_empresa?: string | null
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          autor_email?: string | null
          autor_nome?: string | null
          cargo_funcao?: string | null
          categoria?: string
          cidade?: string | null
          cnpj?: string | null
          created_at?: string
          email_corporativo?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          nome_contato?: string | null
          nome_empresa?: string
          observacoes?: string | null
          potencial_negocio?: string
          responsavel?: string | null
          status_contato?: string
          telefone_direto?: string | null
          tipo_empresa?: string | null
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: []
      }
      qr_codes: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          slug: string
          titulo: string
          updated_at: string
          url_destino: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          slug: string
          titulo?: string
          updated_at?: string
          url_destino: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          slug?: string
          titulo?: string
          updated_at?: string
          url_destino?: string
          user_id?: string
        }
        Relationships: []
      }
      receptivos: {
        Row: {
          created_at: string
          desembarque: string | null
          embarque: string | null
          id: string
          ida_data: string | null
          ida_hora: string | null
          modelo: number
          nome_cliente: string
          receptivo_pdf_layout_version: string
          reserva_numero: number | null
          reserva_transfer_id: string | null
          tipo_viagem: string | null
          user_id: string
          volta_data: string | null
          volta_desembarque: string | null
          volta_embarque: string | null
          volta_hora: string | null
        }
        Insert: {
          created_at?: string
          desembarque?: string | null
          embarque?: string | null
          id?: string
          ida_data?: string | null
          ida_hora?: string | null
          modelo: number
          nome_cliente: string
          receptivo_pdf_layout_version?: string
          reserva_numero?: number | null
          reserva_transfer_id?: string | null
          tipo_viagem?: string | null
          user_id: string
          volta_data?: string | null
          volta_desembarque?: string | null
          volta_embarque?: string | null
          volta_hora?: string | null
        }
        Update: {
          created_at?: string
          desembarque?: string | null
          embarque?: string | null
          id?: string
          ida_data?: string | null
          ida_hora?: string | null
          modelo?: number
          nome_cliente?: string
          receptivo_pdf_layout_version?: string
          reserva_numero?: number | null
          reserva_transfer_id?: string | null
          tipo_viagem?: string | null
          user_id?: string
          volta_data?: string | null
          volta_desembarque?: string | null
          volta_embarque?: string | null
          volta_hora?: string | null
        }
        Relationships: []
      }
      reservas_grupos: {
        Row: {
          cpf_cnpj: string
          created_at: string
          cupom: string | null
          data_ida: string | null
          data_retorno: string | null
          desconto: number
          destino: string | null
          email: string
          embarque: string | null
          hora_ida: string | null
          hora_retorno: string | null
          id: string
          metodo_pagamento: string | null
          motorista_id: string | null
          nome_completo: string
          nome_motorista: string | null
          num_passageiros: number | null
          numero_reserva: number
          observacoes_viagem: string | null
          status: string
          telefone_motorista: string | null
          tipo_veiculo: string | null
          updated_at: string
          user_id: string
          valor_base: number
          valor_total: number
          veiculo_id: string | null
          whatsapp: string
        }
        Insert: {
          cpf_cnpj: string
          created_at?: string
          cupom?: string | null
          data_ida?: string | null
          data_retorno?: string | null
          desconto?: number
          destino?: string | null
          email: string
          embarque?: string | null
          hora_ida?: string | null
          hora_retorno?: string | null
          id?: string
          metodo_pagamento?: string | null
          motorista_id?: string | null
          nome_completo: string
          nome_motorista?: string | null
          num_passageiros?: number | null
          numero_reserva?: number
          observacoes_viagem?: string | null
          status?: string
          telefone_motorista?: string | null
          tipo_veiculo?: string | null
          updated_at?: string
          user_id: string
          valor_base?: number
          valor_total?: number
          veiculo_id?: string | null
          whatsapp: string
        }
        Update: {
          cpf_cnpj?: string
          created_at?: string
          cupom?: string | null
          data_ida?: string | null
          data_retorno?: string | null
          desconto?: number
          destino?: string | null
          email?: string
          embarque?: string | null
          hora_ida?: string | null
          hora_retorno?: string | null
          id?: string
          metodo_pagamento?: string | null
          motorista_id?: string | null
          nome_completo?: string
          nome_motorista?: string | null
          num_passageiros?: number | null
          numero_reserva?: number
          observacoes_viagem?: string | null
          status?: string
          telefone_motorista?: string | null
          tipo_veiculo?: string | null
          updated_at?: string
          user_id?: string
          valor_base?: number
          valor_total?: number
          veiculo_id?: string | null
          whatsapp?: string
        }
        Relationships: []
      }
      reservas_transfer: {
        Row: {
          cpf_cnpj: string
          created_at: string
          desconto: number
          email: string
          id: string
          ida_cupom: string | null
          ida_data: string | null
          ida_desembarque: string | null
          ida_embarque: string | null
          ida_hora: string | null
          ida_mensagem: string | null
          ida_passageiros: number | null
          metodo_pagamento: string | null
          motorista_id: string | null
          nome_completo: string
          numero_reserva: number
          observacoes: string | null
          por_hora_cupom: string | null
          por_hora_data: string | null
          por_hora_endereco_inicio: string | null
          por_hora_hora: string | null
          por_hora_itinerario: string | null
          por_hora_passageiros: number | null
          por_hora_ponto_encerramento: string | null
          por_hora_qtd_horas: number | null
          quem_viaja: string
          status: string
          telefone: string
          tipo_viagem: string
          updated_at: string
          user_id: string
          valor_base: number
          valor_total: number
          veiculo_id: string | null
          volta_cupom: string | null
          volta_data: string | null
          volta_desembarque: string | null
          volta_embarque: string | null
          volta_hora: string | null
          volta_mensagem: string | null
          volta_passageiros: number | null
        }
        Insert: {
          cpf_cnpj: string
          created_at?: string
          desconto?: number
          email: string
          id?: string
          ida_cupom?: string | null
          ida_data?: string | null
          ida_desembarque?: string | null
          ida_embarque?: string | null
          ida_hora?: string | null
          ida_mensagem?: string | null
          ida_passageiros?: number | null
          metodo_pagamento?: string | null
          motorista_id?: string | null
          nome_completo: string
          numero_reserva?: number
          observacoes?: string | null
          por_hora_cupom?: string | null
          por_hora_data?: string | null
          por_hora_endereco_inicio?: string | null
          por_hora_hora?: string | null
          por_hora_itinerario?: string | null
          por_hora_passageiros?: number | null
          por_hora_ponto_encerramento?: string | null
          por_hora_qtd_horas?: number | null
          quem_viaja?: string
          status?: string
          telefone: string
          tipo_viagem?: string
          updated_at?: string
          user_id: string
          valor_base?: number
          valor_total?: number
          veiculo_id?: string | null
          volta_cupom?: string | null
          volta_data?: string | null
          volta_desembarque?: string | null
          volta_embarque?: string | null
          volta_hora?: string | null
          volta_mensagem?: string | null
          volta_passageiros?: number | null
        }
        Update: {
          cpf_cnpj?: string
          created_at?: string
          desconto?: number
          email?: string
          id?: string
          ida_cupom?: string | null
          ida_data?: string | null
          ida_desembarque?: string | null
          ida_embarque?: string | null
          ida_hora?: string | null
          ida_mensagem?: string | null
          ida_passageiros?: number | null
          metodo_pagamento?: string | null
          motorista_id?: string | null
          nome_completo?: string
          numero_reserva?: number
          observacoes?: string | null
          por_hora_cupom?: string | null
          por_hora_data?: string | null
          por_hora_endereco_inicio?: string | null
          por_hora_hora?: string | null
          por_hora_itinerario?: string | null
          por_hora_passageiros?: number | null
          por_hora_ponto_encerramento?: string | null
          por_hora_qtd_horas?: number | null
          quem_viaja?: string
          status?: string
          telefone?: string
          tipo_viagem?: string
          updated_at?: string
          user_id?: string
          valor_base?: number
          valor_total?: number
          veiculo_id?: string | null
          volta_cupom?: string | null
          volta_data?: string | null
          volta_desembarque?: string | null
          volta_embarque?: string | null
          volta_hora?: string | null
          volta_mensagem?: string | null
          volta_passageiros?: number | null
        }
        Relationships: []
      }
      slides: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          imagem_url: string
          link_url: string | null
          mostrar_texto: boolean
          ordem: number
          pagina: string
          subtitulo: string
          titulo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          imagem_url?: string
          link_url?: string | null
          mostrar_texto?: boolean
          ordem?: number
          pagina?: string
          subtitulo?: string
          titulo?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          imagem_url?: string
          link_url?: string | null
          mostrar_texto?: boolean
          ordem?: number
          pagina?: string
          subtitulo?: string
          titulo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sistema_webhooks_comunicacao: {
        Row: {
          geolocalizacao_url: string | null
          grupo_reserva_url: string | null
          grupo_solicitacao_url: string | null
          id: string
          motorista_intake_url: string | null
          motoristas_cadastrados_url: string | null
          transfer_reserva_url: string | null
          transfer_solicitacao_url: string | null
          updated_at: string
        }
        Insert: {
          geolocalizacao_url?: string | null
          grupo_reserva_url?: string | null
          grupo_solicitacao_url?: string | null
          id?: string
          motorista_intake_url?: string | null
          motoristas_cadastrados_url?: string | null
          transfer_reserva_url?: string | null
          transfer_solicitacao_url?: string | null
          updated_at?: string
        }
        Update: {
          geolocalizacao_url?: string | null
          grupo_reserva_url?: string | null
          grupo_solicitacao_url?: string | null
          id?: string
          motorista_intake_url?: string | null
          motoristas_cadastrados_url?: string | null
          transfer_reserva_url?: string | null
          transfer_solicitacao_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      solicitacoes_acesso: {
        Row: {
          cidade: string | null
          created_at: string
          email: string
          estado: string | null
          id: string
          mensagem: string | null
          nome_completo: string
          status: string
          telefone: string
          tipo_interesse: string
          updated_at: string
        }
        Insert: {
          cidade?: string | null
          created_at?: string
          email: string
          estado?: string | null
          id?: string
          mensagem?: string | null
          nome_completo: string
          status?: string
          telefone: string
          tipo_interesse?: string
          updated_at?: string
        }
        Update: {
          cidade?: string | null
          created_at?: string
          email?: string
          estado?: string | null
          id?: string
          mensagem?: string | null
          nome_completo?: string
          status?: string
          telefone?: string
          tipo_interesse?: string
          updated_at?: string
        }
        Relationships: []
      }
      solicitacoes_grupos: {
        Row: {
          created_at: string
          cupom: string | null
          data_ida: string | null
          data_retorno: string | null
          destino: string | null
          email: string | null
          embarque: string | null
          hora_ida: string | null
          hora_retorno: string | null
          id: string
          mensagem: string | null
          nome_cliente: string
          num_passageiros: number | null
          status: string
          tipo_veiculo: string | null
          updated_at: string
          user_id: string
          whatsapp: string | null
        }
        Insert: {
          created_at?: string
          cupom?: string | null
          data_ida?: string | null
          data_retorno?: string | null
          destino?: string | null
          email?: string | null
          embarque?: string | null
          hora_ida?: string | null
          hora_retorno?: string | null
          id?: string
          mensagem?: string | null
          nome_cliente: string
          num_passageiros?: number | null
          status?: string
          tipo_veiculo?: string | null
          updated_at?: string
          user_id: string
          whatsapp?: string | null
        }
        Update: {
          created_at?: string
          cupom?: string | null
          data_ida?: string | null
          data_retorno?: string | null
          destino?: string | null
          email?: string | null
          embarque?: string | null
          hora_ida?: string | null
          hora_retorno?: string | null
          id?: string
          mensagem?: string | null
          nome_cliente?: string
          num_passageiros?: number | null
          status?: string
          tipo_veiculo?: string | null
          updated_at?: string
          user_id?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      solicitacoes_motoristas: {
        Row: {
          cidade: string | null
          cnh: string | null
          cpf: string | null
          created_at: string
          dados_webhook: Json
          email: string | null
          email_had_account_at_intake: boolean
          estado: string | null
          id: string
          lead_user_id: string | null
          mensagem: string | null
          mensagem_observacoes: string | null
          nome: string
          status: string
          telefone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cidade?: string | null
          cnh?: string | null
          cpf?: string | null
          created_at?: string
          dados_webhook?: Json
          email?: string | null
          email_had_account_at_intake?: boolean
          estado?: string | null
          id?: string
          lead_user_id?: string | null
          mensagem?: string | null
          mensagem_observacoes?: string | null
          nome: string
          status?: string
          telefone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cidade?: string | null
          cnh?: string | null
          cpf?: string | null
          created_at?: string
          dados_webhook?: Json
          email?: string | null
          email_had_account_at_intake?: boolean
          estado?: string | null
          id?: string
          lead_user_id?: string | null
          mensagem?: string | null
          mensagem_observacoes?: string | null
          nome?: string
          status?: string
          telefone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      solicitacoes_servicos: {
        Row: {
          como_usar: string | null
          created_at: string
          dados_solicitacao: Json
          data_expiracao: string | null
          id: string
          instrucoes_acesso: string | null
          link_acesso: string | null
          observacoes_admin: string | null
          status: string
          tipo_servico: string
          updated_at: string
          user_id: string
        }
        Insert: {
          como_usar?: string | null
          created_at?: string
          dados_solicitacao?: Json
          data_expiracao?: string | null
          id?: string
          instrucoes_acesso?: string | null
          link_acesso?: string | null
          observacoes_admin?: string | null
          status?: string
          tipo_servico: string
          updated_at?: string
          user_id: string
        }
        Update: {
          como_usar?: string | null
          created_at?: string
          dados_solicitacao?: Json
          data_expiracao?: string | null
          id?: string
          instrucoes_acesso?: string | null
          link_acesso?: string | null
          observacoes_admin?: string | null
          status?: string
          tipo_servico?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      solicitacoes_transfer: {
        Row: {
          contato: string | null
          created_at: string
          cupom: string | null
          data_viagem: string | null
          desembarque: string | null
          email: string | null
          embarque: string | null
          hora_viagem: string | null
          id: string
          mensagem: string | null
          nome_cliente: string
          num_passageiros: number | null
          por_hora_cupom: string | null
          por_hora_data: string | null
          por_hora_endereco_inicio: string | null
          por_hora_hora: string | null
          por_hora_itinerario: string | null
          por_hora_passageiros: number | null
          por_hora_ponto_encerramento: string | null
          por_hora_qtd_horas: number | null
          status: string
          tipo: string | null
          updated_at: string
          user_id: string
          volta_cupom: string | null
          volta_data: string | null
          volta_desembarque: string | null
          volta_embarque: string | null
          volta_hora: string | null
          volta_mensagem: string | null
          volta_passageiros: number | null
        }
        Insert: {
          contato?: string | null
          created_at?: string
          cupom?: string | null
          data_viagem?: string | null
          desembarque?: string | null
          email?: string | null
          embarque?: string | null
          hora_viagem?: string | null
          id?: string
          mensagem?: string | null
          nome_cliente: string
          num_passageiros?: number | null
          por_hora_cupom?: string | null
          por_hora_data?: string | null
          por_hora_endereco_inicio?: string | null
          por_hora_hora?: string | null
          por_hora_itinerario?: string | null
          por_hora_passageiros?: number | null
          por_hora_ponto_encerramento?: string | null
          por_hora_qtd_horas?: number | null
          status?: string
          tipo?: string | null
          updated_at?: string
          user_id: string
          volta_cupom?: string | null
          volta_data?: string | null
          volta_desembarque?: string | null
          volta_embarque?: string | null
          volta_hora?: string | null
          volta_mensagem?: string | null
          volta_passageiros?: number | null
        }
        Update: {
          contato?: string | null
          created_at?: string
          cupom?: string | null
          data_viagem?: string | null
          desembarque?: string | null
          email?: string | null
          embarque?: string | null
          hora_viagem?: string | null
          id?: string
          mensagem?: string | null
          nome_cliente?: string
          num_passageiros?: number | null
          por_hora_cupom?: string | null
          por_hora_data?: string | null
          por_hora_endereco_inicio?: string | null
          por_hora_hora?: string | null
          por_hora_itinerario?: string | null
          por_hora_passageiros?: number | null
          por_hora_ponto_encerramento?: string | null
          por_hora_qtd_horas?: number | null
          status?: string
          tipo?: string | null
          updated_at?: string
          user_id?: string
          volta_cupom?: string | null
          volta_data?: string | null
          volta_desembarque?: string | null
          volta_embarque?: string | null
          volta_hora?: string | null
          volta_mensagem?: string | null
          volta_passageiros?: number | null
        }
        Relationships: []
      }
      templates_website: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          imagem_url: string
          link_modelo: string | null
          nome: string
          ordem: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          imagem_url?: string
          link_modelo?: string | null
          nome: string
          ordem?: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          imagem_url?: string
          link_modelo?: string | null
          nome?: string
          ordem?: number
          updated_at?: string
        }
        Relationships: []
      }
      tickets: {
        Row: {
          assunto: string
          codigo_ticket: number
          created_at: string
          descricao: string
          id: string
          resposta_admin: string | null
          status: string
          tipo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assunto: string
          codigo_ticket?: number
          created_at?: string
          descricao?: string
          id?: string
          resposta_admin?: string | null
          status?: string
          tipo?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assunto?: string
          codigo_ticket?: number
          created_at?: string
          descricao?: string
          id?: string
          resposta_admin?: string | null
          status?: string
          tipo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_plans: {
        Row: {
          created_at: string
          id: string
          plano: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          plano?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          plano?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      webhook_testes: {
        Row: {
          automacao_id: string
          created_at: string
          id: string
          payload: Json
          user_id: string
        }
        Insert: {
          automacao_id: string
          created_at?: string
          id?: string
          payload?: Json
          user_id: string
        }
        Update: {
          automacao_id?: string
          created_at?: string
          id?: string
          payload?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_testes_automacao_id_fkey"
            columns: ["automacao_id"]
            isOneToOne: false
            referencedRelation: "automacoes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_session_primary_role: {
        Args: Record<PropertyKey, never>
        Returns: Database["public"]["Enums"]["app_role"] | null
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_master: {
        Args: {
          _user_id: string
        }
        Returns: boolean
      }
      is_community_member: {
        Args: {
          _user_id: string
        }
        Returns: boolean
      }
      replace_user_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: undefined
      }
      get_motorista_abrangencia_reservas: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin_transfer" | "admin_taxi" | "admin_master"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin_transfer", "admin_taxi", "admin_master"],
    },
  },
} as const
