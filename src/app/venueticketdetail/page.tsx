import AuthStatePage from "@/components/auth/AuthStatePage";
import VenueTicketDetailPage from "@/components/venue/ticket-detail/VenueTicketDetailPage";
import { requireVenueAccess } from "@/lib/auth/guards";
import { getVenueTicketDetail } from "@/lib/venue-dashboard";
import { getTicketContactLog } from "@/app/venueticketdetail/actions";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  id?: string | string[];
}>;

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const guard = await requireVenueAccess("/venueticketdetail");

  if (guard.status === "not_configured") {
    return (
      <AuthStatePage
        title="Supabase is not configured"
        description="Add Supabase environment variables before viewing venue ticket details."
      />
    );
  }

  const params = await searchParams;
  const ticketId = getParam(params.id);
  const ticket = await getVenueTicketDetail({
    context: guard,
    ticketId,
  });
  const contactLog = ticket ? await getTicketContactLog(ticket.id) : [];

  return <VenueTicketDetailPage contactLog={contactLog} ticket={ticket} />;
}
