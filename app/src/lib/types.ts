export type Role = "pending" | "newcomer" | "ap_sponsor" | "leader" | "admin";
export type Status = "pending" | "active" | "inactive";
export type Stage =
  | "module_0" | "key_1" | "key_2" | "key_3" | "certification_review" | "certified" | "ministry_eligible";
export type ModuleKey = "welcome" | "key_1" | "key_2" | "key_3_part_1" | "key_3_part_2" | "certification";
export type Gate = "self" | "self_ap" | "triple" | "leader";
export type StepStatus = "locked" | "open" | "self_initialed" | "ap_initialed" | "leader_initialed" | "returned";

export interface Profile {
  id: string;
  first_name: string;
  display_name: string | null;
  email: string;
  phone: string | null;
  signal: string | null;
  timezone: string;
  country: string | null;
  city: string | null;
  role: Role;
  status: Status;
  sobriety_start_date: string | null;
  program_start_date: string | null;
  /** His own 90-in-90 start (may be before he joined); null = program start. */
  ninety_start_date: string | null;
  primary_leader_id: string | null;
  stage: Stage;
  home_group: string | null;
  service_position: string | null;
  heard_about: string | null;
  email_prefs: Record<string, boolean>;
  last_active_at: string;
  deleted_at: string | null;
  created_at: string;
}

export interface ProgramModule {
  id: string; key: ModuleKey; order_no: number; title: string; description: string | null;
}
export interface ProgramStep {
  id: string; module_id: string; order_no: number; item_number: number | null; title: string;
  description: string | null; turn_in: boolean; gate_type: Gate; requires_upload: boolean;
  due_day: number | null; helper: { type: string; [k: string]: unknown } | null;
}
export interface StepProgress {
  id: string; man_id: string; step_id: string; status: StepStatus;
  self_initialed_at: string | null; ap_initial_by: string | null; ap_initialed_at: string | null;
  leader_initial_by: string | null; leader_initialed_at: string | null;
  returned_at: string | null; returned_by: string | null; review_note: string | null;
  read_to_group: boolean; updated_at: string;
}
export interface Submission {
  id: string; step_progress_id: string; man_id: string; body_text: string | null;
  file_path: string | null; version: number; created_at: string;
}
export interface WorksheetQuestion {
  id: string; module_id: string; order_no: number; timestamp_label: string | null;
  prompt: string; answer_slots: number;
}
export interface Meeting {
  id: string; name: string; day_of_week: number; start_time_utc: string; tagline: string | null;
  beginner: boolean; zoom_url?: string | null; zoom_id?: string | null; zoom_password?: string | null;
  secretary_first_name?: string | null; active?: boolean;
}
export interface Relationship {
  id: string; mentor_id: string; mentee_id: string; type: "ap" | "sponsor" | "temp_sponsor";
  mutual: boolean; status: "offered" | "accepted" | "active" | "ended";
  confirmed_by: string | null; started_at: string | null; ended_at: string | null;
  match_request_id: string | null; created_at: string;
}

export type RpcEvent = { type: string; man_id?: string; [k: string]: unknown };
export type RpcResult = { ok: boolean; events?: RpcEvent[]; [k: string]: unknown };

export const STAGE_LABEL: Record<Stage, string> = {
  module_0: "Module 0 — Welcome",
  key_1: "Key 1",
  key_2: "Key 2 — The 21",
  key_3: "Key 3 — Bill's Story",
  certification_review: "Certification review",
  certified: "Fellowship certified",
  ministry_eligible: "Ministry eligible",
};
export const ROLE_LABEL: Record<Role, string> = {
  pending: "Pending", newcomer: "Newcomer", ap_sponsor: "AP / Sponsor", leader: "Leader", admin: "Admin",
};
