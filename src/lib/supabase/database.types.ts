export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      organization_memberships: {
        Row: {
          organization_id: string;
          user_id: string;
          role: "owner" | "admin" | "manager" | "staff";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          organization_id: string;
          user_id: string;
          role?: "owner" | "admin" | "manager" | "staff";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          organization_id?: string;
          user_id?: string;
          role?: "owner" | "admin" | "manager" | "staff";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      ingredients: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          sku: string | null;
          base_unit_id: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          sku?: string | null;
          base_unit_id?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          name?: string;
          sku?: string | null;
          base_unit_id?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      inventory_items: {
        Row: {
          id: string;
          organization_id: string;
          restaurant_id: string;
          ingredient_id: string;
          current_quantity: number;
          reorder_level: number;
          par_level: number;
          cost_per_unit: number;
          last_movement_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          restaurant_id: string;
          ingredient_id: string;
          current_quantity?: number;
          reorder_level?: number;
          par_level?: number;
          cost_per_unit?: number;
          last_movement_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          restaurant_id?: string;
          ingredient_id?: string;
          current_quantity?: number;
          reorder_level?: number;
          par_level?: number;
          cost_per_unit?: number;
          last_movement_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      menu_items: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          category: string;
          price: number;
          status: "draft" | "active" | "archived";
          description: string | null;
          image_path: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          category?: string;
          price?: number;
          status?: "draft" | "active" | "archived";
          description?: string | null;
          image_path?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          name?: string;
          category?: string;
          price?: number;
          status?: "draft" | "active" | "archived";
          description?: string | null;
          image_path?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      menu_item_photos: {
        Row: {
          id: string;
          organization_id: string;
          menu_item_id: string;
          path: string;
          sort_order: number;
          is_cover: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          menu_item_id: string;
          path: string;
          sort_order?: number;
          is_cover?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          menu_item_id?: string;
          path?: string;
          sort_order?: number;
          is_cover?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      recipe_ingredients: {
        Row: {
          id: string;
          organization_id: string;
          recipe_id: string;
          ingredient_id: string;
          quantity: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          recipe_id: string;
          ingredient_id: string;
          quantity: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          recipe_id?: string;
          ingredient_id?: string;
          quantity?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      recipes: {
        Row: {
          id: string;
          organization_id: string;
          menu_item_id: string;
          yield_quantity: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          menu_item_id: string;
          yield_quantity?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          menu_item_id?: string;
          yield_quantity?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      restaurants: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          currency_code: string;
          code: string | null;
          city: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          currency_code?: string;
          code?: string | null;
          city?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          name?: string;
          currency_code?: string;
          code?: string | null;
          city?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      service_menu_items: {
        Row: {
          id: string;
          organization_id: string;
          service_menu_id: string;
          menu_item_id: string;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          service_menu_id: string;
          menu_item_id: string;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          service_menu_id?: string;
          menu_item_id?: string;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      service_menus: {
        Row: {
          id: string;
          organization_id: string;
          restaurant_id: string | null;
          name: string;
          description: string | null;
          status: "draft" | "active" | "archived";
          starts_on: string | null;
          ends_on: string | null;
          weekend_only: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          restaurant_id?: string | null;
          name: string;
          description?: string | null;
          status?: "draft" | "active" | "archived";
          starts_on?: string | null;
          ends_on?: string | null;
          weekend_only?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          restaurant_id?: string | null;
          name?: string;
          description?: string | null;
          status?: "draft" | "active" | "archived";
          starts_on?: string | null;
          ends_on?: string | null;
          weekend_only?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      stock_movements: {
        Row: {
          id: string;
          organization_id: string;
          restaurant_id: string;
          inventory_item_id: string;
          movement_type: "receive" | "consume" | "adjustment";
          quantity_delta: number;
          unit_cost: number | null;
          note: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          restaurant_id: string;
          inventory_item_id: string;
          movement_type: "receive" | "consume" | "adjustment";
          quantity_delta: number;
          unit_cost?: number | null;
          note?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          restaurant_id?: string;
          inventory_item_id?: string;
          movement_type?: "receive" | "consume" | "adjustment";
          quantity_delta?: number;
          unit_cost?: number | null;
          note?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      suppliers: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          contact_email: string | null;
          phone: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          contact_email?: string | null;
          phone?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          name?: string;
          contact_email?: string | null;
          phone?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      units: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          symbol: string;
          kind: "weight" | "volume" | "count" | "other";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          symbol: string;
          kind?: "weight" | "volume" | "count" | "other";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          name?: string;
          symbol?: string;
          kind?: "weight" | "volume" | "count" | "other";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_preferences: {
        Row: {
          user_id: string;
          active_organization_id: string | null;
          active_restaurant_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          active_organization_id?: string | null;
          active_restaurant_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          active_organization_id?: string | null;
          active_restaurant_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_org_member: {
        Args: {
          target_organization_id: string;
        };
        Returns: boolean;
      };
      has_org_role: {
        Args: {
          target_organization_id: string;
          allowed_roles: string[];
        };
        Returns: boolean;
      };
      seed_default_units: {
        Args: {
          target_organization_id: string;
        };
        Returns: undefined;
      };
    };
    Enums: {
      inventory_movement_type: "receive" | "consume" | "adjustment";
      inventory_unit_kind: "weight" | "volume" | "count" | "other";
      menu_item_status: "draft" | "active" | "archived";
      service_menu_status: "draft" | "active" | "archived";
    };
    CompositeTypes: Record<string, never>;
  };
};
