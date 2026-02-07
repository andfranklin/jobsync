import { AddJob } from "@/components/myjobs/AddJob";
import { JOB_SOURCES } from "@/lib/data/jobSourcesData";
import { JOB_STATUSES } from "@/lib/data/jobStatusesData";
import { getMockJobDetails, getMockList } from "@/lib/mock.utils";
import "@testing-library/jest-dom";
import { screen, render, waitFor } from "@testing-library/react";
import { getCurrentUser } from "@/utils/user.utils";
import userEvent from "@testing-library/user-event";
import { format } from "date-fns";
import { addJob, createLocation } from "@/actions/job.actions";
import { addCompany } from "@/actions/company.actions";
import { createJobTitle } from "@/actions/jobtitle.actions";
import { toast } from "@/components/ui/use-toast";

jest.mock("@/utils/user.utils", () => ({
  getCurrentUser: jest.fn(),
}));

jest.mock("@/actions/job.actions", () => ({
  addJob: jest.fn().mockResolvedValue({ success: true }),
  updateJob: jest.fn().mockResolvedValue({ success: true }),
  createLocation: jest.fn().mockResolvedValue({
    success: true,
    data: { id: "new-loc", label: "New Location", value: "new location" },
  }),
}));

jest.mock("@/actions/company.actions", () => ({
  addCompany: jest.fn().mockResolvedValue({
    success: true,
    data: { id: "new-company", label: "Acme Corp", value: "acme corp" },
  }),
}));

jest.mock("@/actions/jobtitle.actions", () => ({
  createJobTitle: jest.fn().mockResolvedValue({
    id: "new-title",
    label: "Software Engineer",
    value: "software engineer",
  }),
}));

jest.mock("@/actions/profile.actions", () => ({
  getResumeList: jest.fn().mockResolvedValue({ data: [] }),
}));

jest.mock("@/components/ui/use-toast", () => ({
  toast: jest.fn(),
}));

jest.mock("next/navigation", () => ({
  redirect: jest.fn(),
}));

global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

document.createRange = () => {
  const range = new Range();

  range.getBoundingClientRect = jest.fn().mockReturnValue({
    bottom: 0,
    height: 0,
    left: 0,
    right: 0,
    top: 0,
    width: 0,
  });

  range.getClientRects = () => {
    return {
      item: () => null,
      length: 0,
      [Symbol.iterator]: jest.fn(),
    };
  };

  return range;
};

