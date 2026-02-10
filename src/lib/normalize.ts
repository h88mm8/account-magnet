import type { AccountResult, LeadResult } from "@/lib/api/unipile";

/**
 * Normalizes an account result ensuring all fields have values.
 * Acts as a safety layer after backend normalization.
 */
export function normalizeAccount(raw: Record<string, unknown>): AccountResult {
  return {
    name: String(raw.name || raw.title || raw.company_name || raw.companyName || ""),
    industry: String(raw.industry || raw.sector || raw.vertical || ""),
    location: String(raw.location || raw.headquarters || raw.geography || raw.geo || raw.region || ""),
    employeeCount: String(
      raw.employeeCount || raw.employee_count || raw.size || raw.staff_count ||
      raw.company_headcount || raw.headcount || raw.staffCount || raw.companySize || ""
    ),
    linkedinUrl: String(raw.linkedinUrl || raw.linkedin_url || raw.url || ""),
  };
}

/**
 * Normalizes a lead result ensuring all fields have values.
 * Acts as a safety layer after backend normalization.
 */
export function normalizeLead(raw: Record<string, unknown>): LeadResult {
  const currentCompany = raw.currentCompany as Record<string, unknown> | undefined;
  return {
    firstName: String(raw.firstName || raw.first_name || ""),
    lastName: String(raw.lastName || raw.last_name || ""),
    title: String(raw.title || raw.headline || raw.current_role || raw.position || raw.occupation || ""),
    company: String(raw.company || raw.current_company || raw.company_name || raw.companyName || currentCompany?.name || ""),
    location: String(raw.location || raw.geo_location || raw.geoLocation || raw.geography || raw.geo || ""),
    linkedinUrl: String(raw.linkedinUrl || raw.linkedin_url || raw.url || ""),
  };
}
