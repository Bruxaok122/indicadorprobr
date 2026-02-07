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
      contacts: {
        Row: {
          cpf: string | null
          created_at: string
          id: string
          last_message_at: string | null
          lawyer_name: string | null
          name: string
          phone: string
          process_number: string | null
          status: string | null
          updated_at: string
          user_id: string | null
          valor_da_causa: number | null
        }
        Insert: {
          cpf?: string | null
          created_at?: string
          id?: string
          last_message_at?: string | null
          lawyer_name?: string | null
          name: string
          phone: string
          process_number?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string | null
          valor_da_causa?: number | null
        }
        Update: {
          cpf?: string | null
          created_at?: string
          id?: string
          last_message_at?: string | null
          lawyer_name?: string | null
          name?: string
          phone?: string
          process_number?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string | null
          valor_da_causa?: number | null
        }
        Relationships: []
      }
      conversations: {
        Row: {
          contact_id: string
          created_at: string
          id: string
          is_active: boolean | null
          updated_at: string
          user_id: string | null
          window_expires_at: string | null
        }
        Insert: {
          contact_id: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          updated_at?: string
          user_id?: string | null
          window_expires_at?: string | null
        }
        Update: {
          contact_id?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          updated_at?: string
          user_id?: string | null
          window_expires_at?: string | null
        }
        Relationships: [
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
          id: string
          image_url: string | null
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
          id?: string
          image_url?: string | null
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
          id?: string
          image_url?: string | null
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
          ban_reason: string | null
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
          ban_reason?: string | null
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
          ban_reason?: string | null
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
          created_at: string
          display_phone_number: string
          id: string
          is_active: boolean
          phone_number_id: string
          quality_rating: string | null
          updated_at: string
          verified_name: string | null
        }
        Insert: {
          created_at?: string
          display_phone_number: string
          id?: string
          is_active?: boolean
          phone_number_id: string
          quality_rating?: string | null
          updated_at?: string
          verified_name?: string | null
        }
        Update: {
          created_at?: string
          display_phone_number?: string
          id?: string
          is_active?: boolean
          phone_number_id?: string
          quality_rating?: string | null
          updated_at?: string
          verified_name?: string | null
        }
        Relationships: []
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
