export interface PullRequest {
  number: number;
  url: string;
  author: string;
}

export interface Issue {
  number: number;
  nodeId: string;
}

export interface ProjectField {
  id: string;
  name: string;
  settings?: {
    options?: Array<{
      id: string;
      name: string;
    }>;
  };
}

export interface ProjectDetails {
  id: string;
  number: number;
  fields: ProjectField[];
}