describe("AddJob Component", () => {
  const mockUser = { id: "user-id" };
  const mockJobStatuses = JOB_STATUSES;
  const mockJobSources = JOB_SOURCES;
  const mockResetEditJob = jest.fn();
  const user = userEvent.setup({ skipHover: true });
  window.HTMLElement.prototype.scrollIntoView = jest.fn(); // Fixes the issue with combobox
  window.HTMLElement.prototype.hasPointerCapture = jest.fn();

  beforeEach(async () => {
    const mockCompanies = (await getMockList(1, 10, "companies")).data;
    const mockJobTitles = (await getMockList(1, 10, "jobTitles")).data;
    const mockLocations = (await getMockList(1, 10, "locations")).data;
    jest.clearAllMocks();
    render(
      <AddJob
        jobStatuses={mockJobStatuses}
        companies={mockCompanies}
        jobTitles={mockJobTitles}
        locations={mockLocations}
        jobSources={mockJobSources}
        editJob={null}
        resetEditJob={mockResetEditJob}
      />
    );
    const addJobButton = screen.getByTestId("add-job-btn");
    await user.click(addJobButton);
  });

  it("should open the dialog when clicked on add job button with title 'Add Job'", async () => {
    (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);

    const dialogTitle = screen.getByTestId("add-job-dialog-title");
    expect(dialogTitle).toBeInTheDocument();
    expect(dialogTitle).toHaveTextContent("Add Job");
  });
  it("should reflect on status and date applied when applied switch toggles", async () => {
    const appliedSwitch = screen.getByRole("switch");
    expect(appliedSwitch).not.toBeChecked();
    const dateApplied = screen.getByLabelText("Date Applied");
    expect(dateApplied).toBeDisabled();
    await user.click(appliedSwitch); // toggle applied switch
    expect(appliedSwitch).toBeChecked();
    expect(dateApplied).toBeEnabled(); // date applied is enabled
    expect(dateApplied).toHaveTextContent(format(new Date(), "PP")); // to have today's date
    const status = screen.getByLabelText("Status");
    expect(status).toHaveTextContent("Applied");
    await user.click(appliedSwitch);
    expect(status).toHaveTextContent("Draft");
    expect(dateApplied).toBeDisabled();
    expect(dateApplied).toHaveTextContent("Pick a date");
  });
  it("should open the dialog when clicked on add job button with title 'Edit Job'", async () => {
    // TODO: To be tested with job container and jobs table component
  });
  it("should show relevant react-hook-form errors", async () => {
    const saveBtn = screen.getByTestId("save-job-btn");
    await user.click(saveBtn);
    expect(screen.getByText("Job title is required.")).toBeInTheDocument();
    expect(screen.getByText("Company name is required.")).toBeInTheDocument();
    expect(screen.getByText("At least one location is required.")).toBeInTheDocument();
    expect(screen.getByText("Source is required.")).toBeInTheDocument();
    expect(
      screen.getByText("Job description is required.")
    ).toBeInTheDocument();
  });
  it("should close the dialog when clicked on cancel button", async () => {
    const cancelBtn = screen.getByRole("button", { name: /cancel/i });
    const dialog = await screen.findByRole("dialog");
    await user.click(cancelBtn);
    expect(dialog).not.toBeInTheDocument();
  });
  it("should load and show the job title combobox list", async () => {
    const jobTitleCombobox = screen.getByLabelText("Job Title");
    await user.click(jobTitleCombobox);
    const options = screen.getAllByRole("option");
    expect(options.length).toBeGreaterThan(0);
    expect(options[0].textContent).toBe("Frontend Developer");
  });
  it("should load and show the company combobox list", async () => {
    const companyCombobox = screen.getByLabelText("Company");
    await user.click(companyCombobox);
    const options = screen.getAllByRole("option");
    expect(options.length).toBeGreaterThan(0);
    expect(options[0].textContent).toBe("Google");
  });
  it("should load and show the location combobox list", async () => {
    const locationCombobox = screen.getByLabelText("Job Location(s)");
    await user.click(locationCombobox);
    const options = screen.getAllByRole("option");
    expect(options.length).toBeGreaterThan(0);
    expect(options[0].textContent).toBe("San Francisco");
  });
  it("should load and show the job source combobox list", async () => {
    const sourceCombobox = screen.getByLabelText("Job Source");
    await user.click(sourceCombobox);
    const options = screen.getAllByRole("option");
    expect(options.length).toBeGreaterThan(0);
    expect(options[0].textContent).toBe("Indeed");
  });
  it("should load and show the salary min and max selects", async () => {
    const salaryMinSelect = screen.getByLabelText("Salary Min");
    await user.click(salaryMinSelect);
    const options = screen.getAllByRole("option");
    expect(options.length).toBeGreaterThan(0);
    expect(options[0].textContent).toBe("No minimum");
    expect(options[1].textContent).toBe("$50,000");
  });
  it("should load and show the status select list", async () => {
    const statusSelect = screen.getByLabelText("Status");
    await user.click(statusSelect);
    const options = screen.getAllByRole("option");
    expect(options.length).toBeGreaterThan(0);
    expect(options[0].textContent).toBe("Draft");
  });
  it("should closes the dialog and submit to save job when clicked on save button", async () => {
    const jobTitleInput = screen.getByRole("combobox", {
      name: /job title/i,
    }) as HTMLSelectElement;
    await user.click(jobTitleInput);
    const selectedJobTitle = screen.getByRole("option", {
      name: "Full Stack Developer",
    });
    await user.click(selectedJobTitle);

    const companyInput = screen.getByRole("combobox", { name: /company/i });
    await user.click(companyInput);
    const selectedCompany = screen.getByRole("option", {
      name: "Amazon",
    });
    await user.click(selectedCompany);

    const locationInput = screen.getByRole("combobox", {
      name: /job location/i,
    });
    await user.click(locationInput);
    const selectedLocation = screen.getByRole("option", {
      name: "Remote",
    });
    await user.click(selectedLocation);
    // Close the multi-select popover by pressing Escape
    await user.keyboard("{Escape}");

    const sourceInput = screen.getByRole("combobox", {
      name: /job source/i,
    });
    await user.click(sourceInput);
    const selectedSource = screen.getByRole("option", {
      name: "Indeed",
    });
    await user.click(selectedSource);

    const editableDiv = screen.getByLabelText("Job Description");
    const pTag = editableDiv.querySelector("div > p");
    if (pTag) {
      pTag.textContent = "New Job Description";
    }

    const dialog = await screen.findByRole("dialog");
    const saveBtn = screen.getByTestId("save-job-btn");
    await user.click(saveBtn);

    await waitFor(() => {
      expect(addJob).toHaveBeenCalledTimes(1);
      expect(dialog).not.toBeInTheDocument();
      expect(addJob).toHaveBeenCalledWith({
        title: "1xx",
        company: "2zz",
        location: ["1yy"],
        type: "FT",
        source: "1359dac4-a397-4461-b747-382706dcbe79",
        status: "d7ba200a-6dc1-4ea8-acff-29ebb0d4676a",
        dueDate: expect.any(Date),
        dateApplied: undefined,
        salaryMin: undefined,
        salaryMax: undefined,
        jobDescription: "<p>New Job Description</p>",
        jobUrl: undefined,
        applied: false,
      });
    });
  });

  describe("Auto-fill", () => {
    afterEach(() => {
      localStorage.clear();
    });

    it("should have auto-fill button disabled when URL is empty", () => {
      const autoFillBtn = screen.getByRole("button", { name: /auto-fill/i });
      expect(autoFillBtn).toBeDisabled();
    });

    it("should have auto-fill button enabled when URL has a value", async () => {
      const urlInput = screen.getByPlaceholderText(
        "Copy and paste job link here",
      );
      await user.type(urlInput, "https://example.com/job/123");
      const autoFillBtn = screen.getByRole("button", { name: /auto-fill/i });
      expect(autoFillBtn).toBeEnabled();
    });

    it("should call the extract API with correct payload on auto-fill", async () => {
      localStorage.setItem(
        "aiSettings",
        JSON.stringify({ provider: "ollama", model: "llama3.2" }),
      );
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          title: "Software Engineer",
          company: "Acme Corp",
          locations: ["San Francisco, CA"],
          description: "<p>Great job opportunity</p>",
          jobType: "FT",
          salaryMin: 120000,
          salaryMax: 150000,
        }),
      });

      const urlInput = screen.getByPlaceholderText(
        "Copy and paste job link here",
      );
      await user.type(urlInput, "https://example.com/job/123");
      const autoFillBtn = screen.getByRole("button", { name: /auto-fill/i });
      await user.click(autoFillBtn);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/ai/job/extract",
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({
              url: "https://example.com/job/123",
              selectedModel: { provider: "ollama", model: "llama3.2" },
            }),
          }),
        );
      });
    });

    it("should show success toast after successful auto-fill", async () => {
      localStorage.setItem(
        "aiSettings",
        JSON.stringify({ provider: "ollama", model: "llama3.2" }),
      );
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          title: "Software Engineer",
          company: "Acme Corp",
          locations: ["San Francisco, CA"],
          description: "<p>Great job opportunity</p>",
          jobType: "FT",
          salaryMin: 120000,
          salaryMax: 150000,
        }),
      });

      const urlInput = screen.getByPlaceholderText(
        "Copy and paste job link here",
      );
      await user.type(urlInput, "https://example.com/job/123");
      const autoFillBtn = screen.getByRole("button", { name: /auto-fill/i });
      await user.click(autoFillBtn);

      await waitFor(() => {
        expect(toast).toHaveBeenCalledWith(
          expect.objectContaining({
            variant: "success",
            description: "Form auto-filled from job posting.",
          }),
        );
      });
    });

    it("should show error toast when no AI model is configured", async () => {
      // localStorage has no "ai-model" key
      const urlInput = screen.getByPlaceholderText(
        "Copy and paste job link here",
      );
      await user.type(urlInput, "https://example.com/job/123");
      const autoFillBtn = screen.getByRole("button", { name: /auto-fill/i });
      await user.click(autoFillBtn);

      expect(global.fetch).not.toHaveBeenCalledWith(
        "/api/ai/job/extract",
        expect.anything(),
      );
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "No AI model configured",
        }),
      );
    });

    it("should show error toast on API failure", async () => {
      localStorage.setItem(
        "aiSettings",
        JSON.stringify({ provider: "ollama", model: "llama3.2" }),
      );
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 422,
        json: async () => ({ error: "Could not extract enough text" }),
      });

      const urlInput = screen.getByPlaceholderText(
        "Copy and paste job link here",
      );
      await user.type(urlInput, "https://example.com/job/123");
      const autoFillBtn = screen.getByRole("button", { name: /auto-fill/i });
      await user.click(autoFillBtn);

      await waitFor(() => {
        expect(toast).toHaveBeenCalledWith(
          expect.objectContaining({
            variant: "destructive",
            title: "Auto-fill failed",
          }),
        );
      });
    });

    it("should show paste textarea after 422 auto-fill error", async () => {
      localStorage.setItem(
        "aiSettings",
        JSON.stringify({ provider: "ollama", model: "llama3.2" }),
      );
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 422,
        json: async () => ({
          error: "Could not extract enough text from this page.",
        }),
      });

      const urlInput = screen.getByPlaceholderText(
        "Copy and paste job link here",
      );
      await user.type(urlInput, "https://example.com/job/123");
      const autoFillBtn = screen.getByRole("button", { name: /auto-fill/i });
      await user.click(autoFillBtn);

      await waitFor(() => {
        const pasteTextarea = screen.getByPlaceholderText(
          /paste the job description/i,
        );
        expect(pasteTextarea).toBeInTheDocument();
      });
    });

    it("should send pasted content to extract API", async () => {
      localStorage.setItem(
        "aiSettings",
        JSON.stringify({ provider: "ollama", model: "llama3.2" }),
      );

      // Show paste input by clicking toggle
      const toggleBtn = screen.getByText(/or paste job description/i);
      await user.click(toggleBtn);

      const pasteTextarea = screen.getByPlaceholderText(
        /paste the job description/i,
      );
      const longText = "A".repeat(101); // >100 chars to enable button
      await user.type(pasteTextarea, longText);

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          title: "Software Engineer",
          company: "Acme Corp",
          locations: ["Remote"],
          description: "<p>Description</p>",
        }),
      });

      const extractBtn = screen.getByRole("button", {
        name: /extract from pasted text/i,
      });
      await user.click(extractBtn);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/ai/job/extract",
          expect.objectContaining({
            method: "POST",
            body: expect.stringContaining("htmlContent"),
          }),
        );
      });
    });
  });
});
