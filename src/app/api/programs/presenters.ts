import type { ProgramRelease, ProgramWithUpdatedAt } from '../../../modules/programs';

export const presentProgram = (program: ProgramWithUpdatedAt) => ({
    id: program.id, name: program.name, description: program.description, github_repo: program.githubRepo,
    category: program.category, tags: program.tags, is_active: program.isActive, created_at: program.createdAt,
    updated_at: program.updatedAt, readme_path: program.readmePath,
});

export const presentRelease = (release: ProgramRelease) => ({
    id: release.id, tag_name: release.tagName, name: release.name, body: release.body,
    published_at: release.publishedAt,
    assets: release.assets.map((asset) => ({ id: asset.id, name: asset.name, download_count: asset.downloadCount, size: asset.size, browser_download_url: asset.browserDownloadUrl, content_type: asset.contentType })),
    html_url: release.htmlUrl, prerelease: release.prerelease, draft: release.draft, updated_at: release.updatedAt,
});
