import { Field } from "@/shared/components/Field";
import type { ApplicantFields as Fields } from "../types";

/**
 * Who is applying — shared by both routes into the directory, because an
 * administrator asks the same questions of a claim and a registration.
 *
 * The phone number is required and the hint says why. Verifying ownership
 * frequently means ringing the number on the business's own paperwork, and an
 * application with no way to reach a human is one nobody can decide.
 */
export function ApplicantFieldset({
  values,
  errors,
  onChange,
}: {
  values: Fields;
  errors: Record<string, string>;
  onChange: (patch: Partial<Fields>) => void;
}) {
  return (
    <fieldset className="space-y-1">
      <legend className="mb-2 text-sm font-semibold text-foreground">About you</legend>

      <Field
        label="Your name"
        autoComplete="name"
        value={values.contactName}
        onChange={(e) => onChange({ contactName: e.target.value })}
        error={errors.contactName}
      />
      {/*
        "Your email" and "Your phone", not "Email" and "Phone".

        On the registration form these sit a few centimetres below the
        *business's* contact details, and two fields both labelled "Phone" are
        ambiguous to anyone who is not reading the fieldset legend — which, on a
        phone, is off the top of the screen by the time they get here. The
        distinction is between the person and the premises, so the label says so.
      */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Your email"
          type="email"
          autoComplete="email"
          value={values.contactEmail}
          onChange={(e) => onChange({ contactEmail: e.target.value })}
          error={errors.contactEmail}
          hint="Where we send our decision."
        />
        <Field
          label="Your phone"
          type="tel"
          autoComplete="tel"
          value={values.contactPhone}
          onChange={(e) => onChange({ contactPhone: e.target.value })}
          error={errors.contactPhone}
          hint="We may ring to confirm."
        />
      </div>
      <Field
        label="Your role"
        value={values.contactRole ?? ""}
        onChange={(e) => onChange({ contactRole: e.target.value })}
        error={errors.contactRole}
        placeholder="Owner, Manager…"
      />

      <div className="space-y-1.5">
        <label htmlFor="message" className="block text-sm font-medium text-foreground">
          Anything else?
        </label>
        <textarea
          id="message"
          rows={3}
          value={values.message ?? ""}
          onChange={(e) => onChange({ message: e.target.value })}
          placeholder="Optional. Anything that helps us confirm this is your business."
          className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
    </fieldset>
  );
}
