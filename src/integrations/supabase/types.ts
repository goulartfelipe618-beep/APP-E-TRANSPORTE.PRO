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
          fonte: string
          id: string
          incluir_login: boolean
          incluir_motorista: boolean
          incluir_taxi: boolean
          paginas_motorista: string[]
          paginas_taxi: string[]
          texto: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cor?: string
          created_at?: string
          escopo_global?: boolean
          fonte?: string
          id?: string
          incluir_login?: boolean
          incluir_motorista?: boolean
          incluir_taxi?: boolean
          paginas_motorista?: string[]
          paginas_taxi?: string[]
          texto: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cor?: string
          created_at?: string
          escopo_global?: boolean
          fonte?: string
          id?: string
          incluir_login?: boolean
          incluir_motorista?: boolean
          incluir_taxi?: boolean
          paginas_motorista?: string[]
          paginas_taxi?: string[]
          texto?: string
          updated_at?: string
        }
        Relationships: []
      }
      admin_fullscreen_banners: {
        Row: {
          ativo: boolean
          created_at: string
          data_fim: string
          data_inicio: string
          id: string
          imagem_url: string
          incluir_motorista: boolean
          incluir_taxi: boolean
          paginas_motorista: string[]
          paginas_taxi: string[]
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          data_fim: string
          data_inicio: string
          id?: string
          imagem_url: string
          incluir_motorista?: boolean
          incluir_taxi?: boolean
          paginas_motorista?: string[]
          paginas_taxi?: string[]
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          data_fim?: string
          data_inicio?: string
          id?: string
          imagem_url?: string
          incluir_motorista?: boolean
          incluir_taxi?: boolean
          paginas_motorista?: string[]
          paginas_taxi?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      admin_audit_log: {
        Row: {
          action: string
          actor_user_id: string
          created_at: string
          id: number
          metadata: Json
          resource_id: string | null
          resource_type: string
        }
        Insert: {
          action: string
          actor_user_id: string
          created_at?: string
          id?: never
          metadata?: Json
          resource_id?: string | null
          resource_type: string
        }
        Update: {
          action?: string
          actor_user_id?: string
          created_at?: string
          id?: never
          metadata?: Json
          resource_id?: string | null
          resource_type?: string
        }
        Relationships: []
      }
      auth_login_failure_events: {
        Row: {
          created_at: string
          email_fingerprint: string
          id: string
          ip_prefix: string | null
          outcome: string
          user_agent_short: string | null
        }
        Insert: {
          created_at?: string
          email_fingerprint: string
          id?: string
          ip_prefix?: string | null
          outcome?: string
          user_agent_short?: string | null
        }
        Update: {
          created_at?: string
          email_fingerprint?: string
          id?: string
          ip_prefix?: string | null
          outcome?: string
          user_agent_short?: string | null
        }
        Relationships: []
      }
      painel_client_error_logs: {
        Row: {
          active_page: string | null
          component_stack: string | null
          created_at: string
          extra: Json
          id: string
          kind: string
          message: string
          painel: string
          route_path: string | null
          stack: string | null
          user_agent: string | null
          user_display_name: string | null
          user_email: string | null
          user_id: string
        }
        Insert: {
          active_page?: string | null
          component_stack?: string | null
          created_at?: string
          extra?: Json
          id?: string
          kind: string
          message: string
          painel: string
          route_path?: string | null
          stack?: string | null
          user_agent?: string | null
          user_display_name?: string | null
          user_email?: string | null
          user_id: string
        }
        Update: {
          active_page?: string | null
          component_stack?: string | null
          created_at?: string
          extra?: Json
          id?: string
          kind?: string
          message?: string
          painel?: string
          route_path?: string | null
          stack?: string | null
          user_agent?: string | null
          user_display_name?: string | null
          user_email?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_activity_log: {
        Row: {
          action_code: string
          created_at: string
          id: string
          message: string
          metadata: Json
          user_id: string
        }
        Insert: {
          action_code: string
          created_at?: string
          id?: string
          message: string
          metadata?: Json
          user_id: string
        }
        Update: {
          action_code?: string
          created_at?: string
          id?: string
          message?: string
          metadata?: Json
          user_id?: string
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
          campanha_id: string | null
          created_at: string
          id: string
          is_campaign_webhook: boolean
          mappings: Json
          nome: string
          tipo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          campanha_id?: string | null
          created_at?: string
          id?: string
          is_campaign_webhook?: boolean
          mappings?: Json
          nome: string
          tipo: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          campanha_id?: string | null
          created_at?: string
          id?: string
          is_campaign_webhook?: boolean
          mappings?: Json
          nome?: string
          tipo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automacoes_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "campanhas"
            referencedColumns: ["id"]
          },
        ]
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
      aviso_dismissals: {
        Row: {
          aviso_id: string
          permanent: boolean
          snooze_until: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          aviso_id: string
          permanent?: boolean
          snooze_until?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          aviso_id?: string
          permanent?: boolean
          snooze_until?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "aviso_dismissals_aviso_id_fkey"
            columns: ["aviso_id"]
            isOneToOne: false
            referencedRelation: "admin_avisos_plataforma"
            referencedColumns: ["id"]
          },
        ]
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
          possui_cnpj: string | null
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
          possui_cnpj?: string | null
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
          possui_cnpj?: string | null
          razao_social?: string
          representante_legal?: string | null
          telefone?: string
          updated_at?: string
          user_id?: string
          whatsapp?: string
        }
        Relationships: []
      }
      campanha_leads: {
        Row: {
          automacao_id: string | null
          campanha_id: string
          campos: Json
          created_at: string
          id: string
          payload: Json
          user_id: string
        }
        Insert: {
          automacao_id?: string | null
          campanha_id: string
          campos?: Json
          created_at?: string
          id?: string
          payload?: Json
          user_id: string
        }
        Update: {
          automacao_id?: string | null
          campanha_id?: string
          campos?: Json
          created_at?: string
          id?: string
          payload?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campanha_leads_automacao_id_fkey"
            columns: ["automacao_id"]
            isOneToOne: false
            referencedRelation: "automacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campanha_leads_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "campanhas"
            referencedColumns: ["id"]
          },
        ]
      }
      campanhas: {
        Row: {
          cor: string | null
          created_at: string
          data_fim: string
          data_inicio: string
          descricao: string | null
          id: string
          link_campanha: string | null
          nome: string
          plataforma_fonte: string | null
          slug: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cor?: string | null
          created_at?: string
          data_fim: string
          data_inicio: string
          descricao?: string | null
          id?: string
          link_campanha?: string | null
          nome: string
          plataforma_fonte?: string | null
          slug: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cor?: string | null
          created_at?: string
          data_fim?: string
          data_inicio?: string
          descricao?: string | null
          id?: string
          link_campanha?: string | null
          nome?: string
          plataforma_fonte?: string | null
          slug?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      catalogos_motorista: {
        Row: {
          banner_capa_url: string | null
          banner_contracapa_url: string | null
          cidades_atendidas: Json
          comodidades: Json
          cor_acento: string
          created_at: string
          id: string
          instagram_handle: string | null
          servicos_destaque: Json
          site_url: string | null
          slogan: string
          sobre_nos: string
          subtitulo: string
          tema: string
          ultimo_pdf_gerado_em: string | null
          updated_at: string
          user_id: string
          whatsapp_e164: string | null
        }
        Insert: {
          banner_capa_url?: string | null
          banner_contracapa_url?: string | null
          cidades_atendidas?: Json
          comodidades?: Json
          cor_acento?: string
          created_at?: string
          id?: string
          instagram_handle?: string | null
          servicos_destaque?: Json
          site_url?: string | null
          slogan?: string
          sobre_nos?: string
          subtitulo?: string
          tema?: string
          ultimo_pdf_gerado_em?: string | null
          updated_at?: string
          user_id: string
          whatsapp_e164?: string | null
        }
        Update: {
          banner_capa_url?: string | null
          banner_contracapa_url?: string | null
          cidades_atendidas?: Json
          comodidades?: Json
          cor_acento?: string
          created_at?: string
          id?: string
          instagram_handle?: string | null
          servicos_destaque?: Json
          site_url?: string | null
          slogan?: string
          sobre_nos?: string
          subtitulo?: string
          tema?: string
          ultimo_pdf_gerado_em?: string | null
          updated_at?: string
          user_id?: string
          whatsapp_e164?: string | null
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
      client_session_revocation: {
        Row: {
          id: number
          revoked_at: string
        }
        Insert: {
          id: number
          revoked_at?: string
        }
        Update: {
          id?: number
          revoked_at?: string
        }
        Relationships: []
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
      comunicadores_evolution: {
        Row: {
          connection_status: string
          created_at: string
          escopo: string
          foto_perfil_url: string | null
          id: string
          instance_name: string | null
          uazapi_instance_token: string | null
          nome_dispositivo: string | null
          painel_motorista_evolution_ativo: boolean
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
          uazapi_instance_token?: string | null
          nome_dispositivo?: string | null
          painel_motorista_evolution_ativo?: boolean
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
          uazapi_instance_token?: string | null
          nome_dispositivo?: string | null
          painel_motorista_evolution_ativo?: boolean
          qr_code_base64?: string | null
          rotulo?: string
          telefone_conectado?: string | null
          updated_at?: string
          user_id?: string | null
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
          senha_redefinida_em: string | null
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
          senha_redefinida_em?: string | null
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
          senha_redefinida_em?: string | null
          telefone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      dominios_usuario: {
        Row: {
          created_at: string
          fqdn: string
          id: string
          observacoes: string | null
          plataforma_registro: string | null
          status: string
          tipo_origem: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          fqdn: string
          id?: string
          observacoes?: string | null
          plataforma_registro?: string | null
          status?: string
          tipo_origem?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          fqdn?: string
          id?: string
          observacoes?: string | null
          plataforma_registro?: string | null
          status?: string
          tipo_origem?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      financial_transactions: {
        Row: {
          amount: number
          category: string
          created_at: string
          currency: string
          description: string | null
          id: string
          is_primary: boolean
          kind: string
          occurred_on: string
          origin: string
          paid_at: string | null
          payment_method: string | null
          payment_status: string
          reserva_grupo_id: string | null
          reserva_transfer_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category?: string
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          is_primary?: boolean
          kind: string
          occurred_on?: string
          origin: string
          paid_at?: string | null
          payment_method?: string | null
          payment_status?: string
          reserva_grupo_id?: string | null
          reserva_transfer_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          is_primary?: boolean
          kind?: string
          occurred_on?: string
          origin?: string
          paid_at?: string | null
          payment_method?: string | null
          payment_status?: string
          reserva_grupo_id?: string | null
          reserva_transfer_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_transactions_reserva_grupo_id_fkey"
            columns: ["reserva_grupo_id"]
            isOneToOne: false
            referencedRelation: "reservas_grupos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_reserva_transfer_id_fkey"
            columns: ["reserva_transfer_id"]
            isOneToOne: false
            referencedRelation: "reservas_transfer"
            referencedColumns: ["id"]
          },
        ]
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
      login_painel_config: {
        Row: {
          created_at: string
          form_legenda: string
          form_titulo: string
          id: number
          idioma_padrao: string
          imagem_lateral_url: string | null
          painel_subtitulo: string
          painel_titulo: string
          placeholder_captcha: string
          placeholder_senha: string
          placeholder_usuario: string
          rodape_texto: string
          seguranca_itens: string[]
          seguranca_titulo: string
          texto_botao_ajuda: string
          texto_botao_login: string
          texto_esqueci_senha: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          form_legenda?: string
          form_titulo?: string
          id?: number
          idioma_padrao?: string
          imagem_lateral_url?: string | null
          painel_subtitulo?: string
          painel_titulo?: string
          placeholder_captcha?: string
          placeholder_senha?: string
          placeholder_usuario?: string
          rodape_texto?: string
          seguranca_itens?: string[]
          seguranca_titulo?: string
          texto_botao_ajuda?: string
          texto_botao_login?: string
          texto_esqueci_senha?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          form_legenda?: string
          form_titulo?: string
          id?: number
          idioma_padrao?: string
          imagem_lateral_url?: string | null
          painel_subtitulo?: string
          painel_titulo?: string
          placeholder_captcha?: string
          placeholder_senha?: string
          placeholder_usuario?: string
          rodape_texto?: string
          seguranca_itens?: string[]
          seguranca_titulo?: string
          texto_botao_ajuda?: string
          texto_botao_login?: string
          texto_esqueci_senha?: string
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
          ordem: number
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          imagem_url?: string
          link_url?: string | null
          ordem?: number
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          imagem_url?: string
          link_url?: string | null
          ordem?: number
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      mentoria_progresso: {
        Row: {
          card_id: string | null
          concluido: boolean
          concluido_em: string | null
          created_at: string | null
          id: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          card_id?: string | null
          concluido?: boolean
          concluido_em?: string | null
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          card_id?: string | null
          concluido?: boolean
          concluido_em?: string | null
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string | null
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
      plataforma_ferramentas_disponibilidade: {
        Row: {
          disparador_consumo_liberado: boolean
          google_maps_consumo_liberado: boolean
          id: number
          updated_at: string
        }
        Insert: {
          disparador_consumo_liberado?: boolean
          google_maps_consumo_liberado?: boolean
          id?: number
          updated_at?: string
        }
        Update: {
          disparador_consumo_liberado?: boolean
          google_maps_consumo_liberado?: boolean
          id?: number
          updated_at?: string
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
      rastreios_ao_vivo: {
        Row: {
          accuracy_m: number | null
          categoria_rastreamento: string | null
          cliente_nome: string | null
          cliente_telefone: string | null
          comunicado_em: string | null
          created_at: string
          data_hora_fim: string | null
          destino_endereco: string | null
          distancia_total_km: number | null
          duracao_segundos: number | null
          expira_em: string | null
          fim_latitude: number | null
          fim_longitude: number | null
          finalizado_em: string | null
          heading: number | null
          id: string
          iniciado_device_secret: string | null
          iniciado_em: string
          iniciado_em_dispositivo: string | null
          iniciado_user_agent: string | null
          inicio_latitude: number | null
          inicio_longitude: number | null
          latitude: number | null
          longitude: number | null
          motorista_nome: string | null
          observacoes: string | null
          origem_endereco: string | null
          reserva_grupo_id: string | null
          reserva_transfer_id: string | null
          speed_kmh: number | null
          status: string
          token: string
          ultima_atualizacao: string | null
          updated_at: string
          user_id: string
          valor_total: number | null
          veiculo_descricao: string | null
        }
        Insert: {
          accuracy_m?: number | null
          categoria_rastreamento?: string | null
          cliente_nome?: string | null
          cliente_telefone?: string | null
          comunicado_em?: string | null
          created_at?: string
          data_hora_fim?: string | null
          destino_endereco?: string | null
          distancia_total_km?: number | null
          duracao_segundos?: number | null
          expira_em?: string | null
          fim_latitude?: number | null
          fim_longitude?: number | null
          finalizado_em?: string | null
          heading?: number | null
          id?: string
          iniciado_device_secret?: string | null
          iniciado_em?: string
          iniciado_em_dispositivo?: string | null
          iniciado_user_agent?: string | null
          inicio_latitude?: number | null
          inicio_longitude?: number | null
          latitude?: number | null
          longitude?: number | null
          motorista_nome?: string | null
          observacoes?: string | null
          origem_endereco?: string | null
          reserva_grupo_id?: string | null
          reserva_transfer_id?: string | null
          speed_kmh?: number | null
          status?: string
          token?: string
          ultima_atualizacao?: string | null
          updated_at?: string
          user_id: string
          valor_total?: number | null
          veiculo_descricao?: string | null
        }
        Update: {
          accuracy_m?: number | null
          categoria_rastreamento?: string | null
          cliente_nome?: string | null
          cliente_telefone?: string | null
          comunicado_em?: string | null
          created_at?: string
          data_hora_fim?: string | null
          destino_endereco?: string | null
          distancia_total_km?: number | null
          duracao_segundos?: number | null
          expira_em?: string | null
          fim_latitude?: number | null
          fim_longitude?: number | null
          finalizado_em?: string | null
          heading?: number | null
          id?: string
          iniciado_device_secret?: string | null
          iniciado_em?: string
          iniciado_em_dispositivo?: string | null
          iniciado_user_agent?: string | null
          inicio_latitude?: number | null
          inicio_longitude?: number | null
          latitude?: number | null
          longitude?: number | null
          motorista_nome?: string | null
          observacoes?: string | null
          origem_endereco?: string | null
          reserva_grupo_id?: string | null
          reserva_transfer_id?: string | null
          speed_kmh?: number | null
          status?: string
          token?: string
          ultima_atualizacao?: string | null
          updated_at?: string
          user_id?: string
          valor_total?: number | null
          veiculo_descricao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rastreios_ao_vivo_reserva_grupo_id_fkey"
            columns: ["reserva_grupo_id"]
            isOneToOne: false
            referencedRelation: "reservas_grupos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rastreios_ao_vivo_reserva_transfer_id_fkey"
            columns: ["reserva_transfer_id"]
            isOneToOne: false
            referencedRelation: "reservas_transfer"
            referencedColumns: ["id"]
          },
        ]
      }
      rastreios_ao_vivo_pontos: {
        Row: {
          accuracy_m: number | null
          heading: number | null
          id: number
          latitude: number
          longitude: number
          rastreio_id: string
          registrado_em: string
          speed_kmh: number | null
        }
        Insert: {
          accuracy_m?: number | null
          heading?: number | null
          id?: number
          latitude: number
          longitude: number
          rastreio_id: string
          registrado_em?: string
          speed_kmh?: number | null
        }
        Update: {
          accuracy_m?: number | null
          heading?: number | null
          id?: number
          latitude?: number
          longitude?: number
          rastreio_id?: string
          registrado_em?: string
          speed_kmh?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rastreios_ao_vivo_pontos_rastreio_id_fkey"
            columns: ["rastreio_id"]
            isOneToOne: false
            referencedRelation: "rastreios_ao_vivo"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "receptivos_reserva_transfer_id_fkey"
            columns: ["reserva_transfer_id"]
            isOneToOne: false
            referencedRelation: "reservas_transfer"
            referencedColumns: ["id"]
          },
        ]
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
          par_reserva_id: string | null
          perna_viagem: string | null
          repasse_motorista: number | null
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
          par_reserva_id?: string | null
          perna_viagem?: string | null
          repasse_motorista?: number | null
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
          par_reserva_id?: string | null
          perna_viagem?: string | null
          repasse_motorista?: number | null
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
          cadastro_cliente_id: string | null
          categoria_veiculo: string | null
          trajetos: Json
          cpf_cnpj: string
          created_at: string
          desconto: number
          email: string
          esconder_valores: boolean
          faturado: boolean
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
          par_reserva_id: string | null
          perna_viagem: string | null
          por_hora_cupom: string | null
          por_hora_data: string | null
          por_hora_endereco_inicio: string | null
          por_hora_hora: string | null
          por_hora_itinerario: string | null
          por_hora_passageiros: number | null
          por_hora_ponto_encerramento: string | null
          por_hora_qtd_horas: number | null
          quem_viaja: string
          repasse_motorista: number | null
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
          cadastro_cliente_id?: string | null
          categoria_veiculo?: string | null
          trajetos?: Json
          cpf_cnpj: string
          created_at?: string
          desconto?: number
          email: string
          esconder_valores?: boolean
          faturado?: boolean
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
          par_reserva_id?: string | null
          perna_viagem?: string | null
          por_hora_cupom?: string | null
          por_hora_data?: string | null
          por_hora_endereco_inicio?: string | null
          por_hora_hora?: string | null
          por_hora_itinerario?: string | null
          por_hora_passageiros?: number | null
          por_hora_ponto_encerramento?: string | null
          por_hora_qtd_horas?: number | null
          quem_viaja?: string
          repasse_motorista?: number | null
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
          cadastro_cliente_id?: string | null
          categoria_veiculo?: string | null
          trajetos?: Json
          cpf_cnpj?: string
          created_at?: string
          desconto?: number
          email?: string
          esconder_valores?: boolean
          faturado?: boolean
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
          par_reserva_id?: string | null
          perna_viagem?: string | null
          por_hora_cupom?: string | null
          por_hora_data?: string | null
          por_hora_endereco_inicio?: string | null
          por_hora_hora?: string | null
          por_hora_itinerario?: string | null
          por_hora_passageiros?: number | null
          por_hora_ponto_encerramento?: string | null
          por_hora_qtd_horas?: number | null
          quem_viaja?: string
          repasse_motorista?: number | null
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
          dados_webhook: Json | null
          email: string | null
          email_had_account_at_intake: boolean
          estado: string | null
          id: string
          lead_user_id: string | null
          mensagem: string | null
          mensagem_observacoes: string | null
          motorista_intake_destino: string
          motorista_verificacao_qr_token: string
          nome: string
          portal_auth_user_id: string | null
          portal_login_email: string | null
          portal_token: string
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
          dados_webhook?: Json | null
          email?: string | null
          email_had_account_at_intake?: boolean
          estado?: string | null
          id?: string
          lead_user_id?: string | null
          mensagem?: string | null
          mensagem_observacoes?: string | null
          motorista_intake_destino?: string
          motorista_verificacao_qr_token?: string
          nome: string
          portal_auth_user_id?: string | null
          portal_login_email?: string | null
          portal_token?: string
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
          dados_webhook?: Json | null
          email?: string | null
          email_had_account_at_intake?: boolean
          estado?: string | null
          id?: string
          lead_user_id?: string | null
          mensagem?: string | null
          mensagem_observacoes?: string | null
          motorista_intake_destino?: string
          motorista_verificacao_qr_token?: string
          nome?: string
          portal_auth_user_id?: string | null
          portal_login_email?: string | null
          portal_token?: string
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
          codigo_ticket: number | null
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
          codigo_ticket?: number | null
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
          codigo_ticket?: number | null
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
      veiculos_frota: {
        Row: {
          ano: string
          chassi: string | null
          combustivel: string
          cor: string | null
          created_at: string
          distancia_minima_km: number
          fracao_tempo_min: number
          id: string
          imagem_capa_url: string | null
          imagens_json: Json | null
          marca: string
          modelo: string
          multiplicador_ida_volta: number
          observacoes: string | null
          pedagio_modo: string
          permitir_preco_fixo_rota: boolean
          placa: string
          renavam: string | null
          status: string
          tarifa_base: number
          taxa_aeroporto_fixa: number
          taxa_noturna_percentual: number
          taxas_extras_json: Json | null
          tempo_tolerancia_min: number
          tipo_cobranca: string
          tipo_veiculo: string
          updated_at: string
          user_id: string
          valor_hora: number
          valor_hora_espera: number
          valor_km: number
          valor_minimo_corrida: number
        }
        Insert: {
          ano: string
          chassi?: string | null
          combustivel: string
          cor?: string | null
          created_at?: string
          distancia_minima_km?: number
          fracao_tempo_min?: number
          id?: string
          imagem_capa_url?: string | null
          imagens_json?: Json | null
          marca: string
          modelo: string
          multiplicador_ida_volta?: number
          observacoes?: string | null
          pedagio_modo?: string
          permitir_preco_fixo_rota?: boolean
          placa: string
          renavam?: string | null
          status?: string
          tarifa_base?: number
          taxa_aeroporto_fixa?: number
          taxa_noturna_percentual?: number
          taxas_extras_json?: Json | null
          tempo_tolerancia_min?: number
          tipo_cobranca?: string
          tipo_veiculo: string
          updated_at?: string
          user_id: string
          valor_hora?: number
          valor_hora_espera?: number
          valor_km?: number
          valor_minimo_corrida?: number
        }
        Update: {
          ano?: string
          chassi?: string | null
          combustivel?: string
          cor?: string | null
          created_at?: string
          distancia_minima_km?: number
          fracao_tempo_min?: number
          id?: string
          imagem_capa_url?: string | null
          imagens_json?: Json | null
          marca?: string
          modelo?: string
          multiplicador_ida_volta?: number
          observacoes?: string | null
          pedagio_modo?: string
          permitir_preco_fixo_rota?: boolean
          placa?: string
          renavam?: string | null
          status?: string
          tarifa_base?: number
          taxa_aeroporto_fixa?: number
          taxa_noturna_percentual?: number
          taxas_extras_json?: Json | null
          tempo_tolerancia_min?: number
          tipo_cobranca?: string
          tipo_veiculo?: string
          updated_at?: string
          user_id?: string
          valor_hora?: number
          valor_hora_espera?: number
          valor_km?: number
          valor_minimo_corrida?: number
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
      encerrar_rastreio: {
        Args: {
          p_destino?: string
          p_distancia_km?: number
          p_duracao_segundos?: number
          p_origem?: string
          p_rastreio_id: string
          p_valor_total?: number
        }
        Returns: {
          accuracy_m: number | null
          categoria_rastreamento: string | null
          cliente_nome: string | null
          cliente_telefone: string | null
          comunicado_em: string | null
          created_at: string
          data_hora_fim: string | null
          destino_endereco: string | null
          distancia_total_km: number | null
          duracao_segundos: number | null
          expira_em: string | null
          finalizado_em: string | null
          heading: number | null
          id: string
          iniciado_device_secret: string | null
          iniciado_em: string
          iniciado_em_dispositivo: string | null
          iniciado_user_agent: string | null
          latitude: number | null
          longitude: number | null
          motorista_nome: string | null
          observacoes: string | null
          origem_endereco: string | null
          reserva_grupo_id: string | null
          reserva_transfer_id: string | null
          speed_kmh: number | null
          status: string
          token: string
          ultima_atualizacao: string | null
          updated_at: string
          user_id: string
          valor_total: number | null
          veiculo_descricao: string | null
        }
        SetofOptions: {
          from: "*"
          to: "rastreios_ao_vivo"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      enviar_posicao_publico: {
        Args: {
          p_accuracy?: number
          p_device_secret: string
          p_gravar_breadcrumb?: boolean
          p_heading?: number
          p_lat: number
          p_lng: number
          p_speed_kmh?: number
          p_token: string
        }
        Returns: undefined
      }
      generate_unique_ticket_code: { Args: never; Returns: number }
      frota_update_reserva_status: {
        Args: { p_id: string; p_kind: string; p_status: string }
        Returns: string
      }
      get_frota_motorista_branding: {
        Args: never
        Returns: {
          logo_url: string
          motorista_nome: string
          nome_projeto: string
          owner_user_id: string
        }[]
      }
      get_frota_motorista_reservas: {
        Args: never
        Returns: {
          categoria_veiculo: string | null
          trajetos: Json
          data_ida: string | null
          data_retorno: string | null
          desconto: number | null
          destino: string | null
          embarque: string | null
          esconder_valores: boolean
          faturado: boolean
          hora_ida: string | null
          hora_retorno: string | null
          id: string
          ida_data: string | null
          ida_desembarque: string | null
          ida_embarque: string | null
          ida_hora: string | null
          kind: string
          motorista_id: string | null
          numero_reserva: number
          num_passageiros: number | null
          observacoes: string | null
          perna_viagem: string | null
          por_hora_data: string | null
          por_hora_endereco_inicio: string | null
          por_hora_hora: string | null
          por_hora_ponto_encerramento: string | null
          repasse_motorista: number | null
          status: string | null
          tipo_viagem: string | null
          valor_base: number | null
          valor_total: number | null
          volta_data: string | null
          volta_desembarque: string | null
          volta_embarque: string | null
          volta_hora: string | null
        }[]
      }
      get_motorista_abrangencia_reservas: { Args: never; Returns: Json }
      get_my_mentoria_progress: {
        Args: never
        Returns: {
          card_id: string
          concluido: boolean
        }[]
      }
      get_rastreio_publico: {
        Args: { p_token: string }
        Returns: {
          categoria_rastreamento: string
          cliente_nome: string
          data_hora_fim: string
          destino_endereco: string
          distancia_total_km: number
          duracao_segundos: number
          expira_em: string
          finalizado_em: string
          heading: number
          id: string
          iniciado_em: string
          iniciado_em_dispositivo: string
          latitude: number
          longitude: number
          motorista_nome: string
          origem_endereco: string
          speed_kmh: number
          status: string
          ultima_atualizacao: string
          veiculo_descricao: string
        }[]
      }
      get_session_primary_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      haversine_km: {
        Args: { lat1: number; lat2: number; lon1: number; lon2: number }
        Returns: number
      }
      iniciar_rastreio_publico: {
        Args: {
          p_device_secret: string
          p_token: string
          p_user_agent?: string
        }
        Returns: {
          categoria_rastreamento: string
          cliente_nome: string
          iniciado_em_dispositivo: string
          ja_iniciado_neste_device: boolean
          motorista_nome: string
          rastreio_id: string
          status: string
          veiculo_descricao: string
        }[]
      }
      is_admin_master: { Args: { _user_id: string }; Returns: boolean }
      is_community_member: { Args: { _user_id: string }; Returns: boolean }
      is_platform_staff: { Args: { check_uid?: string }; Returns: boolean }
      list_dominios_motoristas_for_admin: {
        Args: never
        Returns: {
          created_at: string
          fqdn: string
          id: string
          observacoes: string | null
          plataforma_registro: string | null
          status: string
          tipo_origem: string | null
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "dominios_usuario"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      metricas_evolucao_mensal: { Args: never; Returns: Json }
      metricas_funil_conversao: {
        Args: { p_period_days?: number }
        Returns: Json
      }
      metricas_kpis: { Args: { p_period_days?: number }; Returns: Json }
      metricas_solicitacoes_por_canal: { Args: never; Returns: Json }
      metricas_top_destinos: {
        Args: { p_limit?: number; p_period_days?: number }
        Returns: Json
      }
      motorista_telefone_disponivel_para_google: {
        Args: { p_telefone: string; p_user_id: string }
        Returns: boolean
      }
      motoristas_for_admin: {
        Args: never
        Returns: {
          created_at: string
          fqdn: string
          id: string
          observacoes: string | null
          plataforma_registro: string | null
          status: string
          tipo_origem: string | null
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "dominios_usuario"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      replace_user_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: undefined
      }
      service_delete_user_owned_data: {
        Args: { p_user_id: string }
        Returns: undefined
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
