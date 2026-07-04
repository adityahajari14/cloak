"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { createAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { VenueContactEmail } from "@/lib/emails/VenueContactEmail";
import type { VenueContactTemplateId } from "@/lib/venue-contact-templates";

function readField(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function finish(message: string): never {
  redirect(`/masterdashboard?message=${encodeURIComponent(message)}`);
}

function finishOnVenue(venueId: string, message: string): never {
  redirect(`/masterdashboard/venues/${venueId}?message=${encodeURIComponent(message)}`);
}

async function assertAdmin() {
  const guard = await requirePlatformAdmin("/masterdashboard");

  if (guard.status === "not_configured" || !isSupabaseAdminConfigured()) {
    finish("Admin actions are temporarily unavailable.");
  }

  return guard;
}

async function writeAuditLog({
  action,
  actorId,
  metadata = {},
  venueId,
}: {
  action: string;
  actorId: string;
  metadata?: Record<string, string>;
  venueId: string;
}) {
  const supabase = createAdminClient();

  await supabase.from("audit_logs").insert({
    action,
    actor_profile_id: actorId,
    entity_id: venueId,
    entity_type: "venue",
    metadata,
    venue_id: venueId,
  });
}


export async function suspendVenue(formData: FormData) {
  const venueId = readField(formData, "venueId");
  const reason = readField(formData, "reason") || "Suspended by platform admin.";
  const admin = await assertAdmin();
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("venues")
    .update({
      active: false,
    })
    .eq("id", venueId);

  if (error) {
    finish("Venue suspension failed. Please try again.");
  }

  await writeAuditLog({
    action: "venue.suspended",
    actorId: admin.userId,
    metadata: { reason },
    venueId,
  });

  revalidatePath("/masterdashboard");
  revalidatePath(`/masterdashboard/venues/${venueId}`);
  finishOnVenue(venueId, "Venue suspended.");
}

export async function activateVenue(formData: FormData) {
  const venueId = readField(formData, "venueId");
  const admin = await assertAdmin();
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("venues")
    .update({
      active: true,
    })
    .eq("id", venueId);

  if (error) {
    finish("Venue activation failed. Please try again.");
  }

  await writeAuditLog({
    action: "venue.activated",
    actorId: admin.userId,
    venueId,
  });

  revalidatePath("/masterdashboard");
  revalidatePath(`/masterdashboard/venues/${venueId}`);
  finishOnVenue(venueId, "Venue reactivated.");
}

// ─── Contact venue (email) ─────────────────────────────────────────────────────

export async function contactVenue(formData: FormData) {
  const venueId = readField(formData, "venueId");
  const templateId = readField(formData, "template") as VenueContactTemplateId;
  const subject = readField(formData, "subject");
  const message = readField(formData, "message");
  const admin = await assertAdmin();

  if (!subject || !message) {
    finishOnVenue(venueId, "Please provide both a subject and a message.");
  }

  const supabase = createAdminClient();
  const { data: venue } = await supabase
    .from("venues")
    .select("name, contact_email")
    .eq("id", venueId)
    .maybeSingle();

  if (!venue?.contact_email) {
    finishOnVenue(venueId, "This venue has no contact email on file.");
  }

  await sendEmail({
    to: venue.contact_email,
    subject,
    react: VenueContactEmail({ message, venueName: venue.name }),
  });

  await supabase.from("venue_contacts").insert({
    contacted_by: admin.userId,
    message,
    subject,
    template: templateId,
    venue_id: venueId,
  });

  revalidatePath(`/masterdashboard/venues/${venueId}`);
  finishOnVenue(venueId, "Email sent to venue.");
}

export type VenueContactLogEntry = {
  id: string;
  subject: string;
  message: string;
  template: "billing_followup" | "cancellation_followup" | "custom";
  createdAt: string;
};

export async function getVenueContactLog(venueId: string): Promise<VenueContactLogEntry[]> {
  const guard = await requirePlatformAdmin("/masterdashboard");
  if (guard.status !== "authorized" || !isSupabaseAdminConfigured()) return [];

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("venue_contacts")
    .select("id, subject, message, template, created_at")
    .eq("venue_id", venueId)
    .order("created_at", { ascending: false });

  return (data ?? []).map((row) => ({
    createdAt: row.created_at,
    id: row.id,
    message: row.message,
    subject: row.subject,
    template: row.template,
  }));
}
