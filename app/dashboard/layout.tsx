import { DashboardSiteHeader } from "@/components/dashboard-site-header";

export default function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen bg-oriwan-bg">
      <DashboardSiteHeader />
      {children}
    </div>
  );
}
