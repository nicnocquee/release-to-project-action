import * as core from "@actions/core";
import * as github from "@actions/github";
import { GitHubService } from "../github-service";
import { run } from "../index";

// Mock the entire @actions/core module
jest.mock("@actions/core", () => ({
  getInput: jest.fn(),
  setFailed: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
}));

jest.mock("@actions/github");
jest.mock("../github-service");

describe("GitHub Action", () => {
  // Type the mocked functions
  const mockedGetInput = core.getInput as jest.MockedFunction<
    typeof core.getInput
  >;
  const mockedSetFailed = core.setFailed as jest.MockedFunction<
    typeof core.setFailed
  >;
  const mockedInfo = core.info as jest.MockedFunction<typeof core.info>;
  let mockGitHubService: jest.Mocked<GitHubService>;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Setup GitHubService mock
    mockGitHubService = {
      getReleaseFromUrl: jest.fn(),
      getProjectDetails: jest.fn(),
      getLinkedIssues: jest.fn(),
      updateProjectItemStatus: jest.fn(),
      getProjectItemForIssue: jest.fn(),
    } as unknown as jest.Mocked<GitHubService>;

    (GitHubService as jest.Mock).mockImplementation(() => mockGitHubService);

    // Default mock values
    mockedGetInput.mockImplementation((name: string) => {
      switch (name) {
        case "github-token":
          return "mock-token";
        case "project-number":
          return "1";
        case "status-field-name":
          return "Status";
        case "target-status":
          return "Done";
        default:
          return "";
      }
    });

    // Mock github context
    (github.context as any) = {
      repo: {
        owner: "mock-owner",
        repo: "mock-repo",
      },
      payload: {},
    };

    // Setup default successful responses
    mockGitHubService.getProjectDetails.mockResolvedValue({
      id: "project-id",
      number: 1,
      fields: [
        {
          id: "status-field-id",
          name: "Status",
          settings: {
            options: [{ id: "option-id", name: "Done" }],
          },
        },
      ],
    });
  });

  it("should process release from URL", async () => {
    const releaseNotes = "## What's Changed\n* test change";
    mockedGetInput.mockImplementation((name: string) => {
      switch (name) {
        case "github-token":
          return "mock-token";
        case "release-url":
          return "https://github.com/owner/repo/releases/tag/v1.0.0";
        default:
          return "";
      }
    });

    mockGitHubService.getReleaseFromUrl.mockResolvedValue(releaseNotes);

    await run();

    expect(mockedInfo).toHaveBeenCalledWith(
      "Getting release notes from URL..."
    );
    expect(mockGitHubService.getReleaseFromUrl).toHaveBeenCalled();
  });

  it("should process release notes from input", async () => {
    const releaseNotes = "## What's Changed\n* test change";
    mockedGetInput.mockImplementation((name: string) => {
      switch (name) {
        case "github-token":
          return "mock-token";
        case "release-notes":
          return releaseNotes;
        default:
          return "";
      }
    });

    await run();

    expect(mockedInfo).toHaveBeenCalledWith("Using provided release notes...");
  });

  it("should process release from event payload", async () => {
    const releaseNotes = "## What's Changed\n* test change";
    mockedGetInput.mockImplementation((name: string) => {
      switch (name) {
        case "github-token":
          return "mock-token";
        default:
          return "";
      }
    });

    (github.context as any).payload = {
      release: {
        body: releaseNotes,
      },
    };

    await run();

    expect(mockedInfo).toHaveBeenCalledWith(
      "Using release notes from event payload..."
    );
  });

  it("should fail when no release notes provided", async () => {
    mockedGetInput.mockImplementation((name: string) => {
      switch (name) {
        case "github-token":
          return "mock-token";
        default:
          return "";
      }
    });

    (github.context as any).payload = {};

    await run();

    expect(mockedSetFailed).toHaveBeenCalledWith(
      expect.stringContaining("No release notes provided")
    );
  });

  it("should process pull requests and update project items", async () => {
    const releaseNotes =
      "## What's Changed\n* test change by @user in https://github.com/owner/repo/pull/123";
    mockedGetInput.mockImplementation((name: string) => {
      switch (name) {
        case "github-token":
          return "mock-token";
        case "release-notes":
          return releaseNotes;
        default:
          return "";
      }
    });

    mockGitHubService.getLinkedIssues.mockResolvedValue([
      { number: 456, nodeId: "issue-node-id" },
    ]);

    await run();

    expect(mockGitHubService.getLinkedIssues).toHaveBeenCalledWith(123);
    expect(mockGitHubService.updateProjectItemStatus).toHaveBeenCalled();
    expect(mockedInfo).toHaveBeenCalledWith(
      "Successfully processed all pull requests and updated project items"
    );
  });

  it("should handle errors during project item update", async () => {
    const releaseNotes =
      "## What's Changed\n* test change by @user in https://github.com/owner/repo/pull/123";
    mockedGetInput.mockImplementation((name: string) => {
      switch (name) {
        case "github-token":
          return "mock-token";
        case "release-notes":
          return releaseNotes;
        default:
          return "";
      }
    });

    const error = new Error("Update failed");
    mockGitHubService.getLinkedIssues.mockResolvedValue([
      { number: 456, nodeId: "issue-node-id" },
    ]);
    mockGitHubService.updateProjectItemStatus.mockRejectedValue(error);

    await run();

    expect(mockedSetFailed).toHaveBeenCalledWith(error.message);
  });
});
