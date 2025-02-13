import * as core from "@actions/core";
import * as github from "@actions/github";
import { ReleaseParser } from "./release-parser";
import { GitHubService } from "./github-service";

export async function run(): Promise<void> {
  try {
    // Get inputs
    const token = core.getInput("github-token", { required: true });
    const projectNumber = parseInt(core.getInput("project-number"), 10);
    const organization = core.getInput("organization");
    const statusFieldName = core.getInput("status-field-name") || "Status";
    const targetStatus = core.getInput("target-status") || "Done";
    const releaseUrl = core.getInput("release-url");
    const releaseNotesInput = core.getInput("release-notes");

    // Get context
    const { owner, repo } = github.context.repo;
    // Initialize services
    const githubService = new GitHubService(token, owner, repo);

    // Get release notes content
    let releaseNotes: string;

    if (releaseUrl) {
      core.info("Getting release notes from URL...");
      releaseNotes = await githubService.getReleaseFromUrl(releaseUrl);
    } else if (releaseNotesInput) {
      core.info("Using provided release notes...");
      releaseNotes = releaseNotesInput;
    } else if (github.context.payload.release?.body) {
      core.info("Using release notes from event payload...");
      releaseNotes = github.context.payload.release.body;
    } else {
      throw new Error(
        "No release notes provided. Please provide either release-url, release-notes, or trigger with a release event."
      );
    }

    // Get project details
    core.info("Getting project details...");
    const project = await githubService.getProjectDetails(
      projectNumber,
      organization
    );

    // Find status field
    const statusField = project.fields.find((f) => f.name === statusFieldName);
    if (!statusField) {
      throw new Error(`Status field "${statusFieldName}" not found in project`);
    }

    // Extract PRs from release notes
    const pullRequests = ReleaseParser.extractPullRequests(releaseNotes);
    core.info(`Found ${pullRequests.length} pull requests in release notes`);

    // Process each PR
    for (const pr of pullRequests) {
      core.info(`Processing PR #${pr.number}`);

      // Get linked issues
      const issues = await githubService.getLinkedIssues(pr.number);
      core.info(`Found ${issues.length} linked issues for PR #${pr.number}`);

      // Update project items for each issue
      for (const issue of issues) {
        core.info(`Updating project item for issue #${issue.number}`);
        await githubService.updateProjectItemStatus(
          project.id,
          issue.nodeId,
          statusField,
          targetStatus
        );
      }
    }

    core.info(
      "Successfully processed all pull requests and updated project items"
    );
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    }
  }
}

run();
