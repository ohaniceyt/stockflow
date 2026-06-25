export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string
          name: string
          slug: string
          currency: string
          timezone: string
          is_active: boolean
          is_suspended: boolean
          suspension_reason: string | null
          onboarding_completed: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<
          Database['public']['Tables']['organizations']['Row'],
          'id' | 'created_at' | 'updated_at'
        >
        Update: Partial<Database['public']['Tables']['organizations']['Insert']>
        Relationships: []
      }
      plans: {
        Row: {
          id: string
          name: string
          description: string | null
          price_monthly: number
          price_yearly: number
          max_users: number | null
          max_products: number | null
          max_locations: number | null
          max_monthly_movements: number | null
          includes_inventory: boolean
          includes_api: boolean
          is_active: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['plans']['Row'], 'created_at'>
        Update: Partial<Database['public']['Tables']['plans']['Insert']>
        Relationships: []
      }
      subscriptions: {
        Row: {
          id: string
          org_id: string
          plan_id: string
          status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'suspended'
          billing_interval: 'month' | 'year'
          current_period_starts_at: string
          current_period_ends_at: string
          trial_ends_at: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          canceled_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<
          Database['public']['Tables']['subscriptions']['Row'],
          'id' | 'created_at' | 'updated_at'
        >
        Update: Partial<Database['public']['Tables']['subscriptions']['Insert']>
        Relationships: []
      }
      platform_admins: {
        Row: {
          id: string
          auth_user_id: string
          email: string
          name: string | null
          is_active: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['platform_admins']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['platform_admins']['Insert']>
        Relationships: []
      }
      users: {
        Row: {
          id: string
          name: string
          email: string
          phone: string | null
          email_verified: boolean
          active_org_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['users']['Insert']>
        Relationships: []
      }
      organization_memberships: {
        Row: {
          id: string
          org_id: string
          user_id: string
          role: 'super_admin' | 'admin' | 'operator' | 'cashier' | 'reader'
          pin_hash: string
          is_active: boolean
          force_pin_change: boolean
          last_login_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<
          Database['public']['Tables']['organization_memberships']['Row'],
          'id' | 'created_at' | 'updated_at'
        >
        Update: Partial<Database['public']['Tables']['organization_memberships']['Insert']>
        Relationships: []
      }
      products: {
        Row: {
          id: string
          org_id: string
          name: string
          category: string | null
          unit: string
          threshold: number
          cost_price: number
          selling_price: number
          supplier: string | null
          description: string | null
          barcode: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<
          Database['public']['Tables']['products']['Row'],
          'id' | 'created_at' | 'updated_at'
        >
        Update: Partial<Database['public']['Tables']['products']['Insert']>
        Relationships: []
      }
      categories: {
        Row: {
          id: string
          org_id: string
          name: string
          created_at: string
          updated_at: string
        }
        Insert: Omit<
          Database['public']['Tables']['categories']['Row'],
          'id' | 'created_at' | 'updated_at'
        >
        Update: Partial<Database['public']['Tables']['categories']['Insert']>
        Relationships: []
      }
      locations: {
        Row: {
          id: string
          org_id: string
          name: string
          description: string | null
          address: string | null
          is_default: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['locations']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['locations']['Insert']>
        Relationships: []
      }
      stock_levels: {
        Row: {
          id: string
          product_id: string
          location_id: string
          quantity: number
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['stock_levels']['Row'], 'id' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['stock_levels']['Insert']>
        Relationships: []
      }
      movements: {
        Row: {
          id: string
          product_id: string
          location_id: string
          target_location_id: string | null
          type: 'IN' | 'OUT' | 'INVENTORY' | 'ADJUSTMENT' | 'TRANSFER'
          quantity: number
          stock_before: number
          stock_after: number
          reason: string | null
          contact_id: string | null
          operator_id: string
          reference_id: string | null
          unit_price: number | null
          is_cancelled: boolean
          cancelled_by: string | null
          cancelled_at: string | null
          cashier_session_id: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['movements']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['movements']['Insert']>
        Relationships: []
      }
      cashier_sessions: {
        Row: {
          id: string
          org_id: string
          location_id: string
          operator_id: string
          opened_at: string
          closed_at: string | null
          opening_balance: number
          closing_balance: number | null
          daily_revenue: number
          status: 'open' | 'closed'
          created_at: string
          updated_at: string
        }
        Insert: Omit<
          Database['public']['Tables']['cashier_sessions']['Row'],
          | 'id'
          | 'opened_at'
          | 'closed_at'
          | 'daily_revenue'
          | 'created_at'
          | 'updated_at'
          | 'closing_balance'
        >
        Update: Partial<Database['public']['Tables']['cashier_sessions']['Row']>
        Relationships: []
      }
      contacts: {
        Row: {
          id: string
          org_id: string
          type: 'SUPPLIER' | 'CUSTOMER'
          name: string
          email: string | null
          phone: string | null
          address: string | null
          tax_id: string | null
          notes: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<
          Database['public']['Tables']['contacts']['Row'],
          'id' | 'created_at' | 'updated_at'
        >
        Update: Partial<Database['public']['Tables']['contacts']['Insert']>
        Relationships: []
      }
      inventory_sessions: {
        Row: {
          id: string
          org_id: string
          location_id: string
          name: string
          status: 'pending' | 'completed' | 'cancelled'
          started_at: string
          completed_at: string | null
          operator_id: string
        }
        Insert: Omit<
          Database['public']['Tables']['inventory_sessions']['Row'],
          'id' | 'started_at' | 'completed_at'
        >
        Update: Partial<Database['public']['Tables']['inventory_sessions']['Insert']>
        Relationships: []
      }
      inventory_counts: {
        Row: {
          id: string
          session_id: string
          product_id: string
          location_id: string
          theoretical_quantity: number
          counted_quantity: number
          difference: number
          is_validated: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['inventory_counts']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['inventory_counts']['Insert']>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      record_movement: {
        Args: {
          p_product_id: string
          p_location_id: string
          p_target_location_id: string | null
          p_type: 'IN' | 'OUT' | 'INVENTORY' | 'ADJUSTMENT' | 'TRANSFER'
          p_quantity: number
          p_reason: string | null
          p_contact_id: string | null
        }
        Returns: string
      }
      apply_inventory_session: {
        Args: { p_session_id: string }
        Returns: undefined
      }
      create_inventory_session: {
        Args: {
          p_org_id: string
          p_location_id: string
          p_name: string
          p_operator_id: string
        }
        Returns: string
      }
      update_inventory_count: {
        Args: { p_count_id: string; p_counted_quantity: number }
        Returns: undefined
      }
      set_default_location: {
        Args: { p_org_id: string; p_location_id: string }
        Returns: undefined
      }
      is_platform_admin: {
        Args: Record<string, never>
        Returns: boolean
      }
      current_org_plan_id: {
        Args: Record<string, never>
        Returns: string
      }
      movements_count_this_month: {
        Args: { p_org_id: string }
        Returns: number
      }
    }
    Enums: Record<string, string>
    CompositeTypes: Record<string, never>
  }
}
