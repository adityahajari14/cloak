"use server";

import { redirect } from "next/navigation";
import { createAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { sendEmail, getSiteUrl } from "@/lib/email";
import { LeadNotificationEmail, LeadAutoReplyEmail } from "@/lib/emails/LeadReceivedEmail";

export async function submitDemoRequest(formData: FormData) {
  const venueName = String(formData.get("venueName") ?? "").trim();
  const contactName = String(formData.get("contactName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();
  const capacity = String(formData.get("capacity") ?? "").trim();
  const country = String(formData.get("country") ?? "").trim() || "United Kingdom";
  const preferredDate = String(formData.get("preferredDate") ?? "").trim();
  const preferredTime = String(formData.get("preferredTime") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();

  if (!venueName || !contactName || !email) {
    redirect("/book-a-demo?error=Please+fill+in+all+required+fields.");
  }

  const demoDetails = preferredDate
    ? `Demo date: ${preferredDate}${preferredTime ? ` at ${preferredTime}` : ""}`
    : "";

  const fullMessage = [demoDetails, message].filter(Boolean).join("\n");

  if (isSupabaseAdminConfigured()) {
    const supabase = createAdminClient();
    await supabase.from("leads").insert({
      capacity_estimate: capacity || null,
      contact_email: email,
      contact_name: contactName,
      country,
      message: fullMessage || null,
      venue_name: venueName,
    });
  }

  const adminEmail = process.env.PLATFORM_ADMIN_EMAIL;
  await Promise.all([
    adminEmail
      ? sendEmail({
          to: adminEmail,
          subject: `Demo request: ${venueName}`,
          react: LeadNotificationEmail({
            capacity,
            contactEmail: email,
            contactName,
            dashboardUrl: `${getSiteUrl()}/masterdashboard`,
            message: fullMessage,
            venueName,
          }),
        })
      : Promise.resolve(),
    sendEmail({
      to: email,
      subject: "Your Cloak demo is booked",
      react: LeadAutoReplyEmail({ contactName, venueName }),
    }),
  ]);

  redirect("/book-a-demo?success=1");
}
