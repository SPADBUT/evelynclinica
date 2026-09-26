/**
 * Database types derived from A1 + A2 schema.
 *
 * Prefer regenerating when Supabase local is available:
 *   npm run db:types
 *
 * Hand-maintained until Docker/Supabase CLI validation is possible in this environment.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type ClinicRole = 'admin' | 'assistant' | 'professional' | 'finance' | 'manager'
export type PatientStatus = 'active' | 'inactive' | 'in_treatment'
export type CrmLeadStage = 'lead' | 'evaluation' | 'treatment' | 'maintenance'
export type AppointmentStatusDb =
  | 'scheduled'
  | 'confirmed'
  | 'completed'
  | 'cancelled'
  | 'no_show'
export type TreatmentStatus = 'planned' | 'active' | 'completed' | 'cancelled'
export type TreatmentSessionStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
export type ClinicalRecordStatus =
  | 'draft'
  | 'in_progress'
  | 'finalized'
  | 'corrected'
  | 'cancelled'
export type DocumentType =
  | 'consent'
  | 'anamnesis'
  | 'quote'
  | 'contract'
  | 'image_authorization'
  | 'pre_instructions'
  | 'post_instructions'
export type DocumentStatus =
  | 'draft'
  | 'sent'
  | 'viewed'
  | 'in_progress'
  | 'signed'
  | 'refused'
  | 'expired'
  | 'cancelled'
export type QuoteStatus = 'draft' | 'sent' | 'approved' | 'refused' | 'expired'
export type InteractionChannel = 'whatsapp' | 'email' | 'phone' | 'other'
export type AlertKind = 'return' | 'quote_expiry' | 'other'
export type TaskStatus = 'open' | 'done' | 'cancelled'
export type PhotoCategory = 'before' | 'during' | 'after' | 'follow_up'
export type SecureLinkResourceType = 'term' | 'anamnesis' | 'quote' | 'appointment' | 'document'
export type SecureLinkAction = 'view' | 'sign' | 'accept' | 'refuse' | 'respond'

export type Database = {
  public: {
    Tables: {
      clinics: {
        Row: {
          id: string
          name: string
          slug: string
          timezone: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          timezone?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          timezone?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          full_name: string
          email: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name: string
          email: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          email?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      clinic_memberships: {
        Row: {
          id: string
          clinic_id: string
          user_id: string
          role: ClinicRole
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          clinic_id: string
          user_id: string
          role: ClinicRole
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          clinic_id?: string
          user_id?: string
          role?: ClinicRole
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'clinic_memberships_clinic_id_fkey'
            columns: ['clinic_id']
            isOneToOne: false
            referencedRelation: 'clinics'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'clinic_memberships_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      patients: {
        Row: {
          id: string
          clinic_id: string
          full_name: string
          email: string | null
          phone: string | null
          cpf: string | null
          birth_date: string | null
          gender: string | null
          address: string | null
          allergies: string | null
          medications: string | null
          notes: string | null
          status: PatientStatus
          deleted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          clinic_id: string
          full_name: string
          email?: string | null
          phone?: string | null
          cpf?: string | null
          birth_date?: string | null
          gender?: string | null
          address?: string | null
          allergies?: string | null
          medications?: string | null
          notes?: string | null
          status?: PatientStatus
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          clinic_id?: string
          full_name?: string
          email?: string | null
          phone?: string | null
          cpf?: string | null
          birth_date?: string | null
          gender?: string | null
          address?: string | null
          allergies?: string | null
          medications?: string | null
          notes?: string | null
          status?: PatientStatus
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'patients_clinic_id_fkey'
            columns: ['clinic_id']
            isOneToOne: false
            referencedRelation: 'clinics'
            referencedColumns: ['id']
          },
        ]
      }
      appointments: {
        Row: {
          id: string
          clinic_id: string
          patient_id: string
          procedure_id: string | null
          title: string
          procedure_name: string | null
          starts_at: string
          ends_at: string
          status: AppointmentStatusDb
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          clinic_id: string
          patient_id: string
          procedure_id?: string | null
          title: string
          procedure_name?: string | null
          starts_at: string
          ends_at: string
          status?: AppointmentStatusDb
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['appointments']['Insert']>
        Relationships: []
      }
      treatments: {
        Row: {
          id: string
          clinic_id: string
          patient_id: string
          name: string
          status: TreatmentStatus
          started_at: string | null
          ended_at: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          clinic_id: string
          patient_id: string
          name: string
          status?: TreatmentStatus
          started_at?: string | null
          ended_at?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['treatments']['Insert']>
        Relationships: []
      }
      documents: {
        Row: {
          id: string
          clinic_id: string
          patient_id: string
          type: DocumentType
          title: string
          status: DocumentStatus
          procedure_name: string | null
          current_version_id: string | null
          quote_id: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          clinic_id: string
          patient_id: string
          type: DocumentType
          title: string
          status?: DocumentStatus
          procedure_name?: string | null
          current_version_id?: string | null
          quote_id?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['documents']['Insert']>
        Relationships: []
      }
      quotes: {
        Row: {
          id: string
          clinic_id: string
          patient_id: string | null
          lead_id: string | null
          title: string
          discount: number
          notes: string | null
          status: QuoteStatus
          valid_until: string | null
          deleted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          clinic_id: string
          patient_id?: string | null
          lead_id?: string | null
          title: string
          discount?: number
          notes?: string | null
          status?: QuoteStatus
          valid_until?: string | null
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['quotes']['Insert']>
        Relationships: []
      }
      products: {
        Row: {
          id: string
          clinic_id: string
          name: string
          brand: string | null
          manufacturer: string | null
          unit: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          clinic_id: string
          name: string
          brand?: string | null
          manufacturer?: string | null
          unit?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['products']['Insert']>
        Relationships: []
      }
      product_batches: {
        Row: {
          id: string
          clinic_id: string
          product_id: string
          batch_code: string
          expiration_date: string | null
          received_at: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          clinic_id: string
          product_id: string
          batch_code: string
          expiration_date?: string | null
          received_at?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['product_batches']['Insert']>
        Relationships: []
      }
      clinical_records: {
        Row: {
          id: string
          clinic_id: string
          patient_id: string
          treatment_id: string | null
          treatment_session_id: string | null
          procedure_id: string | null
          status: ClinicalRecordStatus
          current_version_id: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          clinic_id: string
          patient_id: string
          treatment_id?: string | null
          treatment_session_id?: string | null
          procedure_id?: string | null
          status?: ClinicalRecordStatus
          current_version_id?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['clinical_records']['Insert']>
        Relationships: []
      }
      audit_logs: {
        Row: {
          id: string
          clinic_id: string | null
          actor_user_id: string | null
          action: string
          entity_type: string
          entity_id: string | null
          occurred_at: string
          ip_address: string | null
          user_agent: string | null
          metadata: Json
        }
        Insert: {
          id?: string
          clinic_id?: string | null
          actor_user_id?: string | null
          action: string
          entity_type: string
          entity_id?: string | null
          occurred_at?: string
          ip_address?: string | null
          user_agent?: string | null
          metadata?: Json
        }
        Update: Partial<Database['public']['Tables']['audit_logs']['Insert']>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      current_user_id: { Args: Record<string, never>; Returns: string }
      is_clinic_member: { Args: { p_clinic_id: string }; Returns: boolean }
      clinic_member_role: { Args: { p_clinic_id: string }; Returns: ClinicRole }
      has_clinic_permission: {
        Args: { p_clinic_id: string; p_permission: string }
        Returns: boolean
      }
    }
    Enums: {
      clinic_role: ClinicRole
      patient_status: PatientStatus
      crm_lead_stage: CrmLeadStage
      appointment_status: AppointmentStatusDb
      treatment_status: TreatmentStatus
      treatment_session_status: TreatmentSessionStatus
      clinical_record_status: ClinicalRecordStatus
      document_type: DocumentType
      document_status: DocumentStatus
      quote_status: QuoteStatus
      interaction_channel: InteractionChannel
      alert_kind: AlertKind
      task_status: TaskStatus
      photo_category: PhotoCategory
      secure_link_resource_type: SecureLinkResourceType
      secure_link_action: SecureLinkAction
    }
    CompositeTypes: Record<string, never>
  }
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']
