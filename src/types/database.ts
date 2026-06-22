export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string
          name: string
          currency: string
          timezone: string
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['organizations']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['organizations']['Insert']>
      }
      users: {
        Row: {
          id: string
          org_id: string
          name: string
          role: 'super_admin' | 'admin' | 'operator' | 'reader'
          pin_hash: string
          is_active: boolean
          last_login_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['users']['Insert']>
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
        Insert: Omit<Database['public']['Tables']['products']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['products']['Insert']>
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
          operator_id: string
          reference_id: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['movements']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['movements']['Insert']>
      }
    }
  }
}
