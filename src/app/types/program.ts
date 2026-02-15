export interface Program {
  id: number;
  name: string;
  description: string;
  github_repo: string;
  category: string;
  tags: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
  readme_path: string;
}

export interface GitHubRelease {
  id: number;
  tag_name: string;
  name: string;
  body: string;
  published_at: string;
  assets: GitHubAsset[];
  html_url: string;
  prerelease: boolean;
  draft: boolean;
  updated_at: string;
}

export interface GitHubAsset {
  id: number;
  name: string;
  download_count: number;
  size: number;
  browser_download_url: string;
  content_type: string;
}

export interface ProgramWithReleases extends Program {
  latest_release?: GitHubRelease;
  releases?: GitHubRelease[];
}

export type ProgramCategory = 
  | '게임도구'
  | '유틸리티'
  | '기타';
