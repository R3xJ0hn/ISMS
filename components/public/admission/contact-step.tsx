"use client";

import { TextField } from "./form-fields";

export type ContactFieldName =
  | "contact_email"
  | "contact_phone"
  | "contact_facebook"
  | "address_house_number"
  | "address_subdivision"
  | "address_street"
  | "address_barangay"
  | "address_city"
  | "address_province"
  | "address_postal_code";

type ContactFormValues = Record<ContactFieldName, string>;

type ContactStepProps = {
  form: ContactFormValues;
  onChange: (field: ContactFieldName, value: string) => void;
};

export default function ContactStep({ form, onChange }: ContactStepProps) {
  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold text-gray-950">
          Contact and address
        </h3>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
          Provide the active contact details and current home address the
          registrar should use for updates and document requests.
        </p>
      </div>

      <section className="space-y-5">
        <div>
          <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-700">
            Contact details
          </h4>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <TextField
            id="contact_email"
            label="Email address"
            type="email"
            value={form.contact_email}
            onChange={onChange}
            placeholder="name@example.com"
            autoComplete="email"
            required
          />
          <TextField
            id="contact_phone"
            label="Mobile number"
            type="tel"
            value={form.contact_phone}
            onChange={onChange}
            placeholder="09xx xxx xxxx"
            autoComplete="tel"
            required
          />
          <TextField
            id="contact_facebook"
            label="Facebook profile"
            value={form.contact_facebook}
            onChange={onChange}
            placeholder="Optional"
          />
        </div>
      </section>

      <section className="space-y-5">
        <div>
          <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-700">
            Home address
          </h4>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <TextField
            id="address_house_number"
            label="House number / unit"
            value={form.address_house_number}
            onChange={onChange}
            autoComplete="address-line1"
          />
          <TextField
            id="address_subdivision"
            label="Subdivision / village"
            value={form.address_subdivision}
            onChange={onChange}
          />
          <TextField
            id="address_street"
            label="Street"
            value={form.address_street}
            onChange={onChange}
            autoComplete="address-line2"
          />
          <TextField
            id="address_barangay"
            label="Barangay"
            value={form.address_barangay}
            onChange={onChange}
            required
          />
          <TextField
            id="address_city"
            label="City / municipality"
            value={form.address_city}
            onChange={onChange}
            autoComplete="address-level2"
            required
          />
          <TextField
            id="address_province"
            label="Province"
            value={form.address_province}
            onChange={onChange}
            autoComplete="address-level1"
            required
          />
          <TextField
            id="address_postal_code"
            label="Postal code"
            value={form.address_postal_code}
            onChange={onChange}
            autoComplete="postal-code"
          />
        </div>
      </section>
    </div>
  );
}
