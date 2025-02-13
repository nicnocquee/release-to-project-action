import { ReleaseParser } from "../release-parser";

describe("ReleaseParser", () => {
  it("should extract pull requests from release notes", () => {
    const releaseNotes = `
## What's Changed
* test change 1 by @username in https://github.com/owner/repo/pull/123
* test change 2 by @username in https://github.com/owner/repo/pull/124
    `;

    const pullRequests = ReleaseParser.extractPullRequests(releaseNotes);

    expect(pullRequests).toHaveLength(2);
    expect(pullRequests[0]).toEqual({
      author: "username",
      number: 123,
      url: "https://github.com/owner/repo/pull/123",
    });
    expect(pullRequests[1]).toEqual({
      author: "username",
      number: 124,
      url: "https://github.com/owner/repo/pull/124",
    });
  });

  it("should return empty array for release notes without pull requests", () => {
    const releaseNotes = `
## What's Changed
No changes in this release
    `;

    const pullRequests = ReleaseParser.extractPullRequests(releaseNotes);
    expect(pullRequests).toHaveLength(0);
  });

  it("should handle malformed release notes gracefully", () => {
    const releaseNotes = `
## What's Changed
* invalid format
* another invalid format
    `;

    const pullRequests = ReleaseParser.extractPullRequests(releaseNotes);
    expect(pullRequests).toHaveLength(0);
  });
});
