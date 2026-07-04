import AuthStatePage from "@/components/auth/AuthStatePage";
import VenueDetailPage from "@/components/admin/VenueDetailPage";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { getAdminVenueDetail } from "@/lib/admin-dashboard";
import { getVenueContactLog } from "@/app/masterdashboard/actions";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ message?: string }>;

export default async function Page({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const guard = await requirePlatformAdmin("/masterdashboard");

  if (guard.status === "not_configured") {
    return (
      <AuthStatePage
        title="Supabase is not configured"
        description="Add Supabase environment variables to use the admin dashboard."
      />
    );
  }

  const { id } = await params;
  const { message } = await searchParams;
  const [venue, contactLog] = await Promise.all([getAdminVenueDetail(id), getVenueContactLog(id)]);

  return <VenueDetailPage contactLog={contactLog} message={message} venue={venue} />;
}
