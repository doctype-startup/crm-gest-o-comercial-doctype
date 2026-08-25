import type { Generated } from "kysely";

export type Role = "CEO_ADMIN" | "OPERATIONS" | "FINANCE";
export type ModuleKey =
  | "clients"
  | "accesses"
  | "invoices"
  | "expenses"
  | "tasks"
  | "crm"
  | "team";

export type CommercialModuleKey = "products" | "quotes" | "contracts";
export type RecordModuleKey = ModuleKey | CommercialModuleKey;

export interface OrganizationsTable {
  id: string;
  name: string;
  created_at: string;
}

export interface SaasAccountsTable {
  org_id: string;
  slug: string;
  logo_data_url: string;
  plan: "Start" | "Smart" | "Pro" | "Enterprise";
  status: "Teste" | "Ativo" | "Suspenso" | "Cancelado";
  max_users: number;
  renewal_date: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface PlatformAdminsTable {
  user_id: string;
  created_at: string;
}

export interface SaasBillingTable {
  org_id: string;
  monthly_price: number;
  billing_cycle: "Mensal" | "Trimestral" | "Anual";
  billing_day: number;
  billing_email: string;
  payment_method: "Pix" | "Boleto" | "Cartão" | "Transferência";
  payment_status: "Em dia" | "Pendente" | "Atrasado" | "Isento";
  next_charge_date: string;
  grace_until: string;
  external_customer_id: string;
  external_subscription_id: string;
  updated_at: string;
}

export interface StripeEventsTable {
  id: string;
  org_id: string;
  type: string;
  event_created: number;
  processed_at: string;
}

export interface UsersTable {
  id: string;
  org_id: string;
  name: string;
  email: string;
  password_hash: string;
  role: Role;
  active: number;
  must_change_password: number;
  created_at: string;
  updated_at: string;
}

export interface SessionsTable {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  created_at: string;
}

export interface LoginRateLimitsTable {
  key_hash: string;
  attempts: number;
  window_started_at: string;
  locked_until: string;
  updated_at: string;
}

export interface RecordsTable {
  id: string;
  org_id: string;
  module: RecordModuleKey;
  data: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface AuditLogsTable {
  id: Generated<number>;
  org_id: string;
  user_id: string;
  action: string;
  entity: string;
  entity_id: string | null;
  metadata: string;
  created_at: string;
}

export interface SettingsTable {
  org_id: string;
  key: string;
  value: string;
  updated_at: string;
}

export interface Database {
  organizations: OrganizationsTable;
  saas_accounts: SaasAccountsTable;
  platform_admins: PlatformAdminsTable;
  saas_billing: SaasBillingTable;
  stripe_events: StripeEventsTable;
  users: UsersTable;
  sessions: SessionsTable;
  login_rate_limits: LoginRateLimitsTable;
  records: RecordsTable;
  audit_logs: AuditLogsTable;
  settings: SettingsTable;
}

export interface SessionUser {
  id: string;
  orgId: string;
  name: string;
  email: string;
  role: Role;
  mustChangePassword: boolean;
  isSaasMaster?: boolean;
}

export interface AppRecord {
  id: string;
  module: RecordModuleKey;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface Alert {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string;
  module: string;
}
