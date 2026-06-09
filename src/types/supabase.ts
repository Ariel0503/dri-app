export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      block_assignments: {
        Row: {
          block_id: string
          country_id: string | null
          id: string
          offer_id: string | null
          wave_id: string | null
        }
        Insert: {
          block_id: string
          country_id?: string | null
          id?: string
          offer_id?: string | null
          wave_id?: string | null
        }
        Update: {
          block_id?: string
          country_id?: string | null
          id?: string
          offer_id?: string | null
          wave_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "block_assignments_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "block_assignments_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "block_assignments_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "block_assignments_wave_id_fkey"
            columns: ["wave_id"]
            isOneToOne: false
            referencedRelation: "waves"
            referencedColumns: ["id"]
          },
        ]
      }
      blocks: {
        Row: {
          dependency_id: string | null
          id: string
          name: string
          scope_level: Database["public"]["Enums"]["brick_scope"]
          weight: number
        }
        Insert: {
          dependency_id?: string | null
          id?: string
          name: string
          scope_level?: Database["public"]["Enums"]["brick_scope"]
          weight?: number
        }
        Update: {
          dependency_id?: string | null
          id?: string
          name?: string
          scope_level?: Database["public"]["Enums"]["brick_scope"]
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "blocks_dependency_id_fkey"
            columns: ["dependency_id"]
            isOneToOne: false
            referencedRelation: "dependencies"
            referencedColumns: ["id"]
          },
        ]
      }
      brick_checks: {
        Row: {
          brick_id: string
          checked: boolean
          country_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          brick_id: string
          checked?: boolean
          country_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          brick_id?: string
          checked?: boolean
          country_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brick_checks_brick_id_fkey"
            columns: ["brick_id"]
            isOneToOne: false
            referencedRelation: "bricks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brick_checks_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brick_checks_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bricks: {
        Row: {
          block_id: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          block_id: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          block_id?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "bricks_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "blocks"
            referencedColumns: ["id"]
          },
        ]
      }
      business_units: {
        Row: {
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      countries: {
        Row: {
          flag_image: string | null
          id: string
          iso_code: string | null
          name: string
          region_id: string | null
        }
        Insert: {
          flag_image?: string | null
          id?: string
          iso_code?: string | null
          name: string
          region_id?: string | null
        }
        Update: {
          flag_image?: string | null
          id?: string
          iso_code?: string | null
          name?: string
          region_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "countries_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      dependencies: {
        Row: {
          color: string
          id: string
          label: string
          weight: number
        }
        Insert: {
          color?: string
          id?: string
          label: string
          weight?: number
        }
        Update: {
          color?: string
          id?: string
          label?: string
          weight?: number
        }
        Relationships: []
      }
      obstacle_blocks: {
        Row: {
          block_id: string
          obstacle_id: string
        }
        Insert: {
          block_id: string
          obstacle_id: string
        }
        Update: {
          block_id?: string
          obstacle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "obstacle_blocks_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obstacle_blocks_obstacle_id_fkey"
            columns: ["obstacle_id"]
            isOneToOne: false
            referencedRelation: "obstacles"
            referencedColumns: ["id"]
          },
        ]
      }
      obstacle_countries: {
        Row: {
          country_id: string
          obstacle_id: string
        }
        Insert: {
          country_id: string
          obstacle_id: string
        }
        Update: {
          country_id?: string
          obstacle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "obstacle_countries_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obstacle_countries_obstacle_id_fkey"
            columns: ["obstacle_id"]
            isOneToOne: false
            referencedRelation: "obstacles"
            referencedColumns: ["id"]
          },
        ]
      }
      obstacle_impacts: {
        Row: {
          blocked_obstacle_id: string
          obstacle_id: string
        }
        Insert: {
          blocked_obstacle_id: string
          obstacle_id: string
        }
        Update: {
          blocked_obstacle_id?: string
          obstacle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "obstacle_impacts_blocked_obstacle_id_fkey"
            columns: ["blocked_obstacle_id"]
            isOneToOne: false
            referencedRelation: "obstacles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obstacle_impacts_obstacle_id_fkey"
            columns: ["obstacle_id"]
            isOneToOne: false
            referencedRelation: "obstacles"
            referencedColumns: ["id"]
          },
        ]
      }
      obstacle_waves: {
        Row: {
          obstacle_id: string
          wave_id: string
        }
        Insert: {
          obstacle_id: string
          wave_id: string
        }
        Update: {
          obstacle_id?: string
          wave_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "obstacle_waves_obstacle_id_fkey"
            columns: ["obstacle_id"]
            isOneToOne: false
            referencedRelation: "obstacles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obstacle_waves_wave_id_fkey"
            columns: ["wave_id"]
            isOneToOne: false
            referencedRelation: "waves"
            referencedColumns: ["id"]
          },
        ]
      }
      obstacles: {
        Row: {
          created_at: string
          dependency_id: string | null
          description: string | null
          id: string
          owner: string | null
          resolution: string | null
          severity: Database["public"]["Enums"]["severity_level"]
          status: Database["public"]["Enums"]["obstacle_status"]
          title: string
        }
        Insert: {
          created_at?: string
          dependency_id?: string | null
          description?: string | null
          id?: string
          owner?: string | null
          resolution?: string | null
          severity?: Database["public"]["Enums"]["severity_level"]
          status?: Database["public"]["Enums"]["obstacle_status"]
          title: string
        }
        Update: {
          created_at?: string
          dependency_id?: string | null
          description?: string | null
          id?: string
          owner?: string | null
          resolution?: string | null
          severity?: Database["public"]["Enums"]["severity_level"]
          status?: Database["public"]["Enums"]["obstacle_status"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "obstacles_dependency_id_fkey"
            columns: ["dependency_id"]
            isOneToOne: false
            referencedRelation: "dependencies"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_business_units: {
        Row: {
          bu_id: string
          offer_id: string
        }
        Insert: {
          bu_id: string
          offer_id: string
        }
        Update: {
          bu_id?: string
          offer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "offer_business_units_bu_id_fkey"
            columns: ["bu_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_business_units_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_waves: {
        Row: {
          offer_id: string
          wave_id: string
        }
        Insert: {
          offer_id: string
          wave_id: string
        }
        Update: {
          offer_id?: string
          wave_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "offer_waves_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_waves_wave_id_fkey"
            columns: ["wave_id"]
            isOneToOne: false
            referencedRelation: "waves"
            referencedColumns: ["id"]
          },
        ]
      }
      offers: {
        Row: {
          id: string
          name: string
          short_code: string | null
        }
        Insert: {
          id?: string
          name: string
          short_code?: string | null
        }
        Update: {
          id?: string
          name?: string
          short_code?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      programme: {
        Row: {
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      regions: {
        Row: {
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      wave_assignment_deliveries: {
        Row: {
          assignment_id: string
          bu_id: string
        }
        Insert: {
          assignment_id: string
          bu_id: string
        }
        Update: {
          assignment_id?: string
          bu_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wave_assignment_deliveries_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "wave_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wave_assignment_deliveries_bu_id_fkey"
            columns: ["bu_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
        ]
      }
      wave_assignments: {
        Row: {
          country_id: string
          go_live_date: string | null
          id: string
          wave_id: string
        }
        Insert: {
          country_id: string
          go_live_date?: string | null
          id?: string
          wave_id: string
        }
        Update: {
          country_id?: string
          go_live_date?: string | null
          id?: string
          wave_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wave_assignments_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wave_assignments_wave_id_fkey"
            columns: ["wave_id"]
            isOneToOne: false
            referencedRelation: "waves"
            referencedColumns: ["id"]
          },
        ]
      }
      wave_countries: {
        Row: {
          country_id: string
          wave_id: string
        }
        Insert: {
          country_id: string
          wave_id: string
        }
        Update: {
          country_id?: string
          wave_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wave_countries_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wave_countries_wave_id_fkey"
            columns: ["wave_id"]
            isOneToOne: false
            referencedRelation: "waves"
            referencedColumns: ["id"]
          },
        ]
      }
      waves: {
        Row: {
          deadline: string | null
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          deadline?: string | null
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          deadline?: string | null
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_write: { Args: never; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "editor" | "viewer"
      brick_scope: "wave" | "offer"
      obstacle_status: "open" | "in-progress" | "resolved"
      severity_level: "critical" | "high" | "medium" | "low"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["admin", "editor", "viewer"],
      brick_scope: ["wave", "offer"],
      obstacle_status: ["open", "in-progress", "resolved"],
      severity_level: ["critical", "high", "medium", "low"],
    },
  },
} as const

