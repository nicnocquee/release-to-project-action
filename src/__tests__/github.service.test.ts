import { GitHubService } from "../github-service";
import { getOctokit } from "@actions/github";

// Mock @actions/github
jest.mock("@actions/github");

describe("GitHubService", () => {
  const mockToken = "mock-token";
  const mockOwner = "mock-owner";
  const mockRepo = "mock-repo";

  let service: GitHubService;
  let mockGraphql: jest.Mock;

  beforeEach(() => {
    mockGraphql = jest.fn();
    (getOctokit as jest.Mock).mockReturnValue({
      graphql: mockGraphql,
    });

    service = new GitHubService(mockToken, mockOwner, mockRepo);
  });

  describe("getReleaseFromUrl", () => {
    it("should fetch release notes from valid URL", async () => {
      const releaseUrl = "https://github.com/owner/repo/releases/tag/v1.0.0";
      const expectedReleaseNotes = "## What's Changed\n* test change";

      mockGraphql.mockResolvedValueOnce({
        repository: {
          release: {
            body: expectedReleaseNotes,
          },
        },
      });

      const result = await service.getReleaseFromUrl(releaseUrl);

      expect(result).toBe(expectedReleaseNotes);
      expect(mockGraphql).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          owner: "owner",
          repo: "repo",
          tag: "v1.0.0",
        })
      );
    });

    it("should throw error for invalid URL format", async () => {
      const invalidUrl = "https://github.com/invalid-url";

      await expect(service.getReleaseFromUrl(invalidUrl)).rejects.toThrow(
        "Invalid release URL format"
      );
    });

    it("should throw error when release not found", async () => {
      const releaseUrl = "https://github.com/owner/repo/releases/tag/v1.0.0";

      mockGraphql.mockResolvedValueOnce({
        repository: {
          release: null,
        },
      });

      await expect(service.getReleaseFromUrl(releaseUrl)).rejects.toThrow(
        "Release not found or has no content"
      );
    });
  });

  describe("getProjectDetails", () => {
    it("should fetch project details successfully", async () => {
      const mockResponse = {
        organization: {
          projectV2: {
            id: "project-id",
            number: 1,
            fields: {
              nodes: [
                {
                  id: "field-id",
                  name: "Status",
                  options: [{ id: "option-id", name: "Done" }],
                },
              ],
            },
          },
        },
      };

      mockGraphql.mockResolvedValueOnce(mockResponse);

      const result = await service.getProjectDetails(1, "test-org");

      expect(result).toEqual({
        id: "project-id",
        number: 1,
        fields: [
          {
            id: "field-id",
            name: "Status",
            settings: {
              options: [{ id: "option-id", name: "Done" }],
            },
          },
        ],
      });
    });
  });

  describe("getLinkedIssues", () => {
    it("should fetch linked issues for a pull request", async () => {
      const mockResponse = {
        repository: {
          pullRequest: {
            closingIssuesReferences: {
              nodes: [
                { number: 1, id: "issue-1" },
                { number: 2, id: "issue-2" },
              ],
            },
          },
        },
      };

      mockGraphql.mockResolvedValueOnce(mockResponse);

      const result = await service.getLinkedIssues(123);

      expect(result).toEqual([
        { number: 1, nodeId: "issue-1" },
        { number: 2, nodeId: "issue-2" },
      ]);
    });
  });
});
