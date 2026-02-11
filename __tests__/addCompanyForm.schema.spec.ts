import { AddCompanyFormSchema } from "@/models/addCompanyForm.schema";

describe("AddCompanyFormSchema", () => {
  describe("company field", () => {
    it("should accept valid company name", () => {
      const validData = {
        company: "Tech Company Inc.",
      };

      const result = AddCompanyFormSchema.parse(validData);
      expect(result.company).toBe("Tech Company Inc.");
    });

    it("should reject empty company name", () => {
      const invalidData = {
        company: "",
      };

      expect(() => AddCompanyFormSchema.parse(invalidData)).toThrow();
    });
  });

  describe("careerPageUrl field", () => {
    it("should accept valid https URL", () => {
      const validData = {
        company: "Tech Company",
        careerPageUrl: "https://example.com/careers",
      };

      const result = AddCompanyFormSchema.parse(validData);
      expect(result.careerPageUrl).toBe("https://example.com/careers");
    });

    it("should accept valid http URL", () => {
      const validData = {
        company: "Tech Company",
        careerPageUrl: "http://example.com/careers",
      };

      const result = AddCompanyFormSchema.parse(validData);
      expect(result.careerPageUrl).toBe("http://example.com/careers");
    });

    it("should accept empty careerPageUrl", () => {
      const validData = {
        company: "Tech Company",
        careerPageUrl: "",
      };

      const result = AddCompanyFormSchema.parse(validData);
      expect(result.careerPageUrl).toBe("");
    });

    it("should default to empty string when careerPageUrl is undefined", () => {
      const validData = {
        company: "Tech Company",
      };

      const result = AddCompanyFormSchema.parse(validData);
      expect(result.careerPageUrl).toBe("");
    });

    it("should reject malformed URL", () => {
      const invalidData = {
        company: "Tech Company",
        careerPageUrl: "not a valid url",
      };

      expect(() => AddCompanyFormSchema.parse(invalidData)).toThrow(
        "Please enter a valid URL",
      );
    });

    it("should accept URL with query parameters", () => {
      const validData = {
        company: "Tech Company",
        careerPageUrl: "https://example.com/careers?page=1&filter=engineering",
      };

      const result = AddCompanyFormSchema.parse(validData);
      expect(result.careerPageUrl).toBe(
        "https://example.com/careers?page=1&filter=engineering",
      );
    });

    it("should accept URL with subdomain", () => {
      const validData = {
        company: "Tech Company",
        careerPageUrl: "https://careers.example.com/jobs",
      };

      const result = AddCompanyFormSchema.parse(validData);
      expect(result.careerPageUrl).toBe("https://careers.example.com/jobs");
    });
  });

  describe("logoUrl field", () => {
    it("should accept a logo URL string", () => {
      const validData = {
        company: "Tech Company",
        logoUrl: "/images/favicons/tech-company.png",
      };

      const result = AddCompanyFormSchema.parse(validData);
      expect(result.logoUrl).toBe("/images/favicons/tech-company.png");
    });

    it("should be undefined when not provided", () => {
      const validData = {
        company: "Tech Company",
      };

      const result = AddCompanyFormSchema.parse(validData);
      expect(result.logoUrl).toBeUndefined();
    });
  });

  describe("description field", () => {
    it("should accept a description string", () => {
      const validData = {
        company: "Tech Company",
        description: "<p>A great company.</p>",
      };

      const result = AddCompanyFormSchema.parse(validData);
      expect(result.description).toBe("<p>A great company.</p>");
    });

    it("should be undefined when not provided", () => {
      const validData = {
        company: "Tech Company",
      };

      const result = AddCompanyFormSchema.parse(validData);
      expect(result.description).toBeUndefined();
    });
  });

  describe("optional fields", () => {
    it("should accept id field", () => {
      const validData = {
        id: "company-123",
        company: "Tech Company",
      };

      const result = AddCompanyFormSchema.parse(validData);
      expect(result.id).toBe("company-123");
    });

    it("should accept createdBy field", () => {
      const validData = {
        createdBy: "user-123",
        company: "Tech Company",
      };

      const result = AddCompanyFormSchema.parse(validData);
      expect(result.createdBy).toBe("user-123");
    });

    it("should accept all fields together", () => {
      const validData = {
        id: "company-123",
        createdBy: "user-123",
        company: "Tech Company",
        careerPageUrl: "https://example.com/careers",
        logoUrl: "/images/favicons/tech-company.png",
        description: "<p>A great company.</p>",
      };

      const result = AddCompanyFormSchema.parse(validData);
      expect(result).toEqual(validData);
    });
  });
});
