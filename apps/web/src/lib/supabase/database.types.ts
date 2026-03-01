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
      clubs: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          location: string | null
          name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          location?: string | null
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          location?: string | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "clubs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          city: string | null
          club_id: string | null
          country: string
          created_at: string
          created_by: string
          deleted_at: string | null
          external_id: string | null
          id: string
          name: string
          num_holes: number
          source: string | null
          state: string | null
        }
        Insert: {
          city?: string | null
          club_id?: string | null
          country?: string
          created_at?: string
          created_by: string
          deleted_at?: string | null
          external_id?: string | null
          id?: string
          name: string
          num_holes?: number
          source?: string | null
          state?: string | null
        }
        Update: {
          city?: string | null
          club_id?: string | null
          country?: string
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          external_id?: string | null
          id?: string
          name?: string
          num_holes?: number
          source?: string | null
          state?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "courses_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      game_players: {
        Row: {
          game_id: string
          id: string
          player_id: string | null
          playing_handicap: number | null
          round_player_id: string | null
          team_id: string | null
        }
        Insert: {
          game_id: string
          id?: string
          player_id?: string | null
          playing_handicap?: number | null
          round_player_id?: string | null
          team_id?: string | null
        }
        Update: {
          game_id?: string
          id?: string
          player_id?: string | null
          playing_handicap?: number | null
          round_player_id?: string | null
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_players_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_players_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_players_round_player_id_fkey"
            columns: ["round_player_id"]
            isOneToOne: false
            referencedRelation: "round_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "game_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      game_teams: {
        Row: {
          game_id: string
          id: string
          team_name: string
          team_order: number | null
        }
        Insert: {
          game_id: string
          id?: string
          team_name: string
          team_order?: number | null
        }
        Update: {
          game_id?: string
          id?: string
          team_name?: string
          team_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "game_teams_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      games: {
        Row: {
          config: Json
          created_at: string
          format: string
          holes: string
          id: string
          money_per_unit: number | null
          name: string | null
          results: Json | null
          round_id: string
          status: string
        }
        Insert: {
          config?: Json
          created_at?: string
          format: string
          holes?: string
          id?: string
          money_per_unit?: number | null
          name?: string | null
          results?: Json | null
          round_id: string
          status?: string
        }
        Update: {
          config?: Json
          created_at?: string
          format?: string
          holes?: string
          id?: string
          money_per_unit?: number | null
          name?: string | null
          results?: Json | null
          round_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "games_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          group_id: string
          id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          created_by: string
          default_course_id: string | null
          description: string | null
          home_club_id: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by: string
          default_course_id?: string | null
          description?: string | null
          home_club_id?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string
          default_course_id?: string | null
          description?: string | null
          home_club_id?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_default_course_id_fkey"
            columns: ["default_course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_home_club_id_fkey"
            columns: ["home_club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      handicap_records: {
        Row: {
          calculated_at: string
          differentials_used: Json
          handicap_index: number
          id: string
          round_id: string
          user_id: string
        }
        Insert: {
          calculated_at?: string
          differentials_used?: Json
          handicap_index: number
          id?: string
          round_id: string
          user_id: string
        }
        Update: {
          calculated_at?: string
          differentials_used?: Json
          handicap_index?: number
          id?: string
          round_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "handicap_records_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "handicap_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      holes: {
        Row: {
          handicap_index: number
          hole_number: number
          id: string
          par: number
          tee_box_id: string
          yardage: number | null
        }
        Insert: {
          handicap_index: number
          hole_number: number
          id?: string
          par: number
          tee_box_id: string
          yardage?: number | null
        }
        Update: {
          handicap_index?: number
          hole_number?: number
          id?: string
          par?: number
          tee_box_id?: string
          yardage?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "holes_tee_box_id_fkey"
            columns: ["tee_box_id"]
            isOneToOne: false
            referencedRelation: "tee_boxes"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          group_id: string
          id: string
          invited_by: string
          round_id: string | null
          status: string
          token: string
          type: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at: string
          group_id: string
          id?: string
          invited_by: string
          round_id?: string | null
          status?: string
          token: string
          type: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          group_id?: string
          id?: string
          invited_by?: string
          round_id?: string | null
          status?: string
          token?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          current_handicap_index: number | null
          default_tee_tier: number | null
          display_name: string
          email: string
          id: string
          is_site_admin: boolean
          profile_completed: boolean
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          current_handicap_index?: number | null
          default_tee_tier?: number | null
          display_name: string
          email: string
          id: string
          is_site_admin?: boolean
          profile_completed?: boolean
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          current_handicap_index?: number | null
          default_tee_tier?: number | null
          display_name?: string
          email?: string
          id?: string
          is_site_admin?: boolean
          profile_completed?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          id: string
          key: string
          timestamp: string
        }
        Insert: {
          id?: string
          key: string
          timestamp?: string
        }
        Update: {
          id?: string
          key?: string
          timestamp?: string
        }
        Relationships: []
      }
      round_players: {
        Row: {
          course_handicap: number | null
          guest_handicap_index: number | null
          guest_name: string | null
          handicap_index_at_round: number | null
          id: string
          playing_handicap: number | null
          round_id: string
          status: string
          tee_box_id: string
          tee_time_group_id: string | null
          user_id: string | null
        }
        Insert: {
          course_handicap?: number | null
          guest_handicap_index?: number | null
          guest_name?: string | null
          handicap_index_at_round?: number | null
          id?: string
          playing_handicap?: number | null
          round_id: string
          status?: string
          tee_box_id: string
          tee_time_group_id?: string | null
          user_id?: string | null
        }
        Update: {
          course_handicap?: number | null
          guest_handicap_index?: number | null
          guest_name?: string | null
          handicap_index_at_round?: number | null
          id?: string
          playing_handicap?: number | null
          round_id?: string
          status?: string
          tee_box_id?: string
          tee_time_group_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "round_players_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "round_players_tee_box_id_fkey"
            columns: ["tee_box_id"]
            isOneToOne: false
            referencedRelation: "tee_boxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "round_players_tee_time_group_id_fkey"
            columns: ["tee_time_group_id"]
            isOneToOne: false
            referencedRelation: "tee_time_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "round_players_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rounds: {
        Row: {
          completed_at: string | null
          course_id: string
          created_at: string
          created_by: string
          group_id: string
          id: string
          round_date: string
          scorekeeper_id: string | null
          scoring_mode: string
          status: string
          tee_box_id: string
          tee_time: string | null
        }
        Insert: {
          completed_at?: string | null
          course_id: string
          created_at?: string
          created_by: string
          group_id: string
          id?: string
          round_date: string
          scorekeeper_id?: string | null
          scoring_mode?: string
          status?: string
          tee_box_id: string
          tee_time?: string | null
        }
        Update: {
          completed_at?: string | null
          course_id?: string
          created_at?: string
          created_by?: string
          group_id?: string
          id?: string
          round_date?: string
          scorekeeper_id?: string | null
          scoring_mode?: string
          status?: string
          tee_box_id?: string
          tee_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rounds_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rounds_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rounds_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rounds_scorekeeper_id_fkey"
            columns: ["scorekeeper_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rounds_tee_box_id_fkey"
            columns: ["tee_box_id"]
            isOneToOne: false
            referencedRelation: "tee_boxes"
            referencedColumns: ["id"]
          },
        ]
      }
      scores: {
        Row: {
          entered_by: string
          fairway_hit: boolean | null
          gir: boolean | null
          hole_number: number
          id: string
          player_id: string | null
          putts: number | null
          round_id: string
          round_player_id: string | null
          strokes: number | null
          up_and_down: boolean | null
          updated_at: string
        }
        Insert: {
          entered_by: string
          fairway_hit?: boolean | null
          gir?: boolean | null
          hole_number: number
          id?: string
          player_id?: string | null
          putts?: number | null
          round_id: string
          round_player_id?: string | null
          strokes?: number | null
          up_and_down?: boolean | null
          updated_at?: string
        }
        Update: {
          entered_by?: string
          fairway_hit?: boolean | null
          gir?: boolean | null
          hole_number?: number
          id?: string
          player_id?: string | null
          putts?: number | null
          round_id?: string
          round_player_id?: string | null
          strokes?: number | null
          up_and_down?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scores_entered_by_fkey"
            columns: ["entered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scores_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scores_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scores_round_player_id_fkey"
            columns: ["round_player_id"]
            isOneToOne: false
            referencedRelation: "round_players"
            referencedColumns: ["id"]
          },
        ]
      }
      seasons: {
        Row: {
          created_at: string
          created_by: string
          end_date: string
          group_id: string
          id: string
          is_active: boolean
          name: string
          points_config: Json
          start_date: string
        }
        Insert: {
          created_at?: string
          created_by: string
          end_date: string
          group_id: string
          id?: string
          is_active?: boolean
          name: string
          points_config?: Json
          start_date: string
        }
        Update: {
          created_at?: string
          created_by?: string
          end_date?: string
          group_id?: string
          id?: string
          is_active?: boolean
          name?: string
          points_config?: Json
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "seasons_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seasons_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      settlements: {
        Row: {
          amount: number
          created_at: string
          id: string
          payee_id: string
          payer_id: string
          round_id: string
          status: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          payee_id: string
          payer_id: string
          round_id: string
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          payee_id?: string
          payer_id?: string
          round_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "settlements_payee_id_fkey"
            columns: ["payee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlements_payer_id_fkey"
            columns: ["payer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlements_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      tee_boxes: {
        Row: {
          color: string | null
          course_id: string
          course_rating: number
          id: string
          name: string
          slope_rating: number
          tier: number | null
          total_yardage: number | null
        }
        Insert: {
          color?: string | null
          course_id: string
          course_rating: number
          id?: string
          name: string
          slope_rating: number
          tier?: number | null
          total_yardage?: number | null
        }
        Update: {
          color?: string | null
          course_id?: string
          course_rating?: number
          id?: string
          name?: string
          slope_rating?: number
          tier?: number | null
          total_yardage?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tee_boxes_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      tee_time_groups: {
        Row: {
          created_at: string | null
          id: string
          name: string
          round_id: string
          sort_order: number
          tee_time: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name?: string
          round_id: string
          sort_order?: number
          tee_time?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          round_id?: string
          sort_order?: number
          tee_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tee_time_groups_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_rate_limits: { Args: never; Returns: undefined }
      is_group_admin: { Args: { check_group_id: string }; Returns: boolean }
      is_group_member: { Args: { check_group_id: string }; Returns: boolean }
      shares_group_with: { Args: { target_user_id: string }; Returns: boolean }
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
