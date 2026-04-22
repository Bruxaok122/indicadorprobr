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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      active_dispatches: {
        Row: {
          created_at: string
          current: number
          errors: Json
          failed: number
          id: string
          is_cancelled: boolean
          is_finished: boolean
          is_paused: boolean
          list_name: string
          mode: string
          operator_id: string
          operator_name: string
          sent: number
          template_name: string
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          current?: number
          errors?: Json
          failed?: number
          id: string
          is_cancelled?: boolean
          is_finished?: boolean
          is_paused?: boolean
          list_name: string
          mode?: string
          operator_id: string
          operator_name: string
          sent?: number
          template_name: string
          total?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          current?: number
          errors?: Json
          failed?: number
          id?: string
          is_cancelled?: boolean
          is_finished?: boolean
          is_paused?: boolean
          list_name?: string
          mode?: string
          operator_id?: string
          operator_name?: string
          sent?: number
          template_name?: string
          total?: number
          updated_at?: string
        }
        Relationships: []
      }
      admin_audio_config: {
        Row: {
          audio_name: string
          audio_url: string
          created_at: string
          id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          audio_name: string
          audio_url: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          audio_name?: string
          audio_url?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      ai_conversion_logs: {
        Row: {
          contact_id: string
          created_at: string
          from_stage: string
          id: string
          messages_in_stage: number | null
          response_time_seconds: number | null
          to_stage: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          from_stage: string
          id?: string
          messages_in_stage?: number | null
          response_time_seconds?: number | null
          to_stage: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          from_stage?: string
          id?: string
          messages_in_stage?: number | null
          response_time_seconds?: number | null
          to_stage?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversion_logs_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_learning: {
        Row: {
          ai_response: string
          approved: boolean
          category: string
          client_message: string
          created_at: string
          from_stage: string | null
          id: string
          result: string
          times_used: number
          to_stage: string | null
          updated_at: string
        }
        Insert: {
          ai_response: string
          approved?: boolean
          category?: string
          client_message: string
          created_at?: string
          from_stage?: string | null
          id?: string
          result?: string
          times_used?: number
          to_stage?: string | null
          updated_at?: string
        }
        Update: {
          ai_response?: string
          approved?: boolean
          category?: string
          client_message?: string
          created_at?: string
          from_stage?: string | null
          id?: string
          result?: string
          times_used?: number
          to_stage?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      api_configs: {
        Row: {
          access_token: string
          created_at: string
          id: string
          is_active: boolean
          is_validated: boolean
          messaging_tier: string | null
          name: string
          phone_number_id: string
          quality_rating: string | null
          status_message: string | null
          tier_updated_at: string | null
          updated_at: string
          waba_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_validated?: boolean
          messaging_tier?: string | null
          name: string
          phone_number_id: string
          quality_rating?: string | null
          status_message?: string | null
          tier_updated_at?: string | null
          updated_at?: string
          waba_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_validated?: boolean
          messaging_tier?: string | null
          name?: string
          phone_number_id?: string
          quality_rating?: string | null
          status_message?: string | null
          tier_updated_at?: string | null
          updated_at?: string
          waba_id?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          ai_enabled: boolean
          ai_stage: string | null
          api_config_id: string | null
          bank_data: Json | null
          claimed_at: string | null
          claimed_by: string | null
          contact_list: string | null
          cpf: string | null
          created_at: string
          dispatch_mode: string
          dispatched_phone_number_id: string | null
          has_whatsapp: boolean | null
          id: string
          is_priority: boolean
          last_message_at: string | null
          last_message_preview: string | null
          lawyer_name: string | null
          name: string
          name_verified: boolean | null
          phone: string
          process_number: string | null
          status: string | null
          updated_at: string
          user_id: string | null
          valor_da_causa: number | null
          whatsapp_profile_name: string | null
        }
        Insert: {
          ai_enabled?: boolean
          ai_stage?: string | null
          api_config_id?: string | null
          bank_data?: Json | null
          claimed_at?: string | null
          claimed_by?: string | null
          contact_list?: string | null
          cpf?: string | null
          created_at?: string
          dispatch_mode?: string
          dispatched_phone_number_id?: string | null
          has_whatsapp?: boolean | null
          id?: string
          is_priority?: boolean
          last_message_at?: string | null
          last_message_preview?: string | null
          lawyer_name?: string | null
          name: string
          name_verified?: boolean | null
          phone: string
          process_number?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string | null
          valor_da_causa?: number | null
          whatsapp_profile_name?: string | null
        }
        Update: {
          ai_enabled?: boolean
          ai_stage?: string | null
          api_config_id?: string | null
          bank_data?: Json | null
          claimed_at?: string | null
          claimed_by?: string | null
          contact_list?: string | null
          cpf?: string | null
          created_at?: string
          dispatch_mode?: string
          dispatched_phone_number_id?: string | null
          has_whatsapp?: boolean | null
          id?: string
          is_priority?: boolean
          last_message_at?: string | null
          last_message_preview?: string | null
          lawyer_name?: string | null
          name?: string
          name_verified?: boolean | null
          phone?: string
          process_number?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string | null
          valor_da_causa?: number | null
          whatsapp_profile_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_api_config_id_fkey"
            columns: ["api_config_id"]
            isOneToOne: false
            referencedRelation: "api_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          api_config_id: string | null
          contact_id: string
          created_at: string
          id: string
          is_active: boolean | null
          original_user_id: string | null
          transferred_at: string | null
          transferred_by: string | null
          updated_at: string
          user_id: string | null
          window_expires_at: string | null
        }
        Insert: {
          api_config_id?: string | null
          contact_id: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          original_user_id?: string | null
          transferred_at?: string | null
          transferred_by?: string | null
          updated_at?: string
          user_id?: string | null
          window_expires_at?: string | null
        }
        Update: {
          api_config_id?: string | null
          contact_id?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          original_user_id?: string | null
          transferred_at?: string | null
          transferred_by?: string | null
          updated_at?: string
          user_id?: string | null
          window_expires_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_api_config_id_fkey"
            columns: ["api_config_id"]
            isOneToOne: false
            referencedRelation: "api_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      device_sessions: {
        Row: {
          created_at: string
          device_fingerprint: string
          device_info: Json | null
          id: string
          is_active: boolean | null
          last_seen_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device_fingerprint: string
          device_info?: Json | null
          id?: string
          is_active?: boolean | null
          last_seen_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          device_fingerprint?: string
          device_info?: Json | null
          id?: string
          is_active?: boolean | null
          last_seen_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      import_logs: {
        Row: {
          created_at: string
          failed: number | null
          id: string
          raw_data: string | null
          successful: number | null
          total_contacts: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          failed?: number | null
          id?: string
          raw_data?: string | null
          successful?: number | null
          total_contacts?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          failed?: number | null
          id?: string
          raw_data?: string | null
          successful?: number | null
          total_contacts?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      login_attempts: {
        Row: {
          created_at: string
          device_fingerprint: string
          id: string
          ip_address: string | null
          success: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          device_fingerprint: string
          id?: string
          ip_address?: string | null
          success?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          device_fingerprint?: string
          id?: string
          ip_address?: string | null
          success?: boolean
          user_id?: string
        }
        Relationships: []
      }
      message_templates: {
        Row: {
          category: string | null
          content: string
          created_at: string
          id: string
          language: string | null
          name: string
          status: string | null
        }
        Insert: {
          category?: string | null
          content: string
          created_at?: string
          id?: string
          language?: string | null
          name: string
          status?: string | null
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string
          id?: string
          language?: string | null
          name?: string
          status?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          contact_id: string
          content: string | null
          conversation_id: string
          created_at: string
          direction: string
          document_name: string | null
          document_url: string | null
          error_code: string | null
          error_details: string | null
          id: string
          image_url: string | null
          is_deleted: boolean
          message_type: string
          status: string | null
          template_name: string | null
          user_id: string | null
          whatsapp_message_id: string | null
        }
        Insert: {
          contact_id: string
          content?: string | null
          conversation_id: string
          created_at?: string
          direction: string
          document_name?: string | null
          document_url?: string | null
          error_code?: string | null
          error_details?: string | null
          id?: string
          image_url?: string | null
          is_deleted?: boolean
          message_type?: string
          status?: string | null
          template_name?: string | null
          user_id?: string | null
          whatsapp_message_id?: string | null
        }
        Update: {
          contact_id?: string
          content?: string | null
          conversation_id?: string
          created_at?: string
          direction?: string
          document_name?: string | null
          document_url?: string | null
          error_code?: string | null
          error_details?: string | null
          id?: string
          image_url?: string | null
          is_deleted?: boolean
          message_type?: string
          status?: string | null
          template_name?: string | null
          user_id?: string | null
          whatsapp_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          authorized_device_info: Json | null
          authorized_fingerprint: string | null
          ban_reason: string | null
          can_dispatch: boolean | null
          can_manage_numbers: boolean | null
          can_use_shared_api: boolean | null
          created_at: string
          device_fingerprint: string | null
          email: string
          failed_device_attempts: number | null
          full_name: string
          id: string
          is_blocked: boolean | null
          last_device_info: Json | null
          last_failed_attempt_at: string | null
          last_login_at: string | null
          messages_sent: number | null
          subscription_expires_at: string | null
          subscription_plan: string | null
          temp_banned_until: string | null
          templates_sent: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          authorized_device_info?: Json | null
          authorized_fingerprint?: string | null
          ban_reason?: string | null
          can_dispatch?: boolean | null
          can_manage_numbers?: boolean | null
          can_use_shared_api?: boolean | null
          created_at?: string
          device_fingerprint?: string | null
          email: string
          failed_device_attempts?: number | null
          full_name: string
          id?: string
          is_blocked?: boolean | null
          last_device_info?: Json | null
          last_failed_attempt_at?: string | null
          last_login_at?: string | null
          messages_sent?: number | null
          subscription_expires_at?: string | null
          subscription_plan?: string | null
          temp_banned_until?: string | null
          templates_sent?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          authorized_device_info?: Json | null
          authorized_fingerprint?: string | null
          ban_reason?: string | null
          can_dispatch?: boolean | null
          can_manage_numbers?: boolean | null
          can_use_shared_api?: boolean | null
          created_at?: string
          device_fingerprint?: string | null
          email?: string
          failed_device_attempts?: number | null
          full_name?: string
          id?: string
          is_blocked?: boolean | null
          last_device_info?: Json | null
          last_failed_attempt_at?: string | null
          last_login_at?: string | null
          messages_sent?: number | null
          subscription_expires_at?: string | null
          subscription_plan?: string | null
          temp_banned_until?: string | null
          templates_sent?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_phone_permissions: {
        Row: {
          created_at: string
          id: string
          phone_number_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          phone_number_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          phone_number_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_phone_permissions_phone_number_id_fkey"
            columns: ["phone_number_id"]
            isOneToOne: false
            referencedRelation: "waba_phone_numbers"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_whatsapp_config: {
        Row: {
          access_token: string | null
          created_at: string
          id: string
          is_validated: boolean | null
          phone_number_id: string | null
          updated_at: string
          user_id: string
          waba_id: string | null
        }
        Insert: {
          access_token?: string | null
          created_at?: string
          id?: string
          is_validated?: boolean | null
          phone_number_id?: string | null
          updated_at?: string
          user_id: string
          waba_id?: string | null
        }
        Update: {
          access_token?: string | null
          created_at?: string
          id?: string
          is_validated?: boolean | null
          phone_number_id?: string | null
          updated_at?: string
          user_id?: string
          waba_id?: string | null
        }
        Relationships: []
      }
      waba_phone_numbers: {
        Row: {
          api_config_id: string | null
          created_at: string
          created_by: string | null
          display_phone_number: string
          id: string
          is_active: boolean
          lawyer_name: string | null
          messaging_tier: string | null
          phone_number_id: string
          quality_rating: string | null
          tier_updated_at: string | null
          updated_at: string
          verified_name: string | null
        }
        Insert: {
          api_config_id?: string | null
          created_at?: string
          created_by?: string | null
          display_phone_number: string
          id?: string
          is_active?: boolean
          lawyer_name?: string | null
          messaging_tier?: string | null
          phone_number_id: string
          quality_rating?: string | null
          tier_updated_at?: string | null
          updated_at?: string
          verified_name?: string | null
        }
        Update: {
          api_config_id?: string | null
          created_at?: string
          created_by?: string | null
          display_phone_number?: string
          id?: string
          is_active?: boolean
          lawyer_name?: string | null
          messaging_tier?: string | null
          phone_number_id?: string
          quality_rating?: string | null
          tier_updated_at?: string | null
          updated_at?: string
          verified_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "waba_phone_numbers_api_config_id_fkey"
            columns: ["api_config_id"]
            isOneToOne: false
            referencedRelation: "api_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_config: {
        Row: {
          access_token: string | null
          created_at: string
          id: string
          is_validated: boolean | null
          phone_number_id: string | null
          updated_at: string
          waba_id: string | null
        }
        Insert: {
          access_token?: string | null
          created_at?: string
          id?: string
          is_validated?: boolean | null
          phone_number_id?: string | null
          updated_at?: string
          waba_id?: string | null
        }
        Update: {
          access_token?: string | null
          created_at?: string
          id?: string
          is_validated?: boolean | null
          phone_number_id?: string | null
          updated_at?: string
          waba_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_view_contact: {
        Args: { _contact_id: string; _user_id: string }
        Returns: boolean
      }
      can_write_contact: {
        Args: { _contact_id: string; _user_id: string }
        Returns: boolean
      }
      clear_failed_attempts: { Args: { _user_id: string }; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_messages_sent: {
        Args: { _user_id: string }
        Returns: undefined
      }
      increment_templates_sent: {
        Args: { _user_id: string }
        Returns: undefined
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_subscription_expired: { Args: { _user_id: string }; Returns: boolean }
      is_temp_banned: { Args: { _user_id: string }; Returns: boolean }
      is_user_blocked: { Args: { _user_id: string }; Returns: boolean }
      record_failed_device_attempt: {
        Args: { _user_id: string }
        Returns: Json
      }
      set_subscription_plan: {
        Args: { _plan: string; _user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
