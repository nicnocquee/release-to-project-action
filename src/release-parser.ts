import { PullRequest } from "./types";

export class ReleaseParser {
  public static extractPullRequests(releaseNotes: string): PullRequest[] {
    const pullRequests: PullRequest[] = [];
    const prRegex =
      /\* .+ by @([^\s]+) in https:\/\/github\.com\/[^\/]+\/[^\/]+\/pull\/(\d+)/g;

    let match;
    while ((match = prRegex.exec(releaseNotes)) !== null) {
      pullRequests.push({
        author: match[1],
        number: parseInt(match[2], 10),
        url: match[0].split(" in ")[1],
      });
    }

    return pullRequests;
  }
}
