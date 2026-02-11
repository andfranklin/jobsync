/**
 * Company Description User Prompt Builder
 */

export function buildCompanyDescribePrompt(pageText: string): string {
  return `Below is text scraped from a company's website. Write a professional summary of this company.

---
${pageText}
---

Return a concise HTML summary focusing on what the company does, its industry, culture, and what makes it distinctive as an employer.`;
}
