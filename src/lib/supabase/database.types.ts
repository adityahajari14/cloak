export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type Database = {
  public: {
    Enums: {
      billing_plan: "starter" | "professional" | "per_event";
      billing_status:
        | "not_started"
        | "incomplete"
        | "trialing"
        | "active"
        | "past_due"
        | "canceled"
        | "unpaid";
      profile_role: "guest" | "platform_admin";
      scan_result: "accepted" | "rejected";
      scan_type: "activation" | "checkout" | "rejected";
      slot_status: "available" | "occupied" | "blocked";
      ticket_status: "pending_activation" | "active" | "partially_collected" | "collected" | "forgotten" | "cancelled" | "expired";
      venue_approval_status: "pending" | "approved" | "rejected" | "suspended";
      venue_staff_role: "staff" | "manager";
    };
    Tables: {
      audit_logs: {
        Row: {
          action: string;
          actor_profile_id: string | null;
          created_at: string;
          entity_id: string | null;
          entity_type: string;
          id: string;
          metadata: Json;
          venue_id: string | null;
        };
        Insert: {
          action: string;
          actor_profile_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type: string;
          id?: string;
          metadata?: Json;
          venue_id?: string | null;
        };
        Update: {
          action?: string;
          actor_profile_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string;
          id?: string;
          metadata?: Json;
          venue_id?: string | null;
        };
        Relationships: [];
      };
      events: {
        Row: {
          active: boolean;
          created_at: string;
          ends_at: string | null;
          event_date: string;
          id: string;
          name: string;
          starts_at: string | null;
          venue_id: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          ends_at?: string | null;
          event_date: string;
          id?: string;
          name: string;
          starts_at?: string | null;
          venue_id: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          ends_at?: string | null;
          event_date?: string;
          id?: string;
          name?: string;
          starts_at?: string | null;
          venue_id?: string;
        };
        Relationships: [];
      };
      ticket_items: {
        Row: {
          added_at: string;
          added_by: string | null;
          collected_at: string | null;
          collected_by: string | null;
          id: string;
          label: string;
          notes: string | null;
          quantity: number;
          storage_location: string | null;
          ticket_id: string;
        };
        Insert: {
          added_at?: string;
          added_by?: string | null;
          collected_at?: string | null;
          collected_by?: string | null;
          id?: string;
          label: string;
          notes?: string | null;
          quantity?: number;
          storage_location?: string | null;
          ticket_id: string;
        };
        Update: {
          added_at?: string;
          added_by?: string | null;
          collected_at?: string | null;
          collected_by?: string | null;
          id?: string;
          label?: string;
          notes?: string | null;
          quantity?: number;
          storage_location?: string | null;
          ticket_id?: string;
        };
        Relationships: [];
      };
      leads: {
        Row: {
          capacity_estimate: string | null;
          contact_email: string;
          contact_name: string;
          country: string | null;
          created_at: string;
          id: string;
          message: string | null;
          venue_name: string;
        };
        Insert: {
          capacity_estimate?: string | null;
          contact_email: string;
          contact_name: string;
          country?: string | null;
          created_at?: string;
          id?: string;
          message?: string | null;
          venue_name: string;
        };
        Update: {
          capacity_estimate?: string | null;
          contact_email?: string;
          contact_name?: string;
          country?: string | null;
          created_at?: string;
          id?: string;
          message?: string | null;
          venue_name?: string;
        };
        Relationships: [];
      };
      guest_contacts: {
        Row: {
          created_at: string;
          date_of_birth: string | null;
          email: string;
          email_normalized: string;
          full_name: string;
          gender: string | null;
          id: string;
          member_since: string | null;
          membership_token_hash: string | null;
          phone: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          date_of_birth?: string | null;
          email: string;
          email_normalized: string;
          full_name: string;
          gender?: string | null;
          id?: string;
          member_since?: string | null;
          membership_token_hash?: string | null;
          phone: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          date_of_birth?: string | null;
          email?: string;
          email_normalized?: string;
          full_name?: string;
          gender?: string | null;
          id?: string;
          member_since?: string | null;
          membership_token_hash?: string | null;
          phone?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          email: string;
          full_name: string | null;
          id: string;
          phone: string | null;
          role: Database["public"]["Enums"]["profile_role"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          full_name?: string | null;
          id: string;
          phone?: string | null;
          role?: Database["public"]["Enums"]["profile_role"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          full_name?: string | null;
          id?: string;
          phone?: string | null;
          role?: Database["public"]["Enums"]["profile_role"];
          updated_at?: string;
        };
        Relationships: [];
      };
      ticket_scans: {
        Row: {
          created_at: string;
          id: string;
          reason: string | null;
          result: Database["public"]["Enums"]["scan_result"];
          scan_type: Database["public"]["Enums"]["scan_type"];
          scanned_by: string | null;
          ticket_id: string;
          venue_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          reason?: string | null;
          result: Database["public"]["Enums"]["scan_result"];
          scan_type: Database["public"]["Enums"]["scan_type"];
          scanned_by?: string | null;
          ticket_id: string;
          venue_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          reason?: string | null;
          result?: Database["public"]["Enums"]["scan_result"];
          scan_type?: Database["public"]["Enums"]["scan_type"];
          scanned_by?: string | null;
          ticket_id?: string;
          venue_id?: string;
        };
        Relationships: [];
      };
      ticket_contacts: {
        Row: {
          channel: "email" | "whatsapp";
          contacted_by: string | null;
          created_at: string;
          id: string;
          ticket_id: string;
        };
        Insert: {
          channel: "email" | "whatsapp";
          contacted_by?: string | null;
          created_at?: string;
          id?: string;
          ticket_id: string;
        };
        Update: {
          channel?: "email" | "whatsapp";
          contacted_by?: string | null;
          created_at?: string;
          id?: string;
          ticket_id?: string;
        };
        Relationships: [];
      };
      venue_contacts: {
        Row: {
          contacted_by: string | null;
          created_at: string;
          id: string;
          message: string;
          subject: string;
          template: "billing_followup" | "cancellation_followup" | "custom";
          venue_id: string;
        };
        Insert: {
          contacted_by?: string | null;
          created_at?: string;
          id?: string;
          message: string;
          subject: string;
          template: "billing_followup" | "cancellation_followup" | "custom";
          venue_id: string;
        };
        Update: {
          contacted_by?: string | null;
          created_at?: string;
          id?: string;
          message?: string;
          subject?: string;
          template?: "billing_followup" | "cancellation_followup" | "custom";
          venue_id?: string;
        };
        Relationships: [];
      };
      venue_staff: {
        Row: {
          accepted_at: string | null;
          created_at: string;
          id: string;
          invited_email: string | null;
          profile_id: string | null;
          role: Database["public"]["Enums"]["venue_staff_role"];
          updated_at: string;
          venue_id: string;
        };
        Insert: {
          accepted_at?: string | null;
          created_at?: string;
          id?: string;
          invited_email?: string | null;
          profile_id?: string | null;
          role?: Database["public"]["Enums"]["venue_staff_role"];
          updated_at?: string;
          venue_id: string;
        };
        Update: {
          accepted_at?: string | null;
          created_at?: string;
          id?: string;
          invited_email?: string | null;
          profile_id?: string | null;
          role?: Database["public"]["Enums"]["venue_staff_role"];
          updated_at?: string;
          venue_id?: string;
        };
        Relationships: [];
      };
      venue_slots: {
        Row: {
          active: boolean;
          created_at: string;
          id: string;
          label: string;
          status: Database["public"]["Enums"]["slot_status"];
          updated_at: string;
          venue_id: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          id?: string;
          label: string;
          status?: Database["public"]["Enums"]["slot_status"];
          updated_at?: string;
          venue_id: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          id?: string;
          label?: string;
          status?: Database["public"]["Enums"]["slot_status"];
          updated_at?: string;
          venue_id?: string;
        };
        Relationships: [];
      };
      venues: {
        Row: {
          active: boolean;
          address: string | null;
          billing_cadence: "monthly" | "annual";
          billing_plan: Database["public"]["Enums"]["billing_plan"] | null;
          billing_status: Database["public"]["Enums"]["billing_status"];
          cancellation_pay_remainder: boolean;
          cancellation_requested_at: string | null;
          capacity: number;
          hanger_capacity: number;
          bag_capacity: number;
          extra_devices: number;
          city: string | null;
          contact_email: string;
          contact_phone: string | null;
          country: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          name: string;
          latitude: number | null;
          longitude: number | null;
          postal_code: string | null;
          slug: string;
          stripe_customer_id: string | null;
          stripe_price_id: string | null;
          stripe_subscription_id: string | null;
          subscription_ends_at: string | null;
          ticket_expiry_hours: number | null;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          address?: string | null;
          billing_cadence?: "monthly" | "annual";
          billing_plan?: Database["public"]["Enums"]["billing_plan"] | null;
          billing_status?: Database["public"]["Enums"]["billing_status"];
          cancellation_pay_remainder?: boolean;
          cancellation_requested_at?: string | null;
          capacity?: number;
          hanger_capacity?: number;
          bag_capacity?: number;
          extra_devices?: number;
          city?: string | null;
          contact_email: string;
          contact_phone?: string | null;
          country?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name: string;
          postal_code?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          slug: string;
          stripe_customer_id?: string | null;
          stripe_price_id?: string | null;
          stripe_subscription_id?: string | null;
          subscription_ends_at?: string | null;
          ticket_expiry_hours?: number | null;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          address?: string | null;
          billing_cadence?: "monthly" | "annual";
          billing_plan?: Database["public"]["Enums"]["billing_plan"] | null;
          billing_status?: Database["public"]["Enums"]["billing_status"];
          cancellation_pay_remainder?: boolean;
          cancellation_requested_at?: string | null;
          capacity?: number;
          hanger_capacity?: number;
          bag_capacity?: number;
          extra_devices?: number;
          city?: string | null;
          contact_email?: string;
          contact_phone?: string | null;
          country?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name?: string;
          latitude?: number | null;
          longitude?: number | null;
          postal_code?: string | null;
          slug?: string;
          stripe_customer_id?: string | null;
          stripe_price_id?: string | null;
          stripe_subscription_id?: string | null;
          subscription_ends_at?: string | null;
          ticket_expiry_hours?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      tickets: {
        Row: {
          activated_at: string | null;
          activation_confirmed_by: string | null;
          assigned_slot_id: string | null;
          collected_at: string | null;
          checkout_confirmed_by: string | null;
          created_at: string;
          event_id: string | null;
          expires_at: string;
          guest_contact_id: string | null;
          guest_email: string | null;
          guest_name: string;
          guest_phone: string;
          guest_profile_id: string | null;
          id: string;
          item_count: number;
          item_description: string | null;
          item_type: string | null;
          public_code: string;
          qr_token_hash: string;
          status: Database["public"]["Enums"]["ticket_status"];
          storage_location: string | null;
          updated_at: string;
          venue_id: string;
        };
        Insert: {
          activated_at?: string | null;
          activation_confirmed_by?: string | null;
          assigned_slot_id?: string | null;
          collected_at?: string | null;
          checkout_confirmed_by?: string | null;
          created_at?: string;
          event_id?: string | null;
          expires_at: string;
          guest_contact_id?: string | null;
          guest_email?: string | null;
          guest_name: string;
          guest_phone: string;
          guest_profile_id?: string | null;
          id?: string;
          item_count?: number;
          item_description?: string | null;
          item_type?: string | null;
          public_code: string;
          qr_token_hash: string;
          status?: Database["public"]["Enums"]["ticket_status"];
          storage_location?: string | null;
          updated_at?: string;
          venue_id: string;
        };
        Update: {
          activated_at?: string | null;
          activation_confirmed_by?: string | null;
          assigned_slot_id?: string | null;
          collected_at?: string | null;
          checkout_confirmed_by?: string | null;
          created_at?: string;
          event_id?: string | null;
          expires_at?: string;
          guest_contact_id?: string | null;
          guest_email?: string | null;
          guest_name?: string;
          guest_phone?: string;
          guest_profile_id?: string | null;
          id?: string;
          item_count?: number;
          item_description?: string | null;
          item_type?: string | null;
          public_code?: string;
          qr_token_hash?: string;
          status?: Database["public"]["Enums"]["ticket_status"];
          storage_location?: string | null;
          updated_at?: string;
          venue_id?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
