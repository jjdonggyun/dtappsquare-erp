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
      approval_request_steps: {
        Row: {
          approval_request_id: string
          approved_at: string | null
          approver_id: string
          approver_type: string
          comment: string | null
          created_at: string
          id: string
          status: string
          step_order: number
        }
        Insert: {
          approval_request_id: string
          approved_at?: string | null
          approver_id: string
          approver_type: string
          comment?: string | null
          created_at?: string
          id?: string
          status?: string
          step_order: number
        }
        Update: {
          approval_request_id?: string
          approved_at?: string | null
          approver_id?: string
          approver_type?: string
          comment?: string | null
          created_at?: string
          id?: string
          status?: string
          step_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "approval_request_steps_approval_request_id_fkey"
            columns: ["approval_request_id"]
            isOneToOne: false
            referencedRelation: "approval_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_request_steps_approver_id_fkey"
            columns: ["approver_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_requests: {
        Row: {
          approval_subject_id: string
          created_at: string
          current_step_order: number
          id: string
          reference_id: string
          request_type: string
          requester_id: string
          route_snapshot: Json
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          approval_subject_id: string
          created_at?: string
          current_step_order?: number
          id?: string
          reference_id: string
          request_type: string
          requester_id: string
          route_snapshot: Json
          status?: string
          updated_at?: string
          version?: number
        }
        Update: {
          approval_subject_id?: string
          created_at?: string
          current_step_order?: number
          id?: string
          reference_id?: string
          request_type?: string
          requester_id?: string
          route_snapshot?: Json
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "approval_requests_approval_subject_id_fkey"
            columns: ["approval_subject_id"]
            isOneToOne: true
            referencedRelation: "approval_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_routing_policies: {
        Row: {
          active: boolean
          conditions: Json
          created_at: string
          created_by: string | null
          id: string
          request_type: string
          require_parent_approval: boolean
          updated_at: string
          version: number
        }
        Insert: {
          active?: boolean
          conditions?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          request_type: string
          require_parent_approval?: boolean
          updated_at?: string
          version: number
        }
        Update: {
          active?: boolean
          conditions?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          request_type?: string
          require_parent_approval?: boolean
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "approval_routing_policies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_subjects: {
        Row: {
          created_at: string
          id: string
          reference_id: string
          request_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          reference_id: string
          request_type: string
        }
        Update: {
          created_at?: string
          id?: string
          reference_id?: string
          request_type?: string
        }
        Relationships: []
      }
      asset_assignments: {
        Row: {
          asset_id: string
          assigned_at: string
          assigned_by: string
          created_at: string
          id: string
          memo: string | null
          return_condition: string | null
          returned_at: string | null
          returned_by: string | null
          user_id: string
        }
        Insert: {
          asset_id: string
          assigned_at?: string
          assigned_by: string
          created_at?: string
          id?: string
          memo?: string | null
          return_condition?: string | null
          returned_at?: string | null
          returned_by?: string | null
          user_id: string
        }
        Update: {
          asset_id?: string
          assigned_at?: string
          assigned_by?: string
          created_at?: string
          id?: string
          memo?: string | null
          return_condition?: string | null
          returned_at?: string | null
          returned_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_assignments_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_assignments_returned_by_fkey"
            columns: ["returned_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          archived_at: string | null
          asset_code: string
          asset_type: string
          created_at: string
          created_by: string | null
          id: string
          manufacturer: string | null
          memo: string | null
          model: string | null
          purchase_date: string | null
          serial_number: string | null
          status: string
          updated_at: string
          version: number
          warranty_end_date: string | null
        }
        Insert: {
          archived_at?: string | null
          asset_code: string
          asset_type: string
          created_at?: string
          created_by?: string | null
          id?: string
          manufacturer?: string | null
          memo?: string | null
          model?: string | null
          purchase_date?: string | null
          serial_number?: string | null
          status?: string
          updated_at?: string
          version?: number
          warranty_end_date?: string | null
        }
        Update: {
          archived_at?: string | null
          asset_code?: string
          asset_type?: string
          created_at?: string
          created_by?: string | null
          id?: string
          manufacturer?: string | null
          memo?: string | null
          model?: string | null
          purchase_date?: string | null
          serial_number?: string | null
          status?: string
          updated_at?: string
          version?: number
          warranty_end_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_corrections: {
        Row: {
          attendance_summary_id: string
          corrected_by: string
          corrected_check_in_at: string | null
          corrected_check_out_at: string | null
          created_at: string
          id: string
          reason: string
        }
        Insert: {
          attendance_summary_id: string
          corrected_by: string
          corrected_check_in_at?: string | null
          corrected_check_out_at?: string | null
          created_at?: string
          id?: string
          reason: string
        }
        Update: {
          attendance_summary_id?: string
          corrected_by?: string
          corrected_check_in_at?: string | null
          corrected_check_out_at?: string | null
          created_at?: string
          id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_corrections_attendance_summary_id_fkey"
            columns: ["attendance_summary_id"]
            isOneToOne: false
            referencedRelation: "attendance_daily_summaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_corrections_corrected_by_fkey"
            columns: ["corrected_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_daily_summaries: {
        Row: {
          attendance_status: string
          calculation_version: number
          check_in_at: string | null
          check_out_at: string | null
          created_at: string
          id: string
          last_calculated_at: string
          policy_snapshot: Json
          shift_end_at: string
          shift_start_at: string
          status_flags: string[]
          updated_at: string
          user_id: string
          version: number
          work_date: string
          work_policy_id: string
          worked_minutes: number
        }
        Insert: {
          attendance_status: string
          calculation_version?: number
          check_in_at?: string | null
          check_out_at?: string | null
          created_at?: string
          id?: string
          last_calculated_at?: string
          policy_snapshot: Json
          shift_end_at: string
          shift_start_at: string
          status_flags?: string[]
          updated_at?: string
          user_id: string
          version?: number
          work_date: string
          work_policy_id: string
          worked_minutes?: number
        }
        Update: {
          attendance_status?: string
          calculation_version?: number
          check_in_at?: string | null
          check_out_at?: string | null
          created_at?: string
          id?: string
          last_calculated_at?: string
          policy_snapshot?: Json
          shift_end_at?: string
          shift_start_at?: string
          status_flags?: string[]
          updated_at?: string
          user_id?: string
          version?: number
          work_date?: string
          work_policy_id?: string
          worked_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "attendance_daily_summaries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_daily_summaries_work_policy_id_fkey"
            columns: ["work_policy_id"]
            isOneToOne: false
            referencedRelation: "work_policies"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_device_nonces: {
        Row: {
          created_at: string
          device_id: string
          nonce: string
        }
        Insert: {
          created_at?: string
          device_id: string
          nonce: string
        }
        Update: {
          created_at?: string
          device_id?: string
          nonce?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_device_nonces_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "registered_devices"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_events: {
        Row: {
          created_at: string
          device_id: string | null
          event_type: string
          id: string
          idempotency_key: string
          ip_address: unknown
          network_policy_id: string | null
          occurred_at: string
          remote_exception_id: string | null
          user_id: string
          verification_id: string | null
          verification_status: string
          verification_type: string
          work_date: string
          work_policy_id: string
        }
        Insert: {
          created_at?: string
          device_id?: string | null
          event_type: string
          id?: string
          idempotency_key: string
          ip_address?: unknown
          network_policy_id?: string | null
          occurred_at?: string
          remote_exception_id?: string | null
          user_id: string
          verification_id?: string | null
          verification_status: string
          verification_type: string
          work_date: string
          work_policy_id: string
        }
        Update: {
          created_at?: string
          device_id?: string | null
          event_type?: string
          id?: string
          idempotency_key?: string
          ip_address?: unknown
          network_policy_id?: string | null
          occurred_at?: string
          remote_exception_id?: string | null
          user_id?: string
          verification_id?: string | null
          verification_status?: string
          verification_type?: string
          work_date?: string
          work_policy_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_events_network_policy_id_fkey"
            columns: ["network_policy_id"]
            isOneToOne: false
            referencedRelation: "attendance_network_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_events_remote_exception_id_fkey"
            columns: ["remote_exception_id"]
            isOneToOne: false
            referencedRelation: "attendance_remote_exceptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_events_verification_id_fkey"
            columns: ["verification_id"]
            isOneToOne: true
            referencedRelation: "attendance_verifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_events_work_policy_id_fkey"
            columns: ["work_policy_id"]
            isOneToOne: false
            referencedRelation: "work_policies"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_network_policies: {
        Row: {
          active: boolean
          cidr: unknown
          created_at: string
          id: string
          name: string
          updated_at: string
          version: number
        }
        Insert: {
          active?: boolean
          cidr: unknown
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          version?: number
        }
        Update: {
          active?: boolean
          cidr?: unknown
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      attendance_remote_exceptions: {
        Row: {
          active: boolean
          approval_reference: string | null
          approved_by: string
          created_at: string
          ends_on: string
          id: string
          kind: string
          reason: string
          starts_on: string
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          active?: boolean
          approval_reference?: string | null
          approved_by: string
          created_at?: string
          ends_on: string
          id?: string
          kind: string
          reason: string
          starts_on: string
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          active?: boolean
          approval_reference?: string | null
          approved_by?: string
          created_at?: string
          ends_on?: string
          id?: string
          kind?: string
          reason?: string
          starts_on?: string
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "attendance_remote_exceptions_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_remote_exceptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_verifications: {
        Row: {
          client_ip: unknown
          consumed_at: string | null
          created_at: string
          device_id: string | null
          device_status: string
          device_token_version: number | null
          event_type: string
          expires_at: string
          id: string
          mode: string
          network_policy_id: string | null
          network_status: string
          reason_code: string | null
          remote_exception_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          client_ip?: unknown
          consumed_at?: string | null
          created_at?: string
          device_id?: string | null
          device_status?: string
          device_token_version?: number | null
          event_type: string
          expires_at: string
          id?: string
          mode: string
          network_policy_id?: string | null
          network_status: string
          reason_code?: string | null
          remote_exception_id?: string | null
          status?: string
          user_id: string
        }
        Update: {
          client_ip?: unknown
          consumed_at?: string | null
          created_at?: string
          device_id?: string | null
          device_status?: string
          device_token_version?: number | null
          event_type?: string
          expires_at?: string
          id?: string
          mode?: string
          network_policy_id?: string | null
          network_status?: string
          reason_code?: string | null
          remote_exception_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_verifications_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "registered_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_verifications_network_policy_id_fkey"
            columns: ["network_policy_id"]
            isOneToOne: false
            referencedRelation: "attendance_network_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_verifications_remote_exception_id_fkey"
            columns: ["remote_exception_id"]
            isOneToOne: false
            referencedRelation: "attendance_remote_exceptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_verifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          after_data: Json | null
          before_data: Json | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          ip_address: unknown
          request_id: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          ip_address?: unknown
          request_id?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          ip_address?: unknown
          request_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_schedules: {
        Row: {
          billing_condition: string
          contract_id: string
          created_at: string
          created_by: string
          id: string
          note: string
          project_id: string
          scheduled_date: string
          sequence_no: number
          status: string
          supply_amount: number
          title: string
          total_amount: number
          updated_at: string
          updated_by: string
          vat_amount: number
          vat_rate: number
          version: number
        }
        Insert: {
          billing_condition?: string
          contract_id: string
          created_at?: string
          created_by: string
          id?: string
          note?: string
          project_id: string
          scheduled_date: string
          sequence_no: number
          status?: string
          supply_amount: number
          title: string
          total_amount?: number
          updated_at?: string
          updated_by: string
          vat_amount?: number
          vat_rate?: number
          version?: number
        }
        Update: {
          billing_condition?: string
          contract_id?: string
          created_at?: string
          created_by?: string
          id?: string
          note?: string
          project_id?: string
          scheduled_date?: string
          sequence_no?: number
          status?: string
          supply_amount?: number
          title?: string
          total_amount?: number
          updated_at?: string
          updated_by?: string
          vat_amount?: number
          vat_rate?: number
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "billing_schedules_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_schedules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_schedules_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_schedules_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      billings: {
        Row: {
          bank_account_id: string | null
          billing_date: string
          billing_number: string
          canceled_at: string | null
          contract_id: string
          created_at: string
          created_by: string
          customer_id: string
          due_date: string
          id: string
          issued_at: string | null
          note: string
          project_id: string
          schedule_id: string | null
          status: string
          supply_amount: number
          title: string
          total_amount: number
          updated_at: string
          updated_by: string
          vat_amount: number
          vat_rate: number
          version: number
        }
        Insert: {
          bank_account_id?: string | null
          billing_date: string
          billing_number?: string
          canceled_at?: string | null
          contract_id: string
          created_at?: string
          created_by: string
          customer_id: string
          due_date: string
          id?: string
          issued_at?: string | null
          note?: string
          project_id: string
          schedule_id?: string | null
          status?: string
          supply_amount: number
          title: string
          total_amount?: number
          updated_at?: string
          updated_by: string
          vat_amount?: number
          vat_rate?: number
          version?: number
        }
        Update: {
          bank_account_id?: string | null
          billing_date?: string
          billing_number?: string
          canceled_at?: string | null
          contract_id?: string
          created_at?: string
          created_by?: string
          customer_id?: string
          due_date?: string
          id?: string
          issued_at?: string | null
          note?: string
          project_id?: string
          schedule_id?: string | null
          status?: string
          supply_amount?: number
          title?: string
          total_amount?: number
          updated_at?: string
          updated_by?: string
          vat_amount?: number
          vat_rate?: number
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "billings_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "company_bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billings_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billings_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: true
            referencedRelation: "billing_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      company_bank_accounts: {
        Row: {
          account_holder: string
          account_number: string
          active: boolean
          bank_name: string
          created_at: string
          created_by: string
          id: string
          is_default: boolean
          note: string
          purpose: string
          updated_at: string
          updated_by: string
          version: number
        }
        Insert: {
          account_holder: string
          account_number: string
          active?: boolean
          bank_name: string
          created_at?: string
          created_by: string
          id?: string
          is_default?: boolean
          note?: string
          purpose?: string
          updated_at?: string
          updated_by: string
          version?: number
        }
        Update: {
          account_holder?: string
          account_number?: string
          active?: boolean
          bank_name?: string
          created_at?: string
          created_by?: string
          id?: string
          is_default?: boolean
          note?: string
          purpose?: string
          updated_at?: string
          updated_by?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "company_bank_accounts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_bank_accounts_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      company_settings: {
        Row: {
          created_at: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
          version: number
        }
        Insert: {
          created_at?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
          version?: number
        }
        Update: {
          created_at?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "company_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      company_tax_profiles: {
        Row: {
          address: string
          business_item: string
          business_registration_number: string
          business_type: string
          company_name: string
          created_at: string
          email: string | null
          id: string
          phone: string
          representative_name: string
          updated_at: string
          updated_by: string
          version: number
        }
        Insert: {
          address: string
          business_item: string
          business_registration_number: string
          business_type: string
          company_name: string
          created_at?: string
          email?: string | null
          id?: string
          phone?: string
          representative_name: string
          updated_at?: string
          updated_by: string
          version?: number
        }
        Update: {
          address?: string
          business_item?: string
          business_registration_number?: string
          business_type?: string
          company_name?: string
          created_at?: string
          email?: string | null
          id?: string
          phone?: string
          representative_name?: string
          updated_at?: string
          updated_by?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "company_tax_profiles_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_amendments: {
        Row: {
          amendment_no: number
          contract_id: string
          created_at: string
          created_by: string
          id: string
          reason: string
          snapshot: Json
        }
        Insert: {
          amendment_no: number
          contract_id: string
          created_at?: string
          created_by: string
          id?: string
          reason?: string
          snapshot: Json
        }
        Update: {
          amendment_no?: number
          contract_id?: string
          created_at?: string
          created_by?: string
          id?: string
          reason?: string
          snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "contract_amendments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_amendments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_command_receipts: {
        Row: {
          action: string
          actor_user_id: string
          created_at: string
          payload_hash: string
          request_id: string
          result: Json
        }
        Insert: {
          action: string
          actor_user_id: string
          created_at?: string
          payload_hash: string
          request_id: string
          result: Json
        }
        Update: {
          action?: string
          actor_user_id?: string
          created_at?: string
          payload_hash?: string
          request_id?: string
          result?: Json
        }
        Relationships: [
          {
            foreignKeyName: "contract_command_receipts_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_document_links: {
        Row: {
          contract_id: string
          created_at: string
          document_id: string
        }
        Insert: {
          contract_id: string
          created_at?: string
          document_id: string
        }
        Update: {
          contract_id?: string
          created_at?: string
          document_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_document_links_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_document_links_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          approval_subject_id: string | null
          contract_date: string
          contract_name: string
          contract_number: string
          created_at: string
          created_by: string
          current_amendment_no: number
          customer_id: string
          end_date: string
          id: string
          note: string
          opportunity_id: string
          payment_terms: string
          purchase_order_number: string
          quotation_revision_id: string
          signed_date: string | null
          start_date: string
          status: string
          supply_amount: number
          total_amount: number
          updated_at: string
          updated_by: string
          vat_amount: number
          vat_rate: number
          version: number
          warranty_terms: string
        }
        Insert: {
          approval_subject_id?: string | null
          contract_date: string
          contract_name: string
          contract_number?: string
          created_at?: string
          created_by: string
          current_amendment_no?: number
          customer_id: string
          end_date: string
          id?: string
          note?: string
          opportunity_id: string
          payment_terms?: string
          purchase_order_number?: string
          quotation_revision_id: string
          signed_date?: string | null
          start_date: string
          status?: string
          supply_amount: number
          total_amount?: number
          updated_at?: string
          updated_by: string
          vat_amount?: number
          vat_rate?: number
          version?: number
          warranty_terms?: string
        }
        Update: {
          approval_subject_id?: string | null
          contract_date?: string
          contract_name?: string
          contract_number?: string
          created_at?: string
          created_by?: string
          current_amendment_no?: number
          customer_id?: string
          end_date?: string
          id?: string
          note?: string
          opportunity_id?: string
          payment_terms?: string
          purchase_order_number?: string
          quotation_revision_id?: string
          signed_date?: string | null
          start_date?: string
          status?: string
          supply_amount?: number
          total_amount?: number
          updated_at?: string
          updated_by?: string
          vat_amount?: number
          vat_rate?: number
          version?: number
          warranty_terms?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_approval_subject_id_fkey"
            columns: ["approval_subject_id"]
            isOneToOne: true
            referencedRelation: "approval_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_quotation_revision_id_fkey"
            columns: ["quotation_revision_id"]
            isOneToOne: true
            referencedRelation: "quotation_revisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      corporate_cards: {
        Row: {
          card_company: string
          card_name: string
          created_at: string
          id: string
          identifier: string
          last_four: string
          memo: string
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          card_company: string
          card_name: string
          created_at?: string
          id?: string
          identifier: string
          last_four: string
          memo?: string
          status?: string
          updated_at?: string
          version?: number
        }
        Update: {
          card_company?: string
          card_name?: string
          created_at?: string
          id?: string
          identifier?: string
          last_four?: string
          memo?: string
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      customer_command_receipts: {
        Row: {
          action: string
          actor_user_id: string
          created_at: string
          payload_hash: string
          request_id: string
          result: Json
        }
        Insert: {
          action: string
          actor_user_id: string
          created_at?: string
          payload_hash: string
          request_id: string
          result: Json
        }
        Update: {
          action?: string
          actor_user_id?: string
          created_at?: string
          payload_hash?: string
          request_id?: string
          result?: Json
        }
        Relationships: [
          {
            foreignKeyName: "customer_command_receipts_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_contacts: {
        Row: {
          active: boolean
          contact_type: string
          created_at: string
          created_by: string
          customer_id: string
          department: string
          email: string | null
          id: string
          is_primary: boolean
          name: string
          phone: string
          position: string
          updated_at: string
          updated_by: string
          version: number
        }
        Insert: {
          active?: boolean
          contact_type?: string
          created_at?: string
          created_by: string
          customer_id: string
          department?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          name: string
          phone?: string
          position?: string
          updated_at?: string
          updated_by: string
          version?: number
        }
        Update: {
          active?: boolean
          contact_type?: string
          created_at?: string
          created_by?: string
          customer_id?: string
          department?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          name?: string
          phone?: string
          position?: string
          updated_at?: string
          updated_by?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "customer_contacts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_contacts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_contacts_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_document_links: {
        Row: {
          created_at: string
          customer_id: string
          document_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          document_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          document_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_document_links_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_document_links_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string
          archived_at: string | null
          billing_contact_name: string
          billing_email: string | null
          business_item: string
          business_registration_number: string | null
          business_type: string
          created_at: string
          created_by: string
          customer_code: string
          default_payment_terms: string
          id: string
          name: string
          note: string
          payment_terms: string
          representative_name: string | null
          status: string
          updated_at: string
          updated_by: string
          version: number
        }
        Insert: {
          address?: string
          archived_at?: string | null
          billing_contact_name?: string
          billing_email?: string | null
          business_item?: string
          business_registration_number?: string | null
          business_type?: string
          created_at?: string
          created_by: string
          customer_code: string
          default_payment_terms?: string
          id?: string
          name: string
          note?: string
          payment_terms?: string
          representative_name?: string | null
          status?: string
          updated_at?: string
          updated_by: string
          version?: number
        }
        Update: {
          address?: string
          archived_at?: string | null
          billing_contact_name?: string
          billing_email?: string | null
          business_item?: string
          business_registration_number?: string | null
          business_type?: string
          created_at?: string
          created_by?: string
          customer_code?: string
          default_payment_terms?: string
          id?: string
          name?: string
          note?: string
          payment_terms?: string
          representative_name?: string | null
          status?: string
          updated_at?: string
          updated_by?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "customers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_work_logs: {
        Row: {
          blocker: string | null
          created_at: string
          deleted_at: string | null
          description: string
          end_time: string | null
          id: string
          memo: string | null
          progress: number | null
          project_id: string | null
          project_task_id: string | null
          start_time: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
          version: number
          work_category: string
          work_date: string
          work_minutes: number
        }
        Insert: {
          blocker?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string
          end_time?: string | null
          id?: string
          memo?: string | null
          progress?: number | null
          project_id?: string | null
          project_task_id?: string | null
          start_time?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
          version?: number
          work_category: string
          work_date: string
          work_minutes: number
        }
        Update: {
          blocker?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string
          end_time?: string | null
          id?: string
          memo?: string | null
          progress?: number | null
          project_id?: string | null
          project_task_id?: string | null
          start_time?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
          version?: number
          work_category?: string
          work_date?: string
          work_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "daily_work_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_work_logs_project_task_id_fkey"
            columns: ["project_task_id"]
            isOneToOne: false
            referencedRelation: "project_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_work_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          archived_at: string | null
          category: string
          created_at: string
          document_version: number
          file_name: string
          id: string
          mime_type: string
          previous_document_id: string | null
          sha256: string
          size_bytes: number
          storage_key: string
          title: string
          uploaded_by: string
        }
        Insert: {
          archived_at?: string | null
          category: string
          created_at?: string
          document_version?: number
          file_name: string
          id?: string
          mime_type: string
          previous_document_id?: string | null
          sha256: string
          size_bytes: number
          storage_key: string
          title: string
          uploaded_by: string
        }
        Update: {
          archived_at?: string | null
          category?: string
          created_at?: string
          document_version?: number
          file_name?: string
          id?: string
          mime_type?: string
          previous_document_id?: string | null
          sha256?: string
          size_bytes?: number
          storage_key?: string
          title?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_previous_document_id_fkey"
            columns: ["previous_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      email_delivery_attempts: {
        Row: {
          attempt: number
          attempted_at: string
          error_code: string | null
          id: string
          outbox_id: string
          provider: string
          provider_message_id: string | null
          status: string
        }
        Insert: {
          attempt: number
          attempted_at?: string
          error_code?: string | null
          id?: string
          outbox_id: string
          provider: string
          provider_message_id?: string | null
          status: string
        }
        Update: {
          attempt?: number
          attempted_at?: string
          error_code?: string | null
          id?: string
          outbox_id?: string
          provider?: string
          provider_message_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_delivery_attempts_outbox_id_fkey"
            columns: ["outbox_id"]
            isOneToOne: false
            referencedRelation: "notification_outbox"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_cost_rates: {
        Row: {
          created_at: string
          created_by: string
          effective_from: string
          effective_to: string | null
          id: string
          monthly_cost_rate: number
          note: string
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          created_at?: string
          created_by: string
          effective_from: string
          effective_to?: string | null
          id?: string
          monthly_cost_rate: number
          note?: string
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          monthly_cost_rate?: number
          note?: string
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "employee_cost_rates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_cost_rates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_skills: {
        Row: {
          active: boolean
          created_at: string
          id: string
          last_used_date: string | null
          level: string | null
          memo: string
          skill_id: string
          updated_at: string
          user_id: string
          version: number
          years_experience: number | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          last_used_date?: string | null
          level?: string | null
          memo?: string
          skill_id: string
          updated_at?: string
          user_id: string
          version?: number
          years_experience?: number | null
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          last_used_date?: string | null
          level?: string | null
          memo?: string
          skill_id?: string
          updated_at?: string
          user_id?: string
          version?: number
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_skills_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          created_at: string
          email: string
          employee_number: string | null
          employment_type: string
          id: string
          join_date: string | null
          name: string
          organization_id: string | null
          phone: string | null
          position_id: string | null
          profile_image: string | null
          resignation_date: string | null
          title_id: string | null
          updated_at: string
          user_status: string
          version: number
        }
        Insert: {
          created_at?: string
          email: string
          employee_number?: string | null
          employment_type?: string
          id: string
          join_date?: string | null
          name: string
          organization_id?: string | null
          phone?: string | null
          position_id?: string | null
          profile_image?: string | null
          resignation_date?: string | null
          title_id?: string | null
          updated_at?: string
          user_status?: string
          version?: number
        }
        Update: {
          created_at?: string
          email?: string
          employee_number?: string | null
          employment_type?: string
          id?: string
          join_date?: string | null
          name?: string
          organization_id?: string | null
          phone?: string | null
          position_id?: string | null
          profile_image?: string | null
          resignation_date?: string | null
          title_id?: string | null
          updated_at?: string
          user_status?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "employees_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "titles"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_finance_command_receipts: {
        Row: {
          action: string
          actor_user_id: string
          created_at: string
          payload_hash: string
          request_id: string
          result: Json
        }
        Insert: {
          action: string
          actor_user_id: string
          created_at?: string
          payload_hash: string
          request_id: string
          result: Json
        }
        Update: {
          action?: string
          actor_user_id?: string
          created_at?: string
          payload_hash?: string
          request_id?: string
          result?: Json
        }
        Relationships: [
          {
            foreignKeyName: "expense_finance_command_receipts_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_types: {
        Row: {
          account_code: string
          active: boolean
          code: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          note: string
          sort_order: number
          updated_at: string
          updated_by: string | null
          vat_deductible: boolean
          version: number
        }
        Insert: {
          account_code?: string
          active?: boolean
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          note?: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
          vat_deductible?: boolean
          version?: number
        }
        Update: {
          account_code?: string
          active?: boolean
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          note?: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
          vat_deductible?: boolean
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "expense_types_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_types_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          approval_status: string
          category: string
          corporate_card_id: string | null
          created_at: string
          deleted_at: string | null
          expense_type_id: string | null
          id: string
          memo: string
          merchant: string
          paid_at: string | null
          payment_reference: string
          project_id: string
          purpose: string
          receipt_key: string | null
          rejection_reason: string
          reviewed_at: string | null
          reviewed_by: string | null
          settlement_status: string
          source_type: string
          submitted_at: string | null
          supply_amount: number
          total_amount: number | null
          transaction_date: string
          updated_at: string
          user_id: string
          vat_amount: number
          vat_deductible_snapshot: boolean
          vendor_id: string | null
          version: number
        }
        Insert: {
          approval_status?: string
          category: string
          corporate_card_id?: string | null
          created_at?: string
          deleted_at?: string | null
          expense_type_id?: string | null
          id?: string
          memo?: string
          merchant: string
          paid_at?: string | null
          payment_reference?: string
          project_id: string
          purpose: string
          receipt_key?: string | null
          rejection_reason?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          settlement_status?: string
          source_type?: string
          submitted_at?: string | null
          supply_amount: number
          total_amount?: number | null
          transaction_date: string
          updated_at?: string
          user_id: string
          vat_amount: number
          vat_deductible_snapshot?: boolean
          vendor_id?: string | null
          version?: number
        }
        Update: {
          approval_status?: string
          category?: string
          corporate_card_id?: string | null
          created_at?: string
          deleted_at?: string | null
          expense_type_id?: string | null
          id?: string
          memo?: string
          merchant?: string
          paid_at?: string | null
          payment_reference?: string
          project_id?: string
          purpose?: string
          receipt_key?: string | null
          rejection_reason?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          settlement_status?: string
          source_type?: string
          submitted_at?: string | null
          supply_amount?: number
          total_amount?: number | null
          transaction_date?: string
          updated_at?: string
          user_id?: string
          vat_amount?: number
          vat_deductible_snapshot?: boolean
          vendor_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "expenses_corporate_card_id_fkey"
            columns: ["corporate_card_id"]
            isOneToOne: false
            referencedRelation: "corporate_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_expense_type_id_fkey"
            columns: ["expense_type_id"]
            isOneToOne: false
            referencedRelation: "expense_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_command_receipts: {
        Row: {
          action: string
          actor_user_id: string
          created_at: string
          payload_hash: string
          request_id: string
          result: Json
        }
        Insert: {
          action: string
          actor_user_id: string
          created_at?: string
          payload_hash: string
          request_id: string
          result: Json
        }
        Update: {
          action?: string
          actor_user_id?: string
          created_at?: string
          payload_hash?: string
          request_id?: string
          result?: Json
        }
        Relationships: [
          {
            foreignKeyName: "finance_command_receipts_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      inspections: {
        Row: {
          completed_date: string | null
          created_at: string
          created_by: string
          customer_contact_email: string
          customer_contact_name: string
          document_id: string | null
          id: string
          inspection_type: string
          milestone_id: string | null
          note: string
          project_id: string
          requested_date: string | null
          result: string
          scheduled_date: string | null
          status: string
          title: string
          updated_at: string
          updated_by: string
          version: number
        }
        Insert: {
          completed_date?: string | null
          created_at?: string
          created_by: string
          customer_contact_email?: string
          customer_contact_name?: string
          document_id?: string | null
          id?: string
          inspection_type?: string
          milestone_id?: string | null
          note?: string
          project_id: string
          requested_date?: string | null
          result?: string
          scheduled_date?: string | null
          status?: string
          title: string
          updated_at?: string
          updated_by: string
          version?: number
        }
        Update: {
          completed_date?: string | null
          created_at?: string
          created_by?: string
          customer_contact_email?: string
          customer_contact_name?: string
          document_id?: string | null
          id?: string
          inspection_type?: string
          milestone_id?: string | null
          note?: string
          project_id?: string
          requested_date?: string | null
          result?: string
          scheduled_date?: string | null
          status?: string
          title?: string
          updated_at?: string
          updated_by?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "inspections_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "project_milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_balance_entries: {
        Row: {
          amount: number
          created_at: string
          created_by: string
          entry_type: string
          event_key: string
          id: string
          leave_request_id: string | null
          leave_type: string
          memo: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by: string
          entry_type: string
          event_key: string
          id?: string
          leave_request_id?: string | null
          leave_type: string
          memo?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string
          entry_type?: string
          event_key?: string
          id?: string
          leave_request_id?: string | null
          leave_type?: string
          memo?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_balance_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_balance_entries_leave_request_id_fkey"
            columns: ["leave_request_id"]
            isOneToOne: false
            referencedRelation: "leave_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_balance_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          approval_subject_id: string | null
          created_at: string
          duration: number
          end_date: string
          id: string
          leave_type: string
          reason: string
          start_date: string
          status: string
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          approval_subject_id?: string | null
          created_at?: string
          duration: number
          end_date: string
          id?: string
          leave_type: string
          reason: string
          start_date: string
          status?: string
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          approval_subject_id?: string | null
          created_at?: string
          duration?: number
          end_date?: string
          id?: string
          leave_type?: string
          reason?: string
          start_date?: string
          status?: string
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_approval_subject_id_fkey"
            columns: ["approval_subject_id"]
            isOneToOne: true
            referencedRelation: "approval_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_card_reports: {
        Row: {
          checksum: string | null
          created_at: string
          entries_snapshot: Json
          file_key: string | null
          generated_at: string
          generated_by: string | null
          id: string
          send_generation: number
          sent_at: string | null
          settlement_month: string
          status: string
          total_amount: number
          total_count: number
          total_supply_amount: number
          total_vat_amount: number
          updated_at: string
          version: number
        }
        Insert: {
          checksum?: string | null
          created_at?: string
          entries_snapshot?: Json
          file_key?: string | null
          generated_at?: string
          generated_by?: string | null
          id?: string
          send_generation?: number
          sent_at?: string | null
          settlement_month: string
          status?: string
          total_amount?: number
          total_count?: number
          total_supply_amount?: number
          total_vat_amount?: number
          updated_at?: string
          version?: number
        }
        Update: {
          checksum?: string | null
          created_at?: string
          entries_snapshot?: Json
          file_key?: string | null
          generated_at?: string
          generated_by?: string | null
          id?: string
          send_generation?: number
          sent_at?: string | null
          settlement_month?: string
          status?: string
          total_amount?: number
          total_count?: number
          total_supply_amount?: number
          total_vat_amount?: number
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "monthly_card_reports_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_outbox: {
        Row: {
          attempt_count: number
          created_at: string
          event_key: string
          id: string
          last_error_code: string | null
          lease_until: string | null
          max_attempts: number
          monthly_card_report_id: string | null
          next_attempt_at: string
          notification_id: string | null
          payload: Json
          provider_message_id: string | null
          recipient_email: string
          recipient_user_id: string | null
          status: string
          template: string
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          event_key: string
          id?: string
          last_error_code?: string | null
          lease_until?: string | null
          max_attempts?: number
          monthly_card_report_id?: string | null
          next_attempt_at?: string
          notification_id?: string | null
          payload: Json
          provider_message_id?: string | null
          recipient_email: string
          recipient_user_id?: string | null
          status?: string
          template: string
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          created_at?: string
          event_key?: string
          id?: string
          last_error_code?: string | null
          lease_until?: string | null
          max_attempts?: number
          monthly_card_report_id?: string | null
          next_attempt_at?: string
          notification_id?: string | null
          payload?: Json
          provider_message_id?: string | null
          recipient_email?: string
          recipient_user_id?: string | null
          status?: string
          template?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_outbox_monthly_card_report_id_fkey"
            columns: ["monthly_card_report_id"]
            isOneToOne: false
            referencedRelation: "monthly_card_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_outbox_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: true
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_outbox_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          event_key: string
          id: string
          message: string
          read_at: string | null
          reference_id: string
          reference_type: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_key: string
          id?: string
          message: string
          read_at?: string | null
          reference_id: string
          reference_type: string
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_key?: string
          id?: string
          message?: string
          read_at?: string | null
          reference_id?: string
          reference_type?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      operational_alert_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_code: string | null
          id: string
          notification_count: number
          overdue_billing_count: number
          run_date: string
          schedule_due_count: number
          started_at: string
          status: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_code?: string | null
          id?: string
          notification_count?: number
          overdue_billing_count?: number
          run_date: string
          schedule_due_count?: number
          started_at?: string
          status: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_code?: string | null
          id?: string
          notification_count?: number
          overdue_billing_count?: number
          run_date?: string
          schedule_due_count?: number
          started_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      opportunities: {
        Row: {
          archived_at: string | null
          closed_at: string | null
          competitor: string
          created_at: string
          created_by: string
          customer_id: string
          expected_amount: number
          expected_end_date: string | null
          expected_project_name: string
          expected_revenue: number | null
          expected_start_date: string | null
          id: string
          lost_reason: string
          note: string
          opportunity_code: string
          probability: number
          proposal_due_date: string | null
          sales_owner_id: string
          stage: string
          title: string
          updated_at: string
          updated_by: string
          version: number
        }
        Insert: {
          archived_at?: string | null
          closed_at?: string | null
          competitor?: string
          created_at?: string
          created_by: string
          customer_id: string
          expected_amount?: number
          expected_end_date?: string | null
          expected_project_name?: string
          expected_revenue?: number | null
          expected_start_date?: string | null
          id?: string
          lost_reason?: string
          note?: string
          opportunity_code?: string
          probability?: number
          proposal_due_date?: string | null
          sales_owner_id: string
          stage?: string
          title: string
          updated_at?: string
          updated_by: string
          version?: number
        }
        Update: {
          archived_at?: string | null
          closed_at?: string | null
          competitor?: string
          created_at?: string
          created_by?: string
          customer_id?: string
          expected_amount?: number
          expected_end_date?: string | null
          expected_project_name?: string
          expected_revenue?: number | null
          expected_start_date?: string | null
          id?: string
          lost_reason?: string
          note?: string
          opportunity_code?: string
          probability?: number
          proposal_due_date?: string | null
          sales_owner_id?: string
          stage?: string
          title?: string
          updated_at?: string
          updated_by?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_sales_owner_id_fkey"
            columns: ["sales_owner_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          active: boolean
          code: string | null
          created_at: string
          id: string
          leader_user_id: string | null
          name: string
          organization_type: string
          parent_id: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          code?: string | null
          created_at?: string
          id?: string
          leader_user_id?: string | null
          name: string
          organization_type: string
          parent_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string | null
          created_at?: string
          id?: string
          leader_user_id?: string | null
          name?: string
          organization_type?: string
          parent_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizations_leader_fk"
            columns: ["leader_user_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizations_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_allocations: {
        Row: {
          amount: number
          billing_id: string
          created_at: string
          created_by: string
          id: string
          payment_id: string
        }
        Insert: {
          amount: number
          billing_id: string
          created_at?: string
          created_by: string
          id?: string
          payment_id: string
        }
        Update: {
          amount?: number
          billing_id?: string
          created_at?: string
          created_by?: string
          id?: string
          payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_allocations_billing_id_fkey"
            columns: ["billing_id"]
            isOneToOne: false
            referencedRelation: "billings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          bank_account_id: string | null
          bank_reference: string
          canceled_at: string | null
          created_at: string
          created_by: string
          customer_id: string
          id: string
          note: string
          payer_name: string
          payment_number: string
          project_id: string | null
          received_date: string
          status: string
          updated_at: string
          updated_by: string
          version: number
        }
        Insert: {
          amount: number
          bank_account_id?: string | null
          bank_reference?: string
          canceled_at?: string | null
          created_at?: string
          created_by: string
          customer_id: string
          id?: string
          note?: string
          payer_name: string
          payment_number?: string
          project_id?: string | null
          received_date: string
          status?: string
          updated_at?: string
          updated_by: string
          version?: number
        }
        Update: {
          amount?: number
          bank_account_id?: string | null
          bank_reference?: string
          canceled_at?: string | null
          created_at?: string
          created_by?: string
          customer_id?: string
          id?: string
          note?: string
          payer_name?: string
          payment_number?: string
          project_id?: string | null
          received_date?: string
          status?: string
          updated_at?: string
          updated_by?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "payments_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "company_bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          code: string
          description: string
          id: string
        }
        Insert: {
          code: string
          description: string
          id?: string
        }
        Update: {
          code?: string
          description?: string
          id?: string
        }
        Relationships: []
      }
      positions: {
        Row: {
          active: boolean
          code: string
          created_at: string
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      project_assignment_rates: {
        Row: {
          assignment_id: string
          created_at: string
          created_by: string
          id: string
          monthly_billing_rate: number
          monthly_cost_rate: number
          planned_mm: number
          reason: string
          snapshot_no: number
          source_employee_cost_rate_id: string | null
        }
        Insert: {
          assignment_id: string
          created_at?: string
          created_by: string
          id?: string
          monthly_billing_rate: number
          monthly_cost_rate: number
          planned_mm: number
          reason?: string
          snapshot_no: number
          source_employee_cost_rate_id?: string | null
        }
        Update: {
          assignment_id?: string
          created_at?: string
          created_by?: string
          id?: string
          monthly_billing_rate?: number
          monthly_cost_rate?: number
          planned_mm?: number
          reason?: string
          snapshot_no?: number
          source_employee_cost_rate_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_assignment_rates_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "project_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_assignment_rates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_assignment_rates_source_employee_cost_rate_id_fkey"
            columns: ["source_employee_cost_rate_id"]
            isOneToOne: false
            referencedRelation: "employee_cost_rates"
            referencedColumns: ["id"]
          },
        ]
      }
      project_assignments: {
        Row: {
          actual_end_date: string | null
          actual_start_date: string | null
          allocation_rate: number
          assigned_by: string
          created_at: string
          id: string
          memo: string | null
          planned_end_date: string
          planned_mm: number | null
          planned_start_date: string
          project_id: string
          project_role: string
          status: string
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          actual_end_date?: string | null
          actual_start_date?: string | null
          allocation_rate: number
          assigned_by: string
          created_at?: string
          id?: string
          memo?: string | null
          planned_end_date: string
          planned_mm?: number | null
          planned_start_date: string
          project_id: string
          project_role: string
          status?: string
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          actual_end_date?: string | null
          actual_start_date?: string | null
          allocation_rate?: number
          assigned_by?: string
          created_at?: string
          id?: string
          memo?: string | null
          planned_end_date?: string
          planned_mm?: number | null
          planned_start_date?: string
          project_id?: string
          project_role?: string
          status?: string
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      project_card_assignments: {
        Row: {
          assigned_from: string
          assigned_to: string | null
          corporate_card_id: string
          created_at: string
          id: string
          memo: string
          project_id: string
          responsible_user_id: string
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          assigned_from: string
          assigned_to?: string | null
          corporate_card_id: string
          created_at?: string
          id?: string
          memo?: string
          project_id: string
          responsible_user_id: string
          status?: string
          updated_at?: string
          version?: number
        }
        Update: {
          assigned_from?: string
          assigned_to?: string | null
          corporate_card_id?: string
          created_at?: string
          id?: string
          memo?: string
          project_id?: string
          responsible_user_id?: string
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_card_assignments_corporate_card_id_fkey"
            columns: ["corporate_card_id"]
            isOneToOne: false
            referencedRelation: "corporate_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_card_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_card_assignments_responsible_user_id_fkey"
            columns: ["responsible_user_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      project_closings: {
        Row: {
          approval_request_id: string | null
          as_of_date: string
          checklist_snapshot: Json
          closed_at: string
          closed_by: string
          closing_no: number
          created_at: string
          financial_snapshot: Json
          id: string
          note: string
          project_id: string
          reopen_reason: string
          reopened_at: string | null
          reopened_by: string | null
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          approval_request_id?: string | null
          as_of_date: string
          checklist_snapshot: Json
          closed_at?: string
          closed_by: string
          closing_no: number
          created_at?: string
          financial_snapshot: Json
          id?: string
          note?: string
          project_id: string
          reopen_reason?: string
          reopened_at?: string | null
          reopened_by?: string | null
          status?: string
          updated_at?: string
          version?: number
        }
        Update: {
          approval_request_id?: string | null
          as_of_date?: string
          checklist_snapshot?: Json
          closed_at?: string
          closed_by?: string
          closing_no?: number
          created_at?: string
          financial_snapshot?: Json
          id?: string
          note?: string
          project_id?: string
          reopen_reason?: string
          reopened_at?: string | null
          reopened_by?: string | null
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_closings_approval_request_id_fkey"
            columns: ["approval_request_id"]
            isOneToOne: false
            referencedRelation: "approval_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_closings_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_closings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_closings_reopened_by_fkey"
            columns: ["reopened_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      project_document_links: {
        Row: {
          created_at: string
          document_id: string
          project_id: string
        }
        Insert: {
          created_at?: string
          document_id: string
          project_id: string
        }
        Update: {
          created_at?: string
          document_id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_document_links_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_document_links_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_hub_command_receipts: {
        Row: {
          action: string
          actor_user_id: string
          created_at: string
          payload_hash: string
          request_id: string
          result: Json
        }
        Insert: {
          action: string
          actor_user_id: string
          created_at?: string
          payload_hash: string
          request_id: string
          result: Json
        }
        Update: {
          action?: string
          actor_user_id?: string
          created_at?: string
          payload_hash?: string
          request_id?: string
          result?: Json
        }
        Relationships: [
          {
            foreignKeyName: "project_hub_command_receipts_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      project_issues: {
        Row: {
          assignee_id: string | null
          created_at: string
          description: string
          id: string
          kind: string
          priority: string
          project_id: string
          resolved_date: string | null
          status: string
          target_date: string | null
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          assignee_id?: string | null
          created_at?: string
          description?: string
          id?: string
          kind: string
          priority?: string
          project_id: string
          resolved_date?: string | null
          status?: string
          target_date?: string | null
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          assignee_id?: string | null
          created_at?: string
          description?: string
          id?: string
          kind?: string
          priority?: string
          project_id?: string
          resolved_date?: string | null
          status?: string
          target_date?: string | null
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_issues_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_issues_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_milestones: {
        Row: {
          completed_date: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          planned_date: string
          project_id: string
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          completed_date?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          planned_date: string
          project_id: string
          status?: string
          updated_at?: string
          version?: number
        }
        Update: {
          completed_date?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          planned_date?: string
          project_id?: string
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_milestones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_staffing_fulfillments: {
        Row: {
          active: boolean
          created_at: string
          id: string
          project_assignment_id: string
          requirement_id: string
          updated_at: string
          version: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          project_assignment_id: string
          requirement_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          project_assignment_id?: string
          requirement_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_staffing_fulfillments_project_assignment_id_fkey"
            columns: ["project_assignment_id"]
            isOneToOne: false
            referencedRelation: "project_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_staffing_fulfillments_requirement_id_fkey"
            columns: ["requirement_id"]
            isOneToOne: false
            referencedRelation: "project_staffing_requirements"
            referencedColumns: ["id"]
          },
        ]
      }
      project_staffing_requirement_skills: {
        Row: {
          active: boolean
          created_at: string
          id: string
          preference: string
          requirement_id: string
          skill_id: string
          target_level: string | null
          updated_at: string
          version: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          preference: string
          requirement_id: string
          skill_id: string
          target_level?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          preference?: string
          requirement_id?: string
          skill_id?: string
          target_level?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_staffing_requirement_skills_requirement_id_fkey"
            columns: ["requirement_id"]
            isOneToOne: false
            referencedRelation: "project_staffing_requirements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_staffing_requirement_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      project_staffing_requirements: {
        Row: {
          allocation_rate: number
          created_at: string
          description: string
          id: string
          lifecycle_status: string
          planned_end_date: string
          planned_start_date: string
          project_id: string
          required_headcount: number
          role_name: string
          updated_at: string
          version: number
        }
        Insert: {
          allocation_rate: number
          created_at?: string
          description?: string
          id?: string
          lifecycle_status?: string
          planned_end_date: string
          planned_start_date: string
          project_id: string
          required_headcount: number
          role_name: string
          updated_at?: string
          version?: number
        }
        Update: {
          allocation_rate?: number
          created_at?: string
          description?: string
          id?: string
          lifecycle_status?: string
          planned_end_date?: string
          planned_start_date?: string
          project_id?: string
          required_headcount?: number
          role_name?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_staffing_requirements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_tasks: {
        Row: {
          actual_end_date: string | null
          actual_start_date: string | null
          assignee_id: string | null
          created_at: string
          description: string | null
          id: string
          parent_id: string | null
          planned_end_date: string
          planned_start_date: string
          priority: string
          progress: number
          project_id: string
          status: string
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          actual_end_date?: string | null
          actual_start_date?: string | null
          assignee_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          parent_id?: string | null
          planned_end_date: string
          planned_start_date: string
          priority?: string
          progress?: number
          project_id: string
          status?: string
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          actual_end_date?: string | null
          actual_start_date?: string | null
          assignee_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          parent_id?: string | null
          planned_end_date?: string
          planned_start_date?: string
          priority?: string
          progress?: number
          project_id?: string
          status?: string
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tasks_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "project_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          actual_end_date: string | null
          actual_progress: number | null
          actual_start_date: string | null
          archived_at: string | null
          closed_at: string | null
          closed_by: string | null
          closing_snapshot: Json | null
          contract_id: string | null
          created_at: string
          created_by: string
          customer_id: string | null
          customer_name: string
          description: string | null
          id: string
          opportunity_id: string | null
          planned_end_date: string
          planned_start_date: string
          project_code: string
          project_manager_id: string
          project_name: string
          quotation_revision_id: string | null
          sales_owner_id: string | null
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          actual_end_date?: string | null
          actual_progress?: number | null
          actual_start_date?: string | null
          archived_at?: string | null
          closed_at?: string | null
          closed_by?: string | null
          closing_snapshot?: Json | null
          contract_id?: string | null
          created_at?: string
          created_by: string
          customer_id?: string | null
          customer_name: string
          description?: string | null
          id?: string
          opportunity_id?: string | null
          planned_end_date: string
          planned_start_date: string
          project_code: string
          project_manager_id: string
          project_name: string
          quotation_revision_id?: string | null
          sales_owner_id?: string | null
          status?: string
          updated_at?: string
          version?: number
        }
        Update: {
          actual_end_date?: string | null
          actual_progress?: number | null
          actual_start_date?: string | null
          archived_at?: string | null
          closed_at?: string | null
          closed_by?: string | null
          closing_snapshot?: Json | null
          contract_id?: string | null
          created_at?: string
          created_by?: string
          customer_id?: string | null
          customer_name?: string
          description?: string | null
          id?: string
          opportunity_id?: string | null
          planned_end_date?: string
          planned_start_date?: string
          project_code?: string
          project_manager_id?: string
          project_name?: string
          quotation_revision_id?: string | null
          sales_owner_id?: string | null
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "projects_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_project_manager_id_fkey"
            columns: ["project_manager_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_quotation_revision_id_fkey"
            columns: ["quotation_revision_id"]
            isOneToOne: false
            referencedRelation: "quotation_revisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_sales_owner_id_fkey"
            columns: ["sales_owner_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      quotation_command_receipts: {
        Row: {
          action: string
          actor_user_id: string
          created_at: string
          payload_hash: string
          request_id: string
          result: Json
        }
        Insert: {
          action: string
          actor_user_id: string
          created_at?: string
          payload_hash: string
          request_id: string
          result: Json
        }
        Update: {
          action?: string
          actor_user_id?: string
          created_at?: string
          payload_hash?: string
          request_id?: string
          result?: Json
        }
        Relationships: [
          {
            foreignKeyName: "quotation_command_receipts_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      quotation_document_links: {
        Row: {
          created_at: string
          document_id: string
          quotation_id: string
        }
        Insert: {
          created_at?: string
          document_id: string
          quotation_id: string
        }
        Update: {
          created_at?: string
          document_id?: string
          quotation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotation_document_links_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_document_links_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      quotation_items: {
        Row: {
          active: boolean
          amount: number | null
          created_at: string
          created_by: string
          headcount: number
          id: string
          item_name: string
          man_month: number
          note: string
          period_end: string | null
          period_start: string | null
          quantity: number
          revision_id: string
          role_name: string
          sort_order: number
          unit_price: number
          updated_at: string
          updated_by: string
          version: number
        }
        Insert: {
          active?: boolean
          amount?: number | null
          created_at?: string
          created_by: string
          headcount?: number
          id?: string
          item_name: string
          man_month?: number
          note?: string
          period_end?: string | null
          period_start?: string | null
          quantity?: number
          revision_id: string
          role_name?: string
          sort_order?: number
          unit_price?: number
          updated_at?: string
          updated_by: string
          version?: number
        }
        Update: {
          active?: boolean
          amount?: number | null
          created_at?: string
          created_by?: string
          headcount?: number
          id?: string
          item_name?: string
          man_month?: number
          note?: string
          period_end?: string | null
          period_start?: string | null
          quantity?: number
          revision_id?: string
          role_name?: string
          sort_order?: number
          unit_price?: number
          updated_at?: string
          updated_by?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotation_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_items_revision_id_fkey"
            columns: ["revision_id"]
            isOneToOne: false
            referencedRelation: "quotation_revisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_items_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      quotation_revisions: {
        Row: {
          approval_subject_id: string | null
          created_at: string
          created_by: string
          expected_cost: number
          expected_profit: number
          expected_profit_rate: number
          id: string
          note: string
          project_name: string
          quotation_date: string
          quotation_id: string
          revision_no: number
          status: string
          supply_amount: number
          total_amount: number
          updated_at: string
          updated_by: string
          valid_until: string
          vat_amount: number
          vat_rate: number
          version: number
        }
        Insert: {
          approval_subject_id?: string | null
          created_at?: string
          created_by: string
          expected_cost?: number
          expected_profit?: number
          expected_profit_rate?: number
          id?: string
          note?: string
          project_name: string
          quotation_date: string
          quotation_id: string
          revision_no: number
          status?: string
          supply_amount?: number
          total_amount?: number
          updated_at?: string
          updated_by: string
          valid_until: string
          vat_amount?: number
          vat_rate?: number
          version?: number
        }
        Update: {
          approval_subject_id?: string | null
          created_at?: string
          created_by?: string
          expected_cost?: number
          expected_profit?: number
          expected_profit_rate?: number
          id?: string
          note?: string
          project_name?: string
          quotation_date?: string
          quotation_id?: string
          revision_no?: number
          status?: string
          supply_amount?: number
          total_amount?: number
          updated_at?: string
          updated_by?: string
          valid_until?: string
          vat_amount?: number
          vat_rate?: number
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotation_revisions_approval_subject_id_fkey"
            columns: ["approval_subject_id"]
            isOneToOne: true
            referencedRelation: "approval_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_revisions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_revisions_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_revisions_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      quotations: {
        Row: {
          approved_revision_id: string | null
          created_at: string
          created_by: string
          current_revision_id: string | null
          customer_id: string
          id: string
          opportunity_id: string
          quotation_number: string
          status: string
          updated_at: string
          updated_by: string
          version: number
        }
        Insert: {
          approved_revision_id?: string | null
          created_at?: string
          created_by: string
          current_revision_id?: string | null
          customer_id: string
          id?: string
          opportunity_id: string
          quotation_number?: string
          status?: string
          updated_at?: string
          updated_by: string
          version?: number
        }
        Update: {
          approved_revision_id?: string | null
          created_at?: string
          created_by?: string
          current_revision_id?: string | null
          customer_id?: string
          id?: string
          opportunity_id?: string
          quotation_number?: string
          status?: string
          updated_at?: string
          updated_by?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotations_approved_revision_fkey"
            columns: ["approved_revision_id"]
            isOneToOne: false
            referencedRelation: "quotation_revisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_current_revision_fkey"
            columns: ["current_revision_id"]
            isOneToOne: false
            referencedRelation: "quotation_revisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      registered_devices: {
        Row: {
          active: boolean
          asset_id: string
          created_by: string
          device_id: string
          device_token_hash: string
          hostname: string
          id: string
          last_seen_at: string | null
          mac_hash: string
          os: string
          registered_at: string
          serial_number: string
          token_version: number
          updated_at: string
          version: number
        }
        Insert: {
          active?: boolean
          asset_id: string
          created_by: string
          device_id: string
          device_token_hash: string
          hostname: string
          id?: string
          last_seen_at?: string | null
          mac_hash: string
          os: string
          registered_at?: string
          serial_number: string
          token_version?: number
          updated_at?: string
          version?: number
        }
        Update: {
          active?: boolean
          asset_id?: string
          created_by?: string
          device_id?: string
          device_token_hash?: string
          hostname?: string
          id?: string
          last_seen_at?: string | null
          mac_hash?: string
          os?: string
          registered_at?: string
          serial_number?: string
          token_version?: number
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "registered_devices_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registered_devices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          permission_id: string
          role_id: string
        }
        Insert: {
          permission_id: string
          role_id: string
        }
        Update: {
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          active: boolean
          code: string
          created_at: string
          id: string
          name: string
          system: boolean
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          id?: string
          name: string
          system?: boolean
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          id?: string
          name?: string
          system?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      sales_command_receipts: {
        Row: {
          action: string
          actor_user_id: string
          created_at: string
          payload_hash: string
          request_id: string
          result: Json
        }
        Insert: {
          action: string
          actor_user_id: string
          created_at?: string
          payload_hash: string
          request_id: string
          result: Json
        }
        Update: {
          action?: string
          actor_user_id?: string
          created_at?: string
          payload_hash?: string
          request_id?: string
          result?: Json
        }
        Relationships: [
          {
            foreignKeyName: "sales_command_receipts_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      skills: {
        Row: {
          active: boolean
          category: string
          code: string
          created_at: string
          id: string
          name: string
          updated_at: string
          version: number
        }
        Insert: {
          active?: boolean
          category?: string
          code: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          version?: number
        }
        Update: {
          active?: boolean
          category?: string
          code?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      tax_invoices: {
        Row: {
          billing_id: string
          buyer_address: string
          buyer_business_item: string
          buyer_business_type: string
          buyer_name: string
          buyer_registration_number: string
          buyer_representative_name: string
          canceled_at: string | null
          correction_reason: string
          created_at: string
          created_by: string
          id: string
          invoice_number: string
          issue_channel: string | null
          issue_date: string
          issued_at: string | null
          items: Json
          note: string
          nts_approval_number: string | null
          original_tax_invoice_id: string | null
          purpose: string
          recipient_email: string
          recipient_name: string
          status: string
          supplier_address: string
          supplier_business_item: string
          supplier_business_type: string
          supplier_email: string | null
          supplier_name: string
          supplier_registration_number: string
          supplier_representative_name: string
          supply_amount: number
          supply_date: string
          total_amount: number
          transmitted_at: string | null
          updated_at: string
          updated_by: string
          vat_amount: number
          version: number
        }
        Insert: {
          billing_id: string
          buyer_address: string
          buyer_business_item: string
          buyer_business_type: string
          buyer_name: string
          buyer_registration_number: string
          buyer_representative_name: string
          canceled_at?: string | null
          correction_reason?: string
          created_at?: string
          created_by: string
          id?: string
          invoice_number?: string
          issue_channel?: string | null
          issue_date: string
          issued_at?: string | null
          items: Json
          note?: string
          nts_approval_number?: string | null
          original_tax_invoice_id?: string | null
          purpose?: string
          recipient_email: string
          recipient_name?: string
          status?: string
          supplier_address: string
          supplier_business_item: string
          supplier_business_type: string
          supplier_email?: string | null
          supplier_name: string
          supplier_registration_number: string
          supplier_representative_name: string
          supply_amount: number
          supply_date: string
          total_amount: number
          transmitted_at?: string | null
          updated_at?: string
          updated_by: string
          vat_amount: number
          version?: number
        }
        Update: {
          billing_id?: string
          buyer_address?: string
          buyer_business_item?: string
          buyer_business_type?: string
          buyer_name?: string
          buyer_registration_number?: string
          buyer_representative_name?: string
          canceled_at?: string | null
          correction_reason?: string
          created_at?: string
          created_by?: string
          id?: string
          invoice_number?: string
          issue_channel?: string | null
          issue_date?: string
          issued_at?: string | null
          items?: Json
          note?: string
          nts_approval_number?: string | null
          original_tax_invoice_id?: string | null
          purpose?: string
          recipient_email?: string
          recipient_name?: string
          status?: string
          supplier_address?: string
          supplier_business_item?: string
          supplier_business_type?: string
          supplier_email?: string | null
          supplier_name?: string
          supplier_registration_number?: string
          supplier_representative_name?: string
          supply_amount?: number
          supply_date?: string
          total_amount?: number
          transmitted_at?: string | null
          updated_at?: string
          updated_by?: string
          vat_amount?: number
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "tax_invoices_billing_id_fkey"
            columns: ["billing_id"]
            isOneToOne: false
            referencedRelation: "billings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_invoices_original_tax_invoice_id_fkey"
            columns: ["original_tax_invoice_id"]
            isOneToOne: false
            referencedRelation: "tax_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_invoices_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      titles: {
        Row: {
          active: boolean
          code: string
          created_at: string
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_permission_overrides: {
        Row: { user_id: string; permission_id: string; allowed: boolean; data_scope: string | null; granted_by: string | null; updated_at: string }
        Insert: { user_id: string; permission_id: string; allowed: boolean; data_scope?: string | null; granted_by?: string | null; updated_at?: string }
        Update: { user_id?: string; permission_id?: string; allowed?: boolean; data_scope?: string | null; granted_by?: string | null; updated_at?: string }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          granted_by: string | null
          role_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          role_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      user_work_policy_assignments: {
        Row: {
          assigned_by: string
          created_at: string
          effective_from: string
          effective_to: string | null
          id: string
          user_id: string
          work_policy_id: string
        }
        Insert: {
          assigned_by: string
          created_at?: string
          effective_from: string
          effective_to?: string | null
          id?: string
          user_id: string
          work_policy_id: string
        }
        Update: {
          assigned_by?: string
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          user_id?: string
          work_policy_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_work_policy_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_work_policy_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_work_policy_assignments_work_policy_id_fkey"
            columns: ["work_policy_id"]
            isOneToOne: false
            referencedRelation: "work_policies"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          address: string
          business_item: string
          business_registration_number: string | null
          business_type: string
          contact_email: string | null
          contact_name: string
          contact_phone: string
          created_at: string
          created_by: string
          id: string
          name: string
          note: string
          representative_name: string
          status: string
          updated_at: string
          updated_by: string
          vendor_code: string
          version: number
        }
        Insert: {
          address?: string
          business_item?: string
          business_registration_number?: string | null
          business_type?: string
          contact_email?: string | null
          contact_name?: string
          contact_phone?: string
          created_at?: string
          created_by: string
          id?: string
          name: string
          note?: string
          representative_name?: string
          status?: string
          updated_at?: string
          updated_by: string
          vendor_code?: string
          version?: number
        }
        Update: {
          address?: string
          business_item?: string
          business_registration_number?: string | null
          business_type?: string
          contact_email?: string | null
          contact_name?: string
          contact_phone?: string
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          note?: string
          representative_name?: string
          status?: string
          updated_at?: string
          updated_by?: string
          vendor_code?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "vendors_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendors_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_reports: {
        Row: {
          completed_work: string
          confirmed_at: string | null
          created_at: string
          entries_snapshot: Json
          id: string
          in_progress_work: string
          issues: string
          next_week_plan: string
          snapshot_taken_at: string
          status: string
          summary: string
          updated_at: string
          user_id: string
          version: number
          week_end_date: string
          week_start_date: string
        }
        Insert: {
          completed_work?: string
          confirmed_at?: string | null
          created_at?: string
          entries_snapshot?: Json
          id?: string
          in_progress_work?: string
          issues?: string
          next_week_plan?: string
          snapshot_taken_at?: string
          status?: string
          summary?: string
          updated_at?: string
          user_id: string
          version?: number
          week_end_date: string
          week_start_date: string
        }
        Update: {
          completed_work?: string
          confirmed_at?: string | null
          created_at?: string
          entries_snapshot?: Json
          id?: string
          in_progress_work?: string
          issues?: string
          next_week_plan?: string
          snapshot_taken_at?: string
          status?: string
          summary?: string
          updated_at?: string
          user_id?: string
          version?: number
          week_end_date?: string
          week_start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      work_policies: {
        Row: {
          active: boolean
          archived_at: string | null
          break_end: string | null
          break_start: string | null
          check_in_time: string
          check_out_time: string
          code: string
          created_at: string
          created_by: string | null
          id: string
          late_grace_minutes: number
          name: string
          timezone: string
          updated_at: string
          version: number
          working_days: number[]
        }
        Insert: {
          active?: boolean
          archived_at?: string | null
          break_end?: string | null
          break_start?: string | null
          check_in_time: string
          check_out_time: string
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          late_grace_minutes?: number
          name: string
          timezone?: string
          updated_at?: string
          version: number
          working_days?: number[]
        }
        Update: {
          active?: boolean
          archived_at?: string | null
          break_end?: string | null
          break_start?: string | null
          check_in_time?: string
          check_out_time?: string
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          late_grace_minutes?: number
          name?: string
          timezone?: string
          updated_at?: string
          version?: number
          working_days?: number[]
        }
        Relationships: [
          {
            foreignKeyName: "work_policies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      workforce_certifications: {
        Row: {
          active: boolean
          certification_name: string
          created_at: string
          credential_id: string | null
          expiry_date: string | null
          id: string
          issuer: string
          obtained_date: string | null
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          active?: boolean
          certification_name: string
          created_at?: string
          credential_id?: string | null
          expiry_date?: string | null
          id?: string
          issuer?: string
          obtained_date?: string | null
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          active?: boolean
          certification_name?: string
          created_at?: string
          credential_id?: string | null
          expiry_date?: string | null
          id?: string
          issuer?: string
          obtained_date?: string | null
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "workforce_certifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      workforce_command_receipts: {
        Row: {
          action: string
          actor_user_id: string
          created_at: string
          payload_hash: string
          request_id: string
          result: Json
        }
        Insert: {
          action: string
          actor_user_id: string
          created_at?: string
          payload_hash: string
          request_id: string
          result: Json
        }
        Update: {
          action?: string
          actor_user_id?: string
          created_at?: string
          payload_hash?: string
          request_id?: string
          result?: Json
        }
        Relationships: [
          {
            foreignKeyName: "workforce_command_receipts_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      workforce_educations: {
        Row: {
          active: boolean
          created_at: string
          degree: string
          end_date: string | null
          graduation_status: string
          highest_education: boolean
          id: string
          major: string
          school_name: string
          sort_order: number
          start_date: string | null
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          degree?: string
          end_date?: string | null
          graduation_status?: string
          highest_education?: boolean
          id?: string
          major?: string
          school_name: string
          sort_order?: number
          start_date?: string | null
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          degree?: string
          end_date?: string | null
          graduation_status?: string
          highest_education?: boolean
          id?: string
          major?: string
          school_name?: string
          sort_order?: number
          start_date?: string | null
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "workforce_educations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      workforce_profiles: {
        Row: {
          birth_date: string | null
          career_months_override: number | null
          career_override_reason: string | null
          career_start_date: string | null
          created_at: string
          profile_status: string
          summary: string
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          birth_date?: string | null
          career_months_override?: number | null
          career_override_reason?: string | null
          career_start_date?: string | null
          created_at?: string
          profile_status?: string
          summary?: string
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          birth_date?: string | null
          career_months_override?: number | null
          career_override_reason?: string | null
          career_start_date?: string | null
          created_at?: string
          profile_status?: string
          summary?: string
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "workforce_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      workforce_project_experiences: {
        Row: {
          active: boolean
          category: string | null
          created_at: string
          customer_name: string | null
          end_date: string | null
          id: string
          project_assignment_id: string | null
          project_name: string | null
          responsibilities: string
          role: string | null
          sort_order: number
          source_type: string
          start_date: string | null
          technologies: string
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          active?: boolean
          category?: string | null
          created_at?: string
          customer_name?: string | null
          end_date?: string | null
          id?: string
          project_assignment_id?: string | null
          project_name?: string | null
          responsibilities: string
          role?: string | null
          sort_order?: number
          source_type: string
          start_date?: string | null
          technologies?: string
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          active?: boolean
          category?: string | null
          created_at?: string
          customer_name?: string | null
          end_date?: string | null
          id?: string
          project_assignment_id?: string | null
          project_name?: string | null
          responsibilities?: string
          role?: string | null
          sort_order?: number
          source_type?: string
          start_date?: string | null
          technologies?: string
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "workforce_project_experiences_project_assignment_id_user_i_fkey"
            columns: ["project_assignment_id", "user_id"]
            isOneToOne: false
            referencedRelation: "project_assignments"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "workforce_project_experiences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      account_context: { Args: never; Returns: Json }
      dashboard_summary: { Args: never; Returns: Json }
      asset_device_command: {
        Args: { p_action: string; p_payload: Json; p_request_id?: string }
        Returns: Json
      }
      attendance_command: {
        Args: { p_action: string; p_payload?: Json; p_request_id?: string }
        Returns: Json
      }
      attendance_security_command: {
        Args: { p_action: string; p_payload: Json; p_request_id?: string }
        Returns: Json
      }
      attendance_verification_prepare: {
        Args: { p_client_ip: unknown; p_event_type: string; p_user_id: string }
        Returns: Json
      }
      attendance_verification_prove_device: {
        Args: {
          p_client_ip: unknown
          p_device_id: string
          p_device_token: string
          p_nonce: string
          p_timestamp: string
          p_verification_id: string
        }
        Returns: Json
      }
      attendance_verification_setting: { Args: never; Returns: Json }
      card_month_amount: { Args: { p_month: string }; Returns: number }
      card_settlement_delivery: { Args: { p_report_id: string }; Returns: Json }
      card_settlement_setting: { Args: never; Returns: Json }
      card_settlement_test_email: {
        Args: { p_email: string; p_report_id: string; p_request_id?: string }
        Returns: Json
      }
      claim_notification_outbox: {
        Args: never
        Returns: {
          attempt_count: number
          created_at: string
          event_key: string
          id: string
          last_error_code: string | null
          lease_until: string | null
          max_attempts: number
          monthly_card_report_id: string | null
          next_attempt_at: string
          notification_id: string | null
          payload: Json
          provider_message_id: string | null
          recipient_email: string
          recipient_user_id: string | null
          status: string
          template: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "notification_outbox"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      complete_notification_outbox: {
        Args: {
          p_error_code?: string
          p_id: string
          p_provider: string
          p_provider_message_id?: string
          p_success: boolean
        }
        Returns: undefined
      }
      contract_command: {
        Args: { p_action: string; p_payload: Json; p_request_id: string }
        Returns: Json
      }
      corporate_card_command: {
        Args: { p_action: string; p_payload: Json; p_request_id?: string }
        Returns: Json
      }
      customer_command: {
        Args: { p_action: string; p_payload: Json; p_request_id: string }
        Returns: Json
      }
      device_agent_heartbeat: {
        Args: { p_device_id: string; p_device_token: string; p_payload?: Json }
        Returns: Json
      }
      employee_directory: {
        Args: never
        Returns: {
          id: string
          name: string
          organization_id: string
          position_id: string
          title_id: string
        }[]
      }
      expense_finance_command: {
        Args: { p_action: string; p_payload: Json; p_request_id: string }
        Returns: Json
      }
      finance_command: {
        Args: { p_action: string; p_payload: Json; p_request_id: string }
        Returns: Json
      }
      leave_approval_command: {
        Args: { p_action: string; p_payload: Json; p_request_id?: string }
        Returns: Json
      }
      management_command: {
        Args: { p_action: string; p_payload: Json; p_request_id?: string }
        Returns: Json
      }
      user_permission_command: {
        Args: { p_user_id: string; p_permission_code: string; p_action: string; p_data_scope?: string | null; p_request_id?: string | null }
        Returns: Json
      }
      operational_alert_status: { Args: never; Returns: Json }
      project_closing_check: {
        Args: { p_as_of?: string; p_project_id: string }
        Returns: Json
      }
      project_expense_summary: {
        Args: { p_month: string; p_project_id: string }
        Returns: Json
      }
      project_financial_portfolio: { Args: { p_as_of?: string }; Returns: Json }
      project_financial_summary: {
        Args: { p_as_of?: string; p_project_id: string }
        Returns: Json
      }
      project_hub_command: {
        Args: { p_action: string; p_payload: Json; p_request_id: string }
        Returns: Json
      }
      project_portfolio_staffing: {
        Args: never
        Returns: {
          filled_count: number
          open_issues: number
          open_requirements: number
          project_id: string
          required_headcount: number
        }[]
      }
      project_resource_command: {
        Args: { p_action: string; p_payload: Json; p_request_id?: string }
        Returns: Json
      }
      project_staffing_candidates: {
        Args: {
          p_min_availability?: number
          p_min_career_months?: number
          p_organization_id?: string
          p_position_id?: string
          p_requirement_id: string
          p_skill_id?: string
        }
        Returns: {
          can_read_profile: boolean
          career_months: number
          matched_required: number
          minimum_availability: number
          name: string
          organization_id: string
          position_id: string
          skills: Json
          total_required: number
          user_id: string
        }[]
      }
      project_staffing_overview: {
        Args: { p_project_id: string }
        Returns: {
          allocation_rate: number
          description: string
          filled_count: number
          id: string
          lifecycle_status: string
          planned_end_date: string
          planned_start_date: string
          project_id: string
          required_headcount: number
          role_name: string
          staffing_status: string
          version: number
        }[]
      }
      quotation_command: {
        Args: { p_action: string; p_payload: Json; p_request_id: string }
        Returns: Json
      }
      record_operational_alert_failure: {
        Args: { p_error_code: string; p_run_date: string }
        Returns: Json
      }
      resource_capacity: {
        Args: { p_end: string; p_granularity?: string; p_start: string }
        Returns: {
          average_allocation: number
          bucket_start: string
          minimum_availability: number
          peak_allocation: number
          user_id: string
        }[]
      }
      resource_leave_windows: {
        Args: { p_end: string; p_start: string }
        Returns: {
          end_date: string
          leave_type: string
          start_date: string
          user_id: string
        }[]
      }
      run_operational_alerts: { Args: { p_run_date?: string }; Returns: Json }
      sales_command: {
        Args: { p_action: string; p_payload: Json; p_request_id: string }
        Returns: Json
      }
      sales_owner_options: {
        Args: never
        Returns: {
          employee_number: string
          id: string
          name: string
        }[]
      }
      system_health: { Args: never; Returns: boolean }
      system_setting_command: {
        Args: {
          p_key: string
          p_request_id?: string
          p_value: Json
          p_version: number
        }
        Returns: Json
      }
      weekly_report_roster: {
        Args: { p_week_start: string }
        Returns: {
          approved_leave_days: number
          name: string
          organization_id: string
          report_id: string
          status: string
          user_id: string
        }[]
      }
      work_log_daily_status: {
        Args: { p_date: string }
        Returns: {
          entry_count: number
          name: string
          organization_id: string
          total_minutes: number
          user_id: string
        }[]
      }
      work_management_command: {
        Args: { p_action: string; p_payload: Json; p_request_id?: string }
        Returns: Json
      }
      workforce_command: {
        Args: { p_action: string; p_payload: Json; p_request_id?: string }
        Returns: Json
      }
      workforce_profile_access: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      workforce_profile_command: {
        Args: { p_action: string; p_payload: Json; p_request_id: string }
        Returns: Json
      }
      workforce_profile_export_audit: {
        Args: {
          p_include_birth_date: boolean
          p_request_id: string
          p_user_ids: string[]
        }
        Returns: number
      }
      workforce_profile_projects: {
        Args: { p_user_id: string }
        Returns: {
          allocation_rate: number
          customer_name: string
          id: string
          planned_end_date: string
          planned_start_date: string
          project_id: string
          project_name: string
          project_role: string
          status: string
          user_id: string
        }[]
      }
      workforce_skill_matrix: {
        Args: {
          p_end: string
          p_min_availability?: number
          p_min_career_months?: number
          p_organization_id?: string
          p_position_id?: string
          p_skill_id?: string
          p_start: string
        }
        Returns: {
          career_months: number
          minimum_availability: number
          name: string
          organization_id: string
          position_id: string
          skills: Json
          user_id: string
        }[]
      }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
