export type FourthViewer = {
  authenticated: boolean;
  auth_available?: boolean;
  provider: "kakao" | null;
  display_name: string | null;
  /** Server-owned participant id; exposed only to the authenticated viewer. */
  participant_id: string | null;
  approved_participant: boolean;
  verified_name?: boolean;
  name_source?: "admin" | "kakao" | null;
  connection_status?: string;
  /** One-shot hint used to refresh other open public dashboards after enrollment. */
  dashboard_member_changed?: boolean;
};

export const anonymousFourthViewer: FourthViewer = {
  authenticated: false,
  provider: null,
  display_name: null,
  participant_id: null,
  approved_participant: false,
  verified_name: false,
  name_source: null,
  connection_status: "unlinked",
};
