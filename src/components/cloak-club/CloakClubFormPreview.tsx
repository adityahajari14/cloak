"use client";

import { joinCloakClub } from "@/app/cloak-club/actions";
import SubmitButton from "@/components/shared/SubmitButton";
import PhoneInput from "@/components/shared/PhoneInput";
import EmailInput from "@/components/shared/EmailInput";
import { GENDER_OPTIONS } from "@/lib/membership";

const inputClass =
  "w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-foreground outline-none transition placeholder:text-zinc-400 focus:border-foreground/40 focus:ring-2 focus:ring-foreground/8";

const selectClass =
  "w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-foreground outline-none transition focus:border-foreground/40 focus:ring-2 focus:ring-foreground/8 cursor-pointer";

// Latest date allowed in the DOB picker: today.
const today = new Date().toISOString().slice(0, 10);

export default function CloakClubFormPreview({ error }: { error?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-6 shadow-sm">
      <form action={joinCloakClub} className="grid gap-5">
        {/* Name */}
        <div className="grid gap-2">
          <label className="text-sm font-semibold text-foreground" htmlFor="full-name">
            Full name
          </label>
          <input
            className={inputClass}
            id="full-name"
            name="fullName"
            placeholder="Enter your full name"
            required
            type="text"
          />
        </div>

        {/* Email */}
        <div className="grid gap-2">
          <label className="text-sm font-semibold text-foreground" htmlFor="email">
            Email
          </label>
          <EmailInput className={inputClass} id="email" name="email" required />
        </div>

        {/* Mobile */}
        <div className="grid gap-2">
          <label className="text-sm font-semibold text-foreground" htmlFor="mobile">
            Mobile
          </label>
          <PhoneInput id="mobile" name="mobile" placeholder="7700 900000" required />
        </div>

        {/* Gender + DOB */}
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="grid gap-2">
            <label className="text-sm font-semibold text-foreground" htmlFor="gender">
              Gender
            </label>
            <select className={selectClass} defaultValue="" id="gender" name="gender" required>
              <option disabled value="">
                Select…
              </option>
              {GENDER_OPTIONS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-semibold text-foreground" htmlFor="dob">
              Date of birth
            </label>
            <input
              className={inputClass}
              id="dob"
              max={today}
              name="dateOfBirth"
              required
              type="date"
            />
          </div>
        </div>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm font-medium text-red-700">{error}</p>
          </div>
        ) : null}

        <SubmitButton>Join Cloak Club — it&apos;s free</SubmitButton>

        <p className="text-center text-xs leading-5 text-muted">
          Your details are used only to create your permanent Cloak pass.
        </p>
      </form>
    </div>
  );
}
