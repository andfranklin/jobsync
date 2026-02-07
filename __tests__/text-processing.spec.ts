import {
  extractTextFromHtml,
  removeHtmlTags,
} from "@/lib/ai/tools/text-processing";

describe("extractTextFromHtml", () => {
  it("should strip <script> blocks and their content", () => {
    const html = `<html><body>
      <p>Hello world</p>
      <script>console.log("should be removed");</script>
      <p>Still here</p>
    </body></html>`;
    const result = extractTextFromHtml(html);
    expect(result).toContain("Hello world");
    expect(result).toContain("Still here");
    expect(result).not.toContain("console.log");
    expect(result).not.toContain("should be removed");
  });

  it("should strip <style> blocks and their content", () => {
    const html = `<html><head>
      <style>.hidden { display: none; } body { color: red; }</style>
    </head><body><p>Visible text</p></body></html>`;
    const result = extractTextFromHtml(html);
    expect(result).toContain("Visible text");
    expect(result).not.toContain("display: none");
    expect(result).not.toContain("color: red");
  });

  it("should preserve <noscript> content (used as fallback by many sites)", () => {
    const html = `<html><body>
      <p>Main content</p>
      <noscript><p>Software Engineer at Acme Corp</p></noscript>
    </body></html>`;
    const result = extractTextFromHtml(html);
    expect(result).toContain("Main content");
    expect(result).toContain("Software Engineer at Acme Corp");
  });

  it("should strip multiple script and style blocks", () => {
    const html = `<html><head>
      <script src="app.js"></script>
      <style>body { margin: 0; }</style>
    </head><body>
      <p>Content</p>
      <script>var x = 1;</script>
      <style>.foo { bar: baz; }</style>
    </body></html>`;
    const result = extractTextFromHtml(html);
    expect(result).toContain("Content");
    expect(result).not.toContain("app.js");
    expect(result).not.toContain("margin: 0");
    expect(result).not.toContain("var x = 1");
    expect(result).not.toContain("bar: baz");
  });

  it("should preserve readable text content from HTML", () => {
    const html = `<html><body>
      <h1>Software Engineer</h1>
      <p>Google is hiring a <strong>Software Engineer</strong> to join our team.</p>
      <ul>
        <li>5+ years experience</li>
        <li>Python and Java</li>
      </ul>
    </body></html>`;
    const result = extractTextFromHtml(html);
    expect(result).toContain("Software Engineer");
    expect(result).toContain("Google is hiring");
    expect(result).toContain("5+ years experience");
    expect(result).toContain("Python and Java");
  });

  it("should return empty string for empty input", () => {
    expect(extractTextFromHtml("")).toBe("");
  });

  it("should handle plain text with no HTML tags", () => {
    const text = "Just plain text with no tags";
    const result = extractTextFromHtml(text);
    expect(result).toBe("Just plain text with no tags");
  });

  it("should handle multiline script blocks", () => {
    const html = `<body>
      <p>Before</p>
      <script type="application/json">
        {
          "key": "value",
          "nested": { "deep": true }
        }
      </script>
      <p>After</p>
    </body>`;
    const result = extractTextFromHtml(html);
    expect(result).toContain("Before");
    expect(result).toContain("After");
    expect(result).not.toContain("nested");
  });

  it("should preserve JSON-LD structured data from script tags", () => {
    const html = `<html><head>
      <script type="application/ld+json">{"@type":"JobPosting","title":"Software Engineer","description":"Great opportunity"}</script>
      <script>var app = {};</script>
    </head><body>
      <p>Meta Careers</p>
    </body></html>`;
    const result = extractTextFromHtml(html);
    expect(result).toContain("Software Engineer");
    expect(result).toContain("Great opportunity");
    expect(result).toContain("Meta Careers");
    expect(result).not.toContain("var app");
  });

  it("should work when page has only JSON-LD and no visible text", () => {
    const html = `<html><head>
      <script type="application/ld+json">{"@type":"JobPosting","title":"Engineer","description":"Building amazing products"}</script>
      <script>initApp();</script>
      <style>body { margin: 0; }</style>
    </head><body></body></html>`;
    const result = extractTextFromHtml(html);
    expect(result).toContain("Engineer");
    expect(result).toContain("Building amazing products");
    expect(result).not.toContain("initApp");
    expect(result).not.toContain("margin");
  });
});

describe("removeHtmlTags", () => {
  it("should convert list items to bullet points", () => {
    const html = "<ul><li>Item 1</li><li>Item 2</li></ul>";
    const result = removeHtmlTags(html);
    expect(result).toContain("• Item 1");
    expect(result).toContain("• Item 2");
  });

  it("should return empty string for undefined input", () => {
    expect(removeHtmlTags(undefined)).toBe("");
  });

  it("should strip all HTML tags", () => {
    const html = "<p>Hello <strong>world</strong></p>";
    const result = removeHtmlTags(html);
    expect(result).toContain("Hello");
    expect(result).toContain("world");
    expect(result).not.toContain("<p>");
    expect(result).not.toContain("<strong>");
  });
});
