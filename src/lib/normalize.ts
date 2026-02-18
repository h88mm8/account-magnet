import type { AccountResult, LeadResult } from "@/lib/api/unipile";

/**
 * Normalizes an account result ensuring all fields have values.
 * Acts as a safety layer after backend normalization.
 */
export function normalizeAccount(raw: Record<string, unknown>): AccountResult {
  return {
    name: String(raw.name || raw.title || raw.company_name || raw.companyName || ""),
    industry: String(raw.industry || raw.sector || raw.vertical || ""),
    location: String(
      raw.location || raw.headquarters || raw.hq_location || raw.headquarter ||
      raw.company_location || raw.companyLocation || raw.geography || raw.geo ||
      raw.region || raw.hqLocation || raw.address || ""
    ),
    employeeCount: String(
      raw.employeeCount || raw.employee_count || raw.size || raw.staff_count ||
      raw.company_headcount || raw.headcount || raw.staffCount || raw.companySize || ""
    ),
    linkedinUrl: String(raw.linkedinUrl || raw.linkedin_url || raw.url || ""),
    revenue: String(raw.revenue || raw.annual_revenue || raw.annualRevenue || ""),
  };
}

/**
 * Resolves email from all known Apollo/Unipile field variations.
 */
function resolveLeadEmail(raw: Record<string, unknown>): string | undefined {
  // Direct field (Apollo normalized)
  if (raw.email && typeof raw.email === "string" && (raw.email as string).includes("@")) return raw.email as string;

  // email_addresses array (Apollo raw)
  const emailAddresses = raw.email_addresses as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(emailAddresses) && emailAddresses.length > 0) {
    const preferred = emailAddresses.find((e) => e.type === "personal" || e.type === "work");
    const candidate = preferred || emailAddresses[0];
    const val = (candidate?.email || candidate?.value || candidate?.address) as string | undefined;
    if (val && val.includes("@")) return val;
  }

  // Other common aliases
  const fallback = (raw.emailAddress || raw.email_address || (raw.contactInfo as any)?.email) as string | undefined;
  if (fallback && fallback.includes("@")) return fallback;

  return undefined;
}

/**
 * Resolves phone from all known Apollo/Unipile field variations.
 */
function resolveLeadPhone(raw: Record<string, unknown>): string | undefined {
  // primary_phone object (Apollo most common)
  const primaryPhone = raw.primary_phone as Record<string, unknown> | undefined;
  if (primaryPhone) {
    const num = (primaryPhone.sanitized_number || primaryPhone.number || primaryPhone.raw_number) as string | undefined;
    if (num) return num;
  }

  // Direct fields
  if (raw.phoneNumber && typeof raw.phoneNumber === "string") return raw.phoneNumber as string;
  if (raw.sanitized_phone && typeof raw.sanitized_phone === "string") return raw.sanitized_phone as string;
  if (raw.phone && typeof raw.phone === "string") return raw.phone as string;

  // phone_numbers array
  const phoneNumbers = raw.phone_numbers as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(phoneNumbers) && phoneNumbers.length > 0) {
    const preferred = phoneNumbers.find((ph) => ph.type === "mobile" || ph.type === "personal" || ph.type === "work_hq");
    const candidate = preferred || phoneNumbers[0];
    const num = (candidate?.sanitized_number || candidate?.number || candidate?.raw_number) as string | undefined;
    if (num) return num;
  }

  // Other aliases
  const fallback = (raw.phone_number || (raw.contactInfo as any)?.phoneNumber) as string | undefined;
  return fallback || undefined;
}

/**
 * Normalizes a lead result ensuring all fields have values.
 * Acts as a safety layer after backend normalization.
 */
export function normalizeLead(raw: Record<string, unknown>): LeadResult {
  const currentPositions = raw.current_positions as Array<Record<string, unknown>> | undefined;
  const firstPosition = currentPositions?.[0];
  return {
    firstName: String(raw.firstName || raw.first_name || ""),
    lastName: String(raw.lastName || raw.last_name || ""),
    title: String(firstPosition?.role || raw.title || raw.headline || raw.current_role || raw.position || raw.occupation || ""),
    company: String(firstPosition?.company || raw.company || raw.current_company || raw.company_name || raw.companyName || ""),
    location: String(raw.location || raw.geo_location || raw.geoLocation || raw.geography || raw.geo || ""),
    linkedinUrl: String(raw.profile_url || raw.linkedinUrl || raw.linkedin_url || raw.url || ""),
    profilePictureUrl: String(raw.profilePictureUrl || raw.profile_picture_url || raw.avatar_url || ""),
    email: resolveLeadEmail(raw),
    phoneNumber: resolveLeadPhone(raw),
  };
}
