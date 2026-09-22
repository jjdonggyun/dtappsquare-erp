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
      expenses: {
        Row: {
          category: string
          corporate_card_id: string
          created_at: string
          deleted_at: string | null
          id: string
          memo: string
          merchant: string
          project_id: string
          purpose: string
          receipt_key: string | null
          settlement_status: string
          supply_amount: number
          total_amount: number | null
          transaction_date: string
          updated_at: string
          user_id: string
          vat_amount: number
          version: number
        }
        Insert: {
          category: string
          corporate_card_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          memo?: string
          merchant: string
          project_id: string
          purpose: string
          receipt_key?: string | null
          settlement_status?: string
          supply_amount: number
          total_amount?: number | null
          transaction_date: string
          updated_at?: string
          user_id: string
          vat_amount: number
          version?: number
        }
        Update: {
          category?: string
          corporate_card_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          memo?: string
          merchant?: string
          project_id?: string
          purpose?: string
          receipt_key?: string | null
          settlement_status?: string
          supply_amount?: number
          total_amount?: number | null
          transaction_date?: string
          updated_at?: string
          user_id?: string
          vat_amount?: number
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
            foreignKeyName: "expenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_user_id_fkey"
            columns: ["user_id"]
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
          created_at: string
          created_by: string
          customer_name: string
          description: string | null
          id: string
          planned_end_date: string
          planned_start_date: string
          project_code: string
          project_manager_id: string
          project_name: string
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          actual_end_date?: string | null
          actual_progress?: number | null
          actual_start_date?: string | null
          archived_at?: string | null
          created_at?: string
          created_by: string
          customer_name: string
          description?: string | null
          id?: string
          planned_end_date: string
          planned_start_date: string
          project_code: string
          project_manager_id: string
          project_name: string
          status?: string
          updated_at?: string
          version?: number
        }
        Update: {
          actual_end_date?: string | null
          actual_progress?: number | null
          actual_start_date?: string | null
          archived_at?: string | null
          created_at?: string
          created_by?: string
          customer_name?: string
          description?: string | null
          id?: string
          planned_end_date?: string
          planned_start_date?: string
          project_code?: string
          project_manager_id?: string
          project_name?: string
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_project_manager_id_fkey"
            columns: ["project_manager_id"]
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
      corporate_card_command: {
        Args: { p_action: string; p_payload: Json; p_request_id?: string }
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
      leave_approval_command: {
        Args: { p_action: string; p_payload: Json; p_request_id?: string }
        Returns: Json
      }
      management_command: {
        Args: { p_action: string; p_payload: Json; p_request_id?: string }
        Returns: Json
      }
      project_expense_summary: {
        Args: { p_month: string; p_project_id: string }
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
