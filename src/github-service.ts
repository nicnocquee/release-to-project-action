import { getOctokit } from "@actions/github";
import { ProjectDetails, Issue, ProjectField } from "./types";

// Add interface definitions for GraphQL responses
interface ProjectV2Field {
  id: string;
  name: string;
}

interface ProjectV2SingleSelectField extends ProjectV2Field {
  options: Array<{
    id: string;
    name: string;
  }>;
}

interface ProjectQueryResponse {
  organization?: {
    projectV2: {
      id: string;
      number: number;
      fields: {
        nodes: Array<ProjectV2Field | ProjectV2SingleSelectField>;
      };
    };
  };
  user?: {
    projectV2: {
      id: string;
      number: number;
      fields: {
        nodes: Array<ProjectV2Field | ProjectV2SingleSelectField>;
      };
    };
  };
}

interface PullRequestQueryResponse {
  repository: {
    pullRequest: {
      closingIssuesReferences: {
        nodes: Array<{
          number: number;
          id: string;
        }>;
      };
    };
  };
}

export class GitHubService {
  private octokit;
  private owner: string;
  private repo: string;

  constructor(token: string, owner: string, repo: string) {
    this.octokit = getOctokit(token);
    this.owner = owner;
    this.repo = repo;
  }

  async getProjectDetails(
    projectNumber: number,
    organization?: string
  ): Promise<ProjectDetails> {
    const query = `
      query($owner: String!, $number: Int!) {
        ${organization ? "organization" : "user"}(login: $owner) {
          projectV2(number: $number) {
            id
            number
            fields(first: 20) {
              nodes {
                ... on ProjectV2Field {
                  id
                  name
                }
                ... on ProjectV2SingleSelectField {
                  id
                  name
                  options {
                    id
                    name
                  }
                }
              }
            }
          }
        }
      }
    `;

    const response = await this.octokit.graphql<ProjectQueryResponse>(query, {
      owner: organization || this.owner,
      number: projectNumber
    });

    const project = response[organization ? "organization" : "user"]?.projectV2;
    if (!project) {
      throw new Error("Project not found");
    }

    return {
      id: project.id,
      number: project.number,
      fields: project.fields.nodes.map((node) => ({
        id: node.id,
        name: node.name,
        settings: "options" in node ? { options: node.options } : undefined
      }))
    };
  }

  async getLinkedIssues(pullNumber: number): Promise<Issue[]> {
    const query = `
      query($owner: String!, $repo: String!, $pullNumber: Int!) {
        repository(owner: $owner, name: $repo) {
          pullRequest(number: $pullNumber) {
            closingIssuesReferences(first: 10) {
              nodes {
                number
                id
              }
            }
          }
        }
      }
    `;

    const response = await this.octokit.graphql<PullRequestQueryResponse>(
      query,
      {
        owner: this.owner,
        repo: this.repo,
        pullNumber
      }
    );

    return response.repository.pullRequest.closingIssuesReferences.nodes.map(
      (node) => ({
        number: node.number,
        nodeId: node.id
      })
    );
  }

  async getProjectItemForIssue(
    projectId: string,
    issueNodeId: string
  ): Promise<string | null> {
    const query = `
      query($projectId: ID!) {
        node(id: $projectId) {
          ... on ProjectV2 {
            items(first: 100) {
              nodes {
                id
                content {
                  ... on Issue {
                    id
                  }
                }
              }
            }
          }
        }
      }
    `;

    const response = await this.octokit.graphql<{
      node: {
        items: {
          nodes: Array<{
            id: string;
            content?: {
              id: string;
            };
          }>;
        };
      };
    }>(query, {
      projectId
    });

    const items = response.node.items.nodes;
    const projectItem = items.find((item) => item.content?.id === issueNodeId);
    return projectItem ? projectItem.id : null;
  }

  async updateProjectItemStatus(
    projectId: string,
    issueNodeId: string,
    statusField: ProjectField,
    newStatus: string
  ): Promise<void> {
    // First, get the project item ID
    const projectItemId = await this.getProjectItemForIssue(
      projectId,
      issueNodeId
    );

    if (!projectItemId) {
      throw new Error(`No project item found for issue ID ${issueNodeId}`);
    }

    console.log("Found project item:", projectItemId);

    const option = statusField.settings?.options?.find(
      (opt) => opt.name === newStatus
    );

    if (!option) {
      throw new Error(
        `Status "${newStatus}" not found in project field options`
      );
    }

    console.log("Found status option:", option);

    const mutation = `
      mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
        updateProjectV2ItemFieldValue(
          input: {
            projectId: $projectId
            itemId: $itemId
            fieldId: $fieldId
            value: { 
              singleSelectOptionId: $optionId
            }
          }
        ) {
          projectV2Item {
            id
          }
        }
      }
    `;

    await this.octokit.graphql(mutation, {
      projectId,
      itemId: projectItemId,
      fieldId: statusField.id,
      optionId: option.id
    });
  }

  async getReleaseFromUrl(releaseUrl: string): Promise<string> {
    // Extract owner, repo, and tag from URL
    const urlPattern =
      /https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/releases\/tag\/([^\/]+)/;
    const match = releaseUrl.match(urlPattern);

    if (!match) {
      throw new Error("Invalid release URL format");
    }

    const [, owner, repo, tag] = match;

    const query = `
      query($owner: String!, $repo: String!, $tag: String!) {
        repository(owner: $owner, name: $repo) {
          release(tagName: $tag) {
            descriptionHTML
            description
          }
        }
      }
    `;

    const response = await this.octokit.graphql(query, {
      owner,
      repo,
      tag
    });

    interface GraphQLResponse {
      repository: {
        release?: {
          description: string;
          descriptionHTML: string;
        };
      };
    }

    const typedResponse = response as GraphQLResponse;

    if (!typedResponse.repository.release?.description) {
      throw new Error("Release not found or has no content");
    }

    return typedResponse.repository.release.description;
  }
}
