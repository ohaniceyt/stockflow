export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.5'
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          org_id: string
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          org_id: string
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          org_id?: string
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'activity_logs_actor_id_fkey'
            columns: ['actor_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'activity_logs_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      alerts: {
        Row: {
          created_at: string
          id: string
          location_id: string
          org_id: string
          product_id: string
          resolved_at: string | null
          status: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          location_id: string
          org_id: string
          product_id: string
          resolved_at?: string | null
          status?: string
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          location_id?: string
          org_id?: string
          product_id?: string
          resolved_at?: string | null
          status?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: 'alerts_location_id_fkey'
            columns: ['location_id']
            isOneToOne: false
            referencedRelation: 'locations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'alerts_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'alerts_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
        ]
      }
      api_request_logs: {
        Row: {
          api_key_id: string
          created_at: string | null
          id: string
          ip_address: string | null
          method: string | null
          org_id: string
          path: string | null
          status_code: number | null
        }
        Insert: {
          api_key_id: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          method?: string | null
          org_id: string
          path?: string | null
          status_code?: number | null
        }
        Update: {
          api_key_id?: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          method?: string | null
          org_id?: string
          path?: string | null
          status_code?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'api_request_logs_api_key_id_fkey'
            columns: ['api_key_id']
            isOneToOne: false
            referencedRelation: 'organization_api_keys'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'api_request_logs_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      cashier_sessions: {
        Row: {
          closed_at: string | null
          closing_balance: number | null
          created_at: string
          daily_revenue: number | null
          id: string
          location_id: string
          opened_at: string
          opening_balance: number
          operator_id: string
          org_id: string
          status: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          closing_balance?: number | null
          created_at?: string
          daily_revenue?: number | null
          id?: string
          location_id: string
          opened_at?: string
          opening_balance?: number
          operator_id: string
          org_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          closing_balance?: number | null
          created_at?: string
          daily_revenue?: number | null
          id?: string
          location_id?: string
          opened_at?: string
          opening_balance?: number
          operator_id?: string
          org_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'cashier_sessions_location_id_fkey'
            columns: ['location_id']
            isOneToOne: false
            referencedRelation: 'locations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'cashier_sessions_operator_id_fkey'
            columns: ['operator_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'cashier_sessions_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
          org_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          org_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'categories_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      contacts: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          org_id: string
          phone: string | null
          tax_id: string | null
          type: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          org_id: string
          phone?: string | null
          tax_id?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          org_id?: string
          phone?: string | null
          tax_id?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'contacts_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      country_defaults: {
        Row: {
          country_code: string
          currency: string
          is_active: boolean
          name: string
          timezone: string
        }
        Insert: {
          country_code: string
          currency: string
          is_active?: boolean
          name: string
          timezone: string
        }
        Update: {
          country_code?: string
          currency?: string
          is_active?: boolean
          name?: string
          timezone?: string
        }
        Relationships: []
      }
      inventory_counts: {
        Row: {
          counted_quantity: number
          created_at: string
          difference: number
          id: string
          is_validated: boolean
          location_id: string
          product_id: string
          session_id: string
          theoretical_quantity: number
        }
        Insert: {
          counted_quantity: number
          created_at?: string
          difference: number
          id?: string
          is_validated?: boolean
          location_id: string
          product_id: string
          session_id: string
          theoretical_quantity: number
        }
        Update: {
          counted_quantity?: number
          created_at?: string
          difference?: number
          id?: string
          is_validated?: boolean
          location_id?: string
          product_id?: string
          session_id?: string
          theoretical_quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: 'inventory_counts_location_id_fkey'
            columns: ['location_id']
            isOneToOne: false
            referencedRelation: 'locations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'inventory_counts_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'inventory_counts_session_id_fkey'
            columns: ['session_id']
            isOneToOne: false
            referencedRelation: 'inventory_sessions'
            referencedColumns: ['id']
          },
        ]
      }
      inventory_sessions: {
        Row: {
          completed_at: string | null
          id: string
          location_id: string
          name: string
          operator_id: string
          org_id: string
          started_at: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          id?: string
          location_id: string
          name: string
          operator_id: string
          org_id: string
          started_at?: string
          status?: string
        }
        Update: {
          completed_at?: string | null
          id?: string
          location_id?: string
          name?: string
          operator_id?: string
          org_id?: string
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: 'inventory_sessions_location_id_fkey'
            columns: ['location_id']
            isOneToOne: false
            referencedRelation: 'locations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'inventory_sessions_operator_id_fkey'
            columns: ['operator_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'inventory_sessions_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      invitations: {
        Row: {
          created_at: string
          email: string
          expires_at: string | null
          id: string
          invited_by: string
          name: string | null
          org_id: string
          role: string
          status: Database['public']['Enums']['invitation_status']
          token: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string | null
          id?: string
          invited_by: string
          name?: string | null
          org_id: string
          role: string
          status?: Database['public']['Enums']['invitation_status']
          token?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string | null
          id?: string
          invited_by?: string
          name?: string | null
          org_id?: string
          role?: string
          status?: Database['public']['Enums']['invitation_status']
          token?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'invitations_invited_by_membership_id_fkey'
            columns: ['invited_by']
            isOneToOne: false
            referencedRelation: 'organization_memberships'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'invitations_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      invoice_items: {
        Row: {
          created_at: string
          description: string
          discount_amount: number
          id: string
          invoice_id: string
          product_id: string | null
          quantity: number
          tax_rate: number
          total: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          discount_amount?: number
          id?: string
          invoice_id: string
          product_id?: string | null
          quantity?: number
          tax_rate?: number
          total?: number
          unit_price?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          discount_amount?: number
          id?: string
          invoice_id?: string
          product_id?: string | null
          quantity?: number
          tax_rate?: number
          total?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'invoice_items_invoice_id_fkey'
            columns: ['invoice_id']
            isOneToOne: false
            referencedRelation: 'invoices'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'invoice_items_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
        ]
      }
      invoice_sequences: {
        Row: {
          created_at: string
          current_number: number
          document_type: string
          id: string
          org_id: string
          prefix: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_number?: number
          document_type: string
          id?: string
          org_id: string
          prefix: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_number?: number
          document_type?: string
          id?: string
          org_id?: string
          prefix?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'invoice_sequences_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      invoices: {
        Row: {
          contact_id: string | null
          converted_at: string | null
          converted_to_invoice_id: string | null
          created_at: string
          currency: string
          delivered_at: string | null
          delivery_address: string | null
          document_number: string
          due_date: string | null
          id: string
          issue_date: string
          movement_ids: string[] | null
          note: string | null
          org_id: string
          paid_amount: number
          quote_id: string | null
          reminders_sent: number
          sent_at: string | null
          status: string
          subtotal: number
          tax_total: number
          terms: string | null
          total: number
          type: string
          updated_at: string
        }
        Insert: {
          contact_id?: string | null
          converted_at?: string | null
          converted_to_invoice_id?: string | null
          created_at?: string
          currency?: string
          delivered_at?: string | null
          delivery_address?: string | null
          document_number: string
          due_date?: string | null
          id?: string
          issue_date?: string
          movement_ids?: string[] | null
          note?: string | null
          org_id: string
          paid_amount?: number
          quote_id?: string | null
          reminders_sent?: number
          sent_at?: string | null
          status?: string
          subtotal?: number
          tax_total?: number
          terms?: string | null
          total?: number
          type?: string
          updated_at?: string
        }
        Update: {
          contact_id?: string | null
          converted_at?: string | null
          converted_to_invoice_id?: string | null
          created_at?: string
          currency?: string
          delivered_at?: string | null
          delivery_address?: string | null
          document_number?: string
          due_date?: string | null
          id?: string
          issue_date?: string
          movement_ids?: string[] | null
          note?: string | null
          org_id?: string
          paid_amount?: number
          quote_id?: string | null
          reminders_sent?: number
          sent_at?: string | null
          status?: string
          subtotal?: number
          tax_total?: number
          terms?: string | null
          total?: number
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'invoices_contact_id_fkey'
            columns: ['contact_id']
            isOneToOne: false
            referencedRelation: 'contacts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'invoices_converted_to_invoice_id_fkey'
            columns: ['converted_to_invoice_id']
            isOneToOne: false
            referencedRelation: 'invoices'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'invoices_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'invoices_quote_id_fkey'
            columns: ['quote_id']
            isOneToOne: false
            referencedRelation: 'invoices'
            referencedColumns: ['id']
          },
        ]
      }
      locations: {
        Row: {
          address: string | null
          created_at: string
          description: string | null
          id: string
          is_default: boolean
          name: string
          org_id: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean
          name: string
          org_id: string
        }
        Update: {
          address?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean
          name?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'locations_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      login_attempts: {
        Row: {
          created_at: string
          id: string
          ip_address: string | null
          succeeded: boolean
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          ip_address?: string | null
          succeeded?: boolean
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          ip_address?: string | null
          succeeded?: boolean
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'login_attempts_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      magic_link_requests: {
        Row: {
          created_at: string
          email: string
          id: string
          ip_address: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          ip_address?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          ip_address?: string | null
        }
        Relationships: []
      }
      movements: {
        Row: {
          cancelled_at: string | null
          cancelled_by: string | null
          cashier_session_id: string | null
          client_operation_id: string | null
          contact_id: string | null
          created_at: string
          id: string
          is_cancelled: boolean
          location_id: string
          operator_id: string
          org_id: string
          product_id: string
          quantity: number
          reason: string | null
          reference_id: string | null
          stock_after: number
          stock_before: number
          target_location_id: string | null
          type: string
          unit_price: number | null
        }
        Insert: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          cashier_session_id?: string | null
          client_operation_id?: string | null
          contact_id?: string | null
          created_at?: string
          id?: string
          is_cancelled?: boolean
          location_id: string
          operator_id: string
          org_id: string
          product_id: string
          quantity: number
          reason?: string | null
          reference_id?: string | null
          stock_after: number
          stock_before: number
          target_location_id?: string | null
          type: string
          unit_price?: number | null
        }
        Update: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          cashier_session_id?: string | null
          client_operation_id?: string | null
          contact_id?: string | null
          created_at?: string
          id?: string
          is_cancelled?: boolean
          location_id?: string
          operator_id?: string
          org_id?: string
          product_id?: string
          quantity?: number
          reason?: string | null
          reference_id?: string | null
          stock_after?: number
          stock_before?: number
          target_location_id?: string | null
          type?: string
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'movements_contact_id_fkey'
            columns: ['contact_id']
            isOneToOne: false
            referencedRelation: 'contacts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'movements_location_id_fkey'
            columns: ['location_id']
            isOneToOne: false
            referencedRelation: 'locations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'movements_operator_id_fkey'
            columns: ['operator_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'movements_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'movements_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'movements_target_location_id_fkey'
            columns: ['target_location_id']
            isOneToOne: false
            referencedRelation: 'locations'
            referencedColumns: ['id']
          },
        ]
      }
      organization_api_keys: {
        Row: {
          allowed_location_ids: string[] | null
          created_at: string
          created_by: string
          id: string
          key_hash: string
          last_used_at: string | null
          name: string
          org_id: string
          revoked_at: string | null
          scopes: string[]
        }
        Insert: {
          allowed_location_ids?: string[] | null
          created_at?: string
          created_by: string
          id?: string
          key_hash: string
          last_used_at?: string | null
          name?: string
          org_id: string
          revoked_at?: string | null
          scopes?: string[]
        }
        Update: {
          allowed_location_ids?: string[] | null
          created_at?: string
          created_by?: string
          id?: string
          key_hash?: string
          last_used_at?: string | null
          name?: string
          org_id?: string
          revoked_at?: string | null
          scopes?: string[]
        }
        Relationships: [
          {
            foreignKeyName: 'organization_api_keys_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'organization_api_keys_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      organization_memberships: {
        Row: {
          created_at: string
          force_pin_change: boolean
          id: string
          is_active: boolean
          last_login_at: string | null
          org_id: string
          pin_hash: string | null
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          force_pin_change?: boolean
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          org_id: string
          pin_hash?: string | null
          role: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          force_pin_change?: boolean
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          org_id?: string
          pin_hash?: string | null
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'organization_memberships_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'organization_memberships_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      organization_slug_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          new_slug: string
          old_slug: string
          org_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_slug: string
          old_slug: string
          org_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_slug?: string
          old_slug?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'organization_slug_history_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      organizations: {
        Row: {
          auto_reminder_days: number | null
          auto_reminder_enabled: boolean | null
          country: string | null
          created_at: string
          currency: string
          delivery_note_prefix: string
          has_api_enabled: boolean
          has_cashier_enabled: boolean
          has_invoicing_enabled: boolean
          has_storefront_enabled: boolean
          has_tax_enabled: boolean
          id: string
          invoice_prefix: string
          is_active: boolean
          is_suspended: boolean
          legal_mentions: string | null
          name: string
          onboarding_completed: boolean
          quote_prefix: string
          receipt_prefix: string
          slug: string
          storefront_location_id: string | null
          suspension_reason: string | null
          tax_id: string | null
          tax_name: string
          tax_rate: number
          timezone: string
          updated_at: string
        }
        Insert: {
          auto_reminder_days?: number | null
          auto_reminder_enabled?: boolean | null
          country?: string | null
          created_at?: string
          currency?: string
          delivery_note_prefix?: string
          has_api_enabled?: boolean
          has_cashier_enabled?: boolean
          has_invoicing_enabled?: boolean
          has_storefront_enabled?: boolean
          has_tax_enabled?: boolean
          id?: string
          invoice_prefix?: string
          is_active?: boolean
          is_suspended?: boolean
          legal_mentions?: string | null
          name: string
          onboarding_completed?: boolean
          quote_prefix?: string
          receipt_prefix?: string
          slug: string
          storefront_location_id?: string | null
          suspension_reason?: string | null
          tax_id?: string | null
          tax_name?: string
          tax_rate?: number
          timezone?: string
          updated_at?: string
        }
        Update: {
          auto_reminder_days?: number | null
          auto_reminder_enabled?: boolean | null
          country?: string | null
          created_at?: string
          currency?: string
          delivery_note_prefix?: string
          has_api_enabled?: boolean
          has_cashier_enabled?: boolean
          has_invoicing_enabled?: boolean
          has_storefront_enabled?: boolean
          has_tax_enabled?: boolean
          id?: string
          invoice_prefix?: string
          is_active?: boolean
          is_suspended?: boolean
          legal_mentions?: string | null
          name?: string
          onboarding_completed?: boolean
          quote_prefix?: string
          receipt_prefix?: string
          slug?: string
          storefront_location_id?: string | null
          suspension_reason?: string | null
          tax_id?: string | null
          tax_name?: string
          tax_rate?: number
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'organizations_storefront_location_id_fkey'
            columns: ['storefront_location_id']
            isOneToOne: false
            referencedRelation: 'locations'
            referencedColumns: ['id']
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          invoice_id: string
          org_id: string
          paid_at: string
          payment_method: string
          reference: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          invoice_id: string
          org_id: string
          paid_at?: string
          payment_method?: string
          reference?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          invoice_id?: string
          org_id?: string
          paid_at?: string
          payment_method?: string
          reference?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'payments_invoice_id_fkey'
            columns: ['invoice_id']
            isOneToOne: false
            referencedRelation: 'invoices'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'payments_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      plans: {
        Row: {
          created_at: string
          description: string | null
          id: string
          includes_api: boolean
          includes_inventory: boolean
          is_active: boolean
          max_locations: number | null
          max_monthly_movements: number | null
          max_products: number | null
          max_users: number | null
          name: string
          price_monthly: number
          price_yearly: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id: string
          includes_api?: boolean
          includes_inventory?: boolean
          is_active?: boolean
          max_locations?: number | null
          max_monthly_movements?: number | null
          max_products?: number | null
          max_users?: number | null
          name: string
          price_monthly?: number
          price_yearly?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          includes_api?: boolean
          includes_inventory?: boolean
          is_active?: boolean
          max_locations?: number | null
          max_monthly_movements?: number | null
          max_products?: number | null
          max_users?: number | null
          name?: string
          price_monthly?: number
          price_yearly?: number
        }
        Relationships: []
      }
      platform_admin_challenges: {
        Row: {
          auth_user_id: string
          challenge_hash: string
          consumed_at: string | null
          created_at: string | null
          expires_at: string
          id: string
        }
        Insert: {
          auth_user_id: string
          challenge_hash: string
          consumed_at?: string | null
          created_at?: string | null
          expires_at: string
          id?: string
        }
        Update: {
          auth_user_id?: string
          challenge_hash?: string
          consumed_at?: string | null
          created_at?: string | null
          expires_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'platform_admin_challenges_auth_user_id_fkey'
            columns: ['auth_user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      platform_admins: {
        Row: {
          auth_user_id: string
          created_at: string
          email: string
          id: string
          is_active: boolean
          name: string | null
          role: string
        }
        Insert: {
          auth_user_id: string
          created_at?: string
          email: string
          id?: string
          is_active?: boolean
          name?: string | null
          role?: string
        }
        Update: {
          auth_user_id?: string
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          name?: string | null
          role?: string
        }
        Relationships: []
      }
      platform_audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_role: string | null
          created_at: string
          id: string
          ip_address: string | null
          metadata: Json | null
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      products: {
        Row: {
          barcode: string | null
          category: string | null
          cost_price: number
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          org_id: string
          selling_price: number
          supplier: string | null
          threshold: number
          unit: string
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          category?: string | null
          cost_price?: number
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          org_id: string
          selling_price?: number
          supplier?: string | null
          threshold?: number
          unit?: string
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          category?: string | null
          cost_price?: number
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          org_id?: string
          selling_price?: number
          supplier?: string | null
          threshold?: number
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'products_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      receipt_items: {
        Row: {
          created_at: string
          discount_amount: number
          id: string
          product_id: string
          product_name: string
          quantity: number
          receipt_id: string
          tax_amount: number
          total: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          discount_amount?: number
          id?: string
          product_id: string
          product_name: string
          quantity?: number
          receipt_id: string
          tax_amount?: number
          total?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          discount_amount?: number
          id?: string
          product_id?: string
          product_name?: string
          quantity?: number
          receipt_id?: string
          tax_amount?: number
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: 'receipt_items_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'receipt_items_receipt_id_fkey'
            columns: ['receipt_id']
            isOneToOne: false
            referencedRelation: 'receipts'
            referencedColumns: ['id']
          },
        ]
      }
      receipts: {
        Row: {
          amount_paid: number
          cancelled_at: string | null
          cashier_session_id: string | null
          change_due: number
          contact_id: string | null
          created_at: string
          currency: string
          document_number: string
          id: string
          is_cancelled: boolean
          location_id: string
          notes: string | null
          operator_id: string | null
          org_id: string
          payment_method: string | null
          subtotal: number
          tax_amount: number
          total: number
          updated_at: string
        }
        Insert: {
          amount_paid?: number
          cancelled_at?: string | null
          cashier_session_id?: string | null
          change_due?: number
          contact_id?: string | null
          created_at?: string
          currency?: string
          document_number: string
          id?: string
          is_cancelled?: boolean
          location_id: string
          notes?: string | null
          operator_id?: string | null
          org_id: string
          payment_method?: string | null
          subtotal?: number
          tax_amount?: number
          total?: number
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          cancelled_at?: string | null
          cashier_session_id?: string | null
          change_due?: number
          contact_id?: string | null
          created_at?: string
          currency?: string
          document_number?: string
          id?: string
          is_cancelled?: boolean
          location_id?: string
          notes?: string | null
          operator_id?: string | null
          org_id?: string
          payment_method?: string | null
          subtotal?: number
          tax_amount?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'receipts_cashier_session_id_fkey'
            columns: ['cashier_session_id']
            isOneToOne: false
            referencedRelation: 'cashier_sessions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'receipts_contact_id_fkey'
            columns: ['contact_id']
            isOneToOne: false
            referencedRelation: 'contacts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'receipts_location_id_fkey'
            columns: ['location_id']
            isOneToOne: false
            referencedRelation: 'locations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'receipts_operator_id_fkey'
            columns: ['operator_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'receipts_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      stock_levels: {
        Row: {
          id: string
          location_id: string
          product_id: string
          quantity: number
          updated_at: string
        }
        Insert: {
          id?: string
          location_id: string
          product_id: string
          quantity?: number
          updated_at?: string
        }
        Update: {
          id?: string
          location_id?: string
          product_id?: string
          quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'stock_levels_location_id_fkey'
            columns: ['location_id']
            isOneToOne: false
            referencedRelation: 'locations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'stock_levels_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
        ]
      }
      subscriptions: {
        Row: {
          billing_interval: string
          canceled_at: string | null
          created_at: string
          current_period_ends_at: string
          current_period_starts_at: string
          id: string
          org_id: string
          plan_id: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          billing_interval?: string
          canceled_at?: string | null
          created_at?: string
          current_period_ends_at?: string
          current_period_starts_at?: string
          id?: string
          org_id: string
          plan_id: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          billing_interval?: string
          canceled_at?: string | null
          created_at?: string
          current_period_ends_at?: string
          current_period_starts_at?: string
          id?: string
          org_id?: string
          plan_id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'subscriptions_org_id_fkey'
            columns: ['org_id']
            isOneToOne: true
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'subscriptions_plan_id_fkey'
            columns: ['plan_id']
            isOneToOne: false
            referencedRelation: 'plans'
            referencedColumns: ['id']
          },
        ]
      }
      users: {
        Row: {
          active_org_id: string | null
          created_at: string
          email: string
          email_verified: boolean
          id: string
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          active_org_id?: string | null
          created_at?: string
          email: string
          email_verified?: boolean
          id?: string
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          active_org_id?: string | null
          created_at?: string
          email?: string
          email_verified?: boolean
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'users_active_org_id_fkey'
            columns: ['active_org_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_inventory_session: {
        Args: { p_session_id: string }
        Returns: undefined
      }
      cancel_sale: { Args: { p_movement_id: string }; Returns: undefined }
      cleanup_old_login_attempts: {
        Args: { p_older_than_days?: number }
        Returns: number
      }
      cleanup_old_magic_link_requests: {
        Args: { p_older_than_days?: number }
        Returns: number
      }
      complete_onboarding: {
        Args: {
          p_country: string
          p_currency: string
          p_default_location_name: string
          p_org_name: string
          p_org_slug: string
          p_plan_id?: string
          p_timezone: string
          p_user_id: string
        }
        Returns: string
      }
      convert_quote_to_invoice: {
        Args: { p_due_date?: string; p_issue_date?: string; p_quote_id: string }
        Returns: string
      }
      create_inventory_session: {
        Args: {
          p_location_id: string
          p_name: string
          p_operator_id: string
          p_org_id: string
        }
        Returns: string
      }
      current_membership: {
        Args: never
        Returns: {
          force_pin_change: boolean
          id: string
          is_active: boolean
          last_login_at: string
          org_id: string
          pin_hash: string
          role: string
          user_id: string
        }[]
      }
      current_org_plan_id: { Args: never; Returns: string }
      current_user_can_cancel_sales: { Args: never; Returns: boolean }
      current_user_is_admin_or_super_admin: { Args: never; Returns: boolean }
      current_user_is_operator_or_above: { Args: never; Returns: boolean }
      current_user_org_id: { Args: never; Returns: string }
      current_user_role: { Args: never; Returns: string }
      get_overdue_invoices_for_org: {
        Args: { p_org_id: string }
        Returns: {
          contact_email: string
          currency: string
          document_number: string
          due_date: string
          invoice_id: string
          total: number
        }[]
      }
      invoke_send_auto_reminders: { Args: never; Returns: undefined }
      is_platform_admin:
        | { Args: never; Returns: boolean }
        | { Args: { p_user_id: string }; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      log_platform_action: {
        Args: {
          p_action: string
          p_actor_id: string
          p_actor_role: string
          p_metadata?: Json
          p_target_id: string
          p_target_type: string
        }
        Returns: undefined
      }
      movements_count_this_month: {
        Args: { p_org_id: string }
        Returns: number
      }
      next_document_number: {
        Args: { p_document_type: string; p_org_id: string; p_prefix: string }
        Returns: string
      }
      org_has_feature: {
        Args: { p_feature: string; p_org_id: string }
        Returns: boolean
      }
      platform_admin_role: { Args: { p_user_id: string }; Returns: string }
      record_invoice_payment: {
        Args: {
          p_amount: number
          p_invoice_id: string
          p_paid_at?: string
          p_payment_method?: string
          p_reference?: string
        }
        Returns: string
      }
      record_movement:
        | {
            Args: {
              p_cashier_session_id?: string
              p_contact_id: string
              p_location_id: string
              p_org_id: string
              p_product_id: string
              p_quantity: number
              p_reason: string
              p_target_location_id: string
              p_type: string
              p_unit_price: number
            }
            Returns: string
          }
        | {
            Args: {
              p_cashier_session_id?: string
              p_client_operation_id?: string
              p_contact_id: string
              p_location_id: string
              p_org_id: string
              p_product_id: string
              p_quantity: number
              p_reason: string
              p_target_location_id: string
              p_type: string
              p_unit_price: number
            }
            Returns: string
          }
        | {
            Args: {
              p_location_id: string
              p_product_id: string
              p_quantity: number
              p_reason: string
              p_target_location_id: string
              p_type: string
            }
            Returns: string
          }
      record_storefront_order: {
        Args: {
          p_contact_id: string
          p_items: Json
          p_location_id: string
          p_org_id: string
          p_reason?: string
        }
        Returns: Json
      }
      set_default_location: {
        Args: { p_location_id: string; p_org_id: string }
        Returns: undefined
      }
      test_vault: { Args: never; Returns: string }
      update_inventory_count: {
        Args: { p_count_id: string; p_counted_quantity: number }
        Returns: undefined
      }
    }
    Enums: {
      invitation_status: 'pending' | 'accepted' | 'declined'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      invitation_status: ['pending', 'accepted', 'declined'],
    },
  },
} as const
