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
      configuracoes: {
        Row: {
          created_at: string
          email: string | null
          fonte_global: string | null
          id: string
          logo_url: string | null
          nome_completo: string | null
          nome_projeto: string | null
          telefone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          fonte_global?: string | null
          id?: string
          logo_url?: string | null
          nome_completo?: string | null
          nome_projeto?: string | null
          telefone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          fonte_global?: string | null
          id?: string
          logo_url?: string | null
          nome_completo?: string | null
          nome_projeto?: string | null
          telefone?: string | null
          updated_at?: string
          user_id?: string
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
          nome_completo: string
          nome_motorista: string | null
          num_passageiros: number | null
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
          nome_completo: string
          nome_motorista?: string | null
          num_passageiros?: number | null
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
          nome_completo?: string
          nome_motorista?: string | null
          num_passageiros?: number | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
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
