import * as dotenv from "dotenv";
import { ReleaseParser } from "../src/release-parser";
import { GitHubService } from "../src/github-service";

// Load environment variables from .env file
dotenv.config();

async function testLocal() {
  try {
    // You'll need a GitHub token with appropriate permissions
    const token = process.env.MY_GITHUB_TOKEN;
    if (!token) {
      throw new Error("MY_GITHUB_TOKEN environment variable is required");
    }

    // Test configuration
    const config = {
      owner: process.env.TEST_LOCAL_REPO_OWNER,
      repo: process.env.TEST_LOCAL_REPO_NAME,
      projectNumber: parseInt(process.env.TEST_LOCAL_PROJECT_NUMBER || "1", 10),
      organization: process.env.TEST_LOCAL_ORGANIZATION,
      statusFieldName: "Status",
      targetStatus: "Done",
      // Test release notes
      releaseNotes: `
          ## What's Changed
          * test change 1 by @person1 in ${process.env.TEST_LOCAL_PULL_REQUEST_1}
          * test change 2 by @person2 in ${process.env.TEST_LOCAL_PULL_REQUEST_2}
  `,
    };

    if (
      !config.owner ||
      !config.repo ||
      !config.projectNumber ||
      !process.env.TEST_LOCAL_PULL_REQUEST_1 ||
      !process.env.TEST_LOCAL_PULL_REQUEST_2
    ) {
      throw new Error("Missing required environment variables: TEST_LOCAL_*");
    }

    console.log("Starting local test...");
    console.log("Configuration:", {
      ...config,
      token: "***", // Hide token in logs
    });

    // Initialize services
    const githubService = new GitHubService(token, config.owner, config.repo);

    // Test release notes parsing
    console.log("\nTesting release notes parsing...");
    const pullRequests = ReleaseParser.extractPullRequests(config.releaseNotes);
    console.log("Found pull requests:", pullRequests);

    // Test project details fetching
    console.log("\nTesting project details fetching...");
    const project = await githubService.getProjectDetails(
      config.projectNumber,
      config.organization
    );
    console.log("Project details:", JSON.stringify(project, null, 2));

    // Test status field finding
    const statusField = project.fields.find(
      (f) => f.name === config.statusFieldName
    );
    if (!statusField) {
      throw new Error(`Status field "${config.statusFieldName}" not found`);
    }
    console.log("\nFound status field:", statusField);

    // Test processing each PR
    for (const pr of pullRequests) {
      console.log(`\nProcessing PR #${pr.number}...`);

      try {
        const issues = await githubService.getLinkedIssues(pr.number);
        console.log(`Found ${issues.length} linked issues:`, issues);

        for (const issue of issues) {
          console.log(`Processing issue #${issue.number} (${issue.nodeId})...`);
          try {
            await githubService.updateProjectItemStatus(
              project.id,
              issue.nodeId,
              statusField,
              config.targetStatus
            );
            console.log(
              `Successfully updated status for issue #${issue.number}`
            );
          } catch (error) {
            if (error instanceof Error) {
              console.error(
                `Failed to update status for issue #${issue.number}:`,
                error.message
              );
              if ("errors" in (error as any)) {
                console.error("GraphQL Errors:", (error as any).errors);
              }
            } else {
              console.error(
                `Failed to update status for issue #${issue.number}:`,
                error
              );
            }
            process.exit(1); // Exit with error if any update fails
          }
        }
      } catch (error) {
        console.error(`Failed to process PR #${pr.number}:`, error);
        process.exit(1);
      }
    }

    console.log("\nAll updates completed successfully!");
  } catch (error) {
    console.error("Test failed:", error);
    process.exit(1);
  }
}

// Run the test
testLocal();
