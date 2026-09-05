export type FourthViewer = {
  authenticated: boolean;
  auth_available?: boolean;
  provider: "kakao" | null;
  display_name: string | null;
  approved_participant: boolean;
  verified_name?: boolean;
  name_source?: "admin" | "kakao" | null;
  connection_status?: string;
};

export const anonymousFourthViewer: FourthViewer = {
  authenticated: false,
  provider: null,
  display_name: null,
  approved_participant: false,
  verified_name: false,
  name_source: null,
  connection_status: "unlinked",
};
