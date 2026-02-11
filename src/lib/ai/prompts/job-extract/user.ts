/**
 * Job Extraction User Prompt
 * Constructs the user prompt for extracting job data from scraped text
 */

export function buildJobExtractPrompt(pageText: string): string {
  return `Extract structured job posting data from the following webpage text.

## SCRAPED WEBPAGE TEXT:

${pageText}

## INSTRUCTIONS:

Return a JSON object with these fields:
- title: The exact job title
- company: The company name
- locations: Array of location strings (e.g., ["San Francisco, CA", "Remote"])
- description: A concise summary of the role (~500 words max) as clean HTML — NOT responsibilities or qualifications
- responsibilities: Array of up to 7 key responsibility strings (omit if not found)
- minimumQualifications: Array of bare-minimum requirement strings (omit if not found)
- preferredQualifications: Array of preferred/strong-candidate quality strings (omit if not found)
- jobType: "FT", "PT", or "C" (omit if unclear)
- workArrangement: "REMOTE", "HYBRID", or "IN_OFFICE" (omit if unclear)
- salaryMin: Minimum annual salary as a number (omit if not mentioned)
- salaryMax: Maximum annual salary as a number (omit if not mentioned)

Only include fields you can confidently extract from the text.`;
}
