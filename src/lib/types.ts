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
export type RecordValue = string | number | boolean | string[] | null | undefined;

export interface OrganizationsTable {
  id: string;
  name: string;
  created_at: string;
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
  users: UsersTable;
  sessions: SessionsTable;
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
}

export interface AppRecord {
  id: string;
  module: RecordModuleKey;
  data: Record<string, RecordValue>;
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
