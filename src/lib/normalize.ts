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
    email: String(raw.email || raw.emailAddress || raw.email_address || (raw.contactInfo as any)?.email || "") || undefined,
    phoneNumber: String(raw.phoneNumber || raw.phone_number || raw.phone || (raw.contactInfo as any)?.phoneNumber || "") || undefined,
  };
}
