export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      companies: {
        Row: {
          id: string
          name: string
          status: 'active' | 'inactive'
          org_number: string | null
          industry_type: string
          operational_model: string
          timezone: string
          language_code: string
          region_code: string | null
          created_at: string
          updated_at: string
        }
      }
      profiles: {
        Row: {
          id: string
          email: string | null
          full_name: string | null
          phone: string | null
          platform_role:
            | 'owner'
            | 'platform_admin'
            | 'support_admin'
            | 'billing_admin'
            | 'compliance_admin'
            | null
          created_at: string
          updated_at: string
        }
      }
      company_memberships: {
        Row: {
          id: string
          company_id: string
          user_id: string
          role:
            | 'company_admin'
            | 'operations_manager'
            | 'planner'
            | 'supervisor'
            | 'dispatcher'
            | 'team_lead'
            | 'staff'
            | 'contractor'
            | 'read_only'
          status: 'invited' | 'active' | 'disabled'
          is_default: boolean
          created_at: string
          updated_at: string
        }
      }
      teams: {
        Row: {
          id: string
          company_id: string
          name: string
          code: string | null
          description: string | null
          status: 'active' | 'inactive'
          created_at: string
          updated_at: string
        }
      }
      team_memberships: {
        Row: {
          id: string
          team_id: string
          membership_id: string
          is_primary: boolean
          created_at: string
          updated_at: string
        }
      }
      audit_logs: {
        Row: {
          id: string
          company_id: string | null
          actor_user_id: string | null
          action: string
          entity_type: string
          entity_id: string | null
          metadata: Json
          created_at: string
        }
      }
    }
  }
}
