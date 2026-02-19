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
      campaign_leads: {
        Row: {
          accepted_at: string | null
          campaign_id: string
          created_at: string
          delivered_at: string | null
          error_message: string | null
          failed_at: string | null
          id: string
          lead_id: string
          opened_at: string | null
          replied_at: string | null
          sent_at: string | null
          status: string
          updated_at: string
          user_id: string
          webhook_data: Json | null
        }
        Insert: {
          accepted_at?: string | null
          campaign_id: string
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          failed_at?: string | null
          id?: string
          lead_id: string
          opened_at?: string | null
          replied_at?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
          webhook_data?: Json | null
        }
        Update: {
          accepted_at?: string | null
          campaign_id?: string
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          failed_at?: string | null
          id?: string
          lead_id?: string
          opened_at?: string | null
          replied_at?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          webhook_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_leads_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_leads_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "prospect_list_items"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          channel: string
          created_at: string
          daily_limit: number
          id: string
          linkedin_type: string | null
          list_id: string | null
          message_template: string | null
          name: string
          status: string
          subject: string | null
          total_accepted: number
          total_delivered: number
          total_failed: number
          total_opened: number
          total_replied: number
          total_sent: number
          updated_at: string
          user_id: string
        }
        Insert: {
          channel: string
          created_at?: string
          daily_limit?: number
          id?: string
          linkedin_type?: string | null
          list_id?: string | null
          message_template?: string | null
          name: string
          status?: string
          subject?: string | null
          total_accepted?: number
          total_delivered?: number
          total_failed?: number
          total_opened?: number
          total_replied?: number
          total_sent?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          daily_limit?: number
          id?: string
          linkedin_type?: string | null
          list_id?: string | null
          message_template?: string | null
          name?: string
          status?: string
          subject?: string | null
          total_accepted?: number
          total_delivered?: number
          total_failed?: number
          total_opened?: number
          total_replied?: number
          total_sent?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "prospect_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      email_settings: {
        Row: {
          created_at: string
          email_signature: string | null
          id: string
          scheduling_duration: string | null
          scheduling_link: string | null
          scheduling_title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_signature?: string | null
          id?: string
          scheduling_duration?: string | null
          scheduling_link?: string | null
          scheduling_title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_signature?: string | null
          id?: string
          scheduling_duration?: string | null
          scheduling_link?: string | null
          scheduling_title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      instances: {
        Row: {
          created_at: string
          daily_reset_at: string | null
          daily_send_limit: number
          daily_sent_count: number
          id: string
          max_delay_seconds: number
          min_delay_seconds: number
          name: string
          status: string
          unipile_account_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          daily_reset_at?: string | null
          daily_send_limit?: number
          daily_sent_count?: number
          id?: string
          max_delay_seconds?: number
          min_delay_seconds?: number
          name: string
          status?: string
          unipile_account_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          daily_reset_at?: string | null
          daily_send_limit?: number
          daily_sent_count?: number
          id?: string
          max_delay_seconds?: number
          min_delay_seconds?: number
          name?: string
          status?: string
          unipile_account_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      link_clicks: {
        Row: {
          clicked_at: string
          id: string
          ip_address: string | null
          is_unique: boolean
          lead_id: string
          tracking_id: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          clicked_at?: string
          id?: string
          ip_address?: string | null
          is_unique?: boolean
          lead_id: string
          tracking_id: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          clicked_at?: string
          id?: string
          ip_address?: string | null
          is_unique?: boolean
          lead_id?: string
          tracking_id?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "link_clicks_tracking_id_fkey"
            columns: ["tracking_id"]
            isOneToOne: false
            referencedRelation: "link_tracking"
            referencedColumns: ["id"]
          },
        ]
      }
      link_tracking: {
        Row: {
          campaign_lead_id: string | null
          created_at: string
          id: string
          lead_id: string
          original_url: string
          short_code: string
          user_id: string
        }
        Insert: {
          campaign_lead_id?: string | null
          created_at?: string
          id?: string
          lead_id: string
          original_url: string
          short_code: string
          user_id: string
        }
        Update: {
          campaign_lead_id?: string | null
          created_at?: string
          id?: string
          lead_id?: string
          original_url?: string
          short_code?: string
          user_id?: string
        }
        Relationships: []
      }
      messages_received: {
        Row: {
          content: string | null
          created_at: string
          id: string
          instance_id: string | null
          lead_id: string | null
          media_url: string | null
          message_type: string
          phone: string | null
          raw_payload: Json | null
          received_at: string | null
          unipile_chat_id: string | null
          unipile_message_id: string | null
          user_id: string
          workflow_instance_id: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          instance_id?: string | null
          lead_id?: string | null
          media_url?: string | null
          message_type?: string
          phone?: string | null
          raw_payload?: Json | null
          received_at?: string | null
          unipile_chat_id?: string | null
          unipile_message_id?: string | null
          user_id: string
          workflow_instance_id?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          instance_id?: string | null
          lead_id?: string | null
          media_url?: string | null
          message_type?: string
          phone?: string | null
          raw_payload?: Json | null
          received_at?: string | null
          unipile_chat_id?: string | null
          unipile_message_id?: string | null
          user_id?: string
          workflow_instance_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_received_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      messages_sent: {
        Row: {
          campaign_id: string | null
          campaign_lead_id: string | null
          content: string | null
          created_at: string
          delivered_at: string | null
          error_message: string | null
          id: string
          instance_id: string | null
          lead_id: string | null
          media_url: string | null
          message_type: string
          node_id: string | null
          phone: string | null
          read_at: string | null
          sent_at: string | null
          status: string
          unipile_message_id: string | null
          updated_at: string
          user_id: string
          workflow_instance_id: string | null
        }
        Insert: {
          campaign_id?: string | null
          campaign_lead_id?: string | null
          content?: string | null
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          instance_id?: string | null
          lead_id?: string | null
          media_url?: string | null
          message_type?: string
          node_id?: string | null
          phone?: string | null
          read_at?: string | null
          sent_at?: string | null
          status?: string
          unipile_message_id?: string | null
          updated_at?: string
          user_id: string
          workflow_instance_id?: string | null
        }
        Update: {
          campaign_id?: string | null
          campaign_lead_id?: string | null
          content?: string | null
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          instance_id?: string | null
          lead_id?: string | null
          media_url?: string | null
          message_type?: string
          node_id?: string | null
          phone?: string | null
          read_at?: string | null
          sent_at?: string | null
          status?: string
          unipile_message_id?: string | null
          updated_at?: string
          user_id?: string
          workflow_instance_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_sent_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sent_campaign_lead_id_fkey"
            columns: ["campaign_lead_id"]
            isOneToOne: false
            referencedRelation: "campaign_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sent_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          data: Json | null
          id: string
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          data?: Json | null
          id?: string
          read?: boolean
          title: string
          type?: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          data?: Json | null
          id?: string
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          notify_email: string | null
          notify_email_enabled: boolean
          notify_inapp_enabled: boolean
          notify_whatsapp_enabled: boolean
          notify_whatsapp_number: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          notify_email?: string | null
          notify_email_enabled?: boolean
          notify_inapp_enabled?: boolean
          notify_whatsapp_enabled?: boolean
          notify_whatsapp_number?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          notify_email?: string | null
          notify_email_enabled?: boolean
          notify_inapp_enabled?: boolean
          notify_whatsapp_enabled?: boolean
          notify_whatsapp_number?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      prospect_list_items: {
        Row: {
          apify_called: boolean | null
          apify_email_found: boolean | null
          apify_finished: boolean | null
          apify_run_id: string | null
          apollo_called: boolean | null
          apollo_reason: string | null
          company: string | null
          created_at: string
          email: string | null
          email_checked_at: string | null
          enrichment_source: string | null
          enrichment_status: string | null
          external_id: string | null
          headcount: string | null
          id: string
          industry: string | null
          item_type: string
          link_clicks_count: number
          linkedin_url: string | null
          list_id: string
          location: string | null
          name: string
          phone: string | null
          phone_checked_at: string | null
          provider_id: string | null
          raw_data: Json | null
          title: string | null
          user_id: string
        }
        Insert: {
          apify_called?: boolean | null
          apify_email_found?: boolean | null
          apify_finished?: boolean | null
          apify_run_id?: string | null
          apollo_called?: boolean | null
          apollo_reason?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          email_checked_at?: string | null
          enrichment_source?: string | null
          enrichment_status?: string | null
          external_id?: string | null
          headcount?: string | null
          id?: string
          industry?: string | null
          item_type: string
          link_clicks_count?: number
          linkedin_url?: string | null
          list_id: string
          location?: string | null
          name: string
          phone?: string | null
          phone_checked_at?: string | null
          provider_id?: string | null
          raw_data?: Json | null
          title?: string | null
          user_id: string
        }
        Update: {
          apify_called?: boolean | null
          apify_email_found?: boolean | null
          apify_finished?: boolean | null
          apify_run_id?: string | null
          apollo_called?: boolean | null
          apollo_reason?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          email_checked_at?: string | null
          enrichment_source?: string | null
          enrichment_status?: string | null
          external_id?: string | null
          headcount?: string | null
          id?: string
          industry?: string | null
          item_type?: string
          link_clicks_count?: number
          linkedin_url?: string | null
          list_id?: string
          location?: string | null
          name?: string
          phone?: string | null
          phone_checked_at?: string | null
          provider_id?: string | null
          raw_data?: Json | null
          title?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospect_list_items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "prospect_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      prospect_lists: {
        Row: {
          created_at: string
          description: string | null
          id: string
          list_type: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          list_type?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          list_type?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_integrations: {
        Row: {
          connected_at: string | null
          created_at: string
          id: string
          provider: string
          provider_email: string | null
          status: string
          unipile_account_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          connected_at?: string | null
          created_at?: string
          id?: string
          provider: string
          provider_email?: string | null
          status?: string
          unipile_account_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          connected_at?: string | null
          created_at?: string
          id?: string
          provider?: string
          provider_email?: string | null
          status?: string
          unipile_account_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_connections: {
        Row: {
          connected_at: string | null
          created_at: string
          id: string
          status: string
          unipile_account_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          connected_at?: string | null
          created_at?: string
          id?: string
          status?: string
          unipile_account_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          connected_at?: string | null
          created_at?: string
          id?: string
          status?: string
          unipile_account_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
