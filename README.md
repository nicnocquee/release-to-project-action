# Release Notes to Project Action

This GitHub Action processes release notes to update GitHub Project items based on linked issues and pull requests. So basically when you create a new release in GitHub, the action will automatically update the status of the linked issues in the GitHub Project.

## Features

- Automatically extracts pull request information from release notes
- Finds issues linked to the pull requests
- Updates the status of project items associated with those issues
- Supports both user and organization projects
- Fully configurable status field and target status

## Requirements

- The action requires a GitHub token with `repo` and `project` permissions
- Pull requests must be linked to issues
- Issues must be added to the specified GitHub Project
- The project must have a status field with the specified options

## Usage

1. Add a GitHub secret named `MY_GITHUB_TOKEN` with the value of your GitHub Personal Access Token with `repo` and `project` permissions.
2. Add a new workflow file to your repository, e.g., `.github/workflows/release-to-project.yml` with the following content:

```yaml
name: Process Release

on:
  release:
    types: [published]
  workflow_dispatch:
    inputs:
      releaseUrl:
        description: "GitHub release URL"
        required: false
      releaseNotes:
        description: "Release notes content"
        required: false
jobs:
  update-project:
    runs-on: ubuntu-latest
    steps:
      - uses: nicnocquee/release-to-project-action@v1
        with:
          github-token: ${{ secrets.MY_GITHUB_TOKEN }}
          project-number: 1 # The number of the project, for example, if your project's URL is https://github.com/org/repo/projects/1, the number is 1
          organization: my-org # Optional, remove for user projects
          status-field-name: "Status" # Optional, default is "Status"
          target-status: "Deployed to Production" # Optional, default is "Done"
          release-url: ${{ inputs.releaseUrl }}
          release-notes: ${{ inputs.releaseNotes }}
```

The `workflow_dispatch` event is used to trigger the action manually. In this case, you can provide the `release-url` or `release-notes` inputs to process the release notes from a URL or a release event. This is useful for testing the action without creating a new release.

## Inputs

| Input               | Description                                              | Required | Default  |
| ------------------- | -------------------------------------------------------- | -------- | -------- |
| `github-token`      | GitHub token with repository and project permissions     | Yes      | -        |
| `project-number`    | GitHub Project number                                    | Yes      | -        |
| `organization`      | GitHub organization name (if using organization project) | No       | -        |
| `status-field-name` | Name of the status field in the project                  | Yes      | 'Status' |
| `target-status`     | Status to set for the project items                      | Yes      | 'Done'   |

## Development

To check the action works as expected locally, we need to create a test project in GitHub, add two issues in the "In Progress" column in the project, then run the test-local script to simulate a release event that contains the pull requests that are connected to the issues.

First, create a `.env` file based on the `env.example` file and set the required environment variables.

The environment variables are used to configure the test script, which will run the action on a test repository and pull request:

| Variable Name               | Description                                                                                                           |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `MY_GITHUB_TOKEN`           | A GitHub Personal Access Token with `repo` and `project` permissions                                                  |
| `TEST_LOCAL_REPO_OWNER`     | The owner of the test repository                                                                                      |
| `TEST_LOCAL_REPO_NAME`      | The name of the test repository                                                                                       |
| `TEST_LOCAL_PROJECT_NUMBER` | The number of the test project                                                                                        |
| `TEST_LOCAL_ORGANIZATION`   | The name of the test organization (if using an organization project)                                                  |
| `TEST_LOCAL_PULL_REQUEST_1` | The URL of the first pull request to test (e.g., `https://github.com/swiftmanagementag/nothelferambahnhof/pull/857`)  |
| `TEST_LOCAL_PULL_REQUEST_2` | The URL of the second pull request to test (e.g., `https://github.com/swiftmanagementag/nothelferambahnhof/pull/865`) |

Then you need to create a GitHub Project that will be used for testing:

1. Create a new project in your organization or user account that uses the Team Planning template so that we have "Done" status automatically.
2. Set the project number in the `.env` file.
3. Add two issues that has a pull request attached to them to the project into the "In Progress" column.
4. Set the `TEST_LOCAL_PULL_REQUEST_1` and `TEST_LOCAL_PULL_REQUEST_2` variables to the URLs of the pull requests in the "In Progress" column.
5. Create a Personal Access Token with `repo` and `project` permissions and set it as the `MY_GITHUB_TOKEN` environment variable.
6. Fill up other variables in the `.env` file.

Once the environment variables are set, run the following command to run the tests:

```bash
npm run test:local
```

Once successful, the two items in the "In Progress" column will be moved to "Done" in the project.

## License

MIT
