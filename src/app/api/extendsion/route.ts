import { NextResponse } from 'next/server';

const token = process.env.GITHUB_API!;
const owner = "hafskjfha";
const repo = "kkuko-extension-download";

interface GitHubReleaseAsset {
    name: string;
    browser_download_url: string;
}

interface GitHubRelease {
    tag_name: string;
    name: string | null;
    draft: boolean;
    prerelease: boolean;
    published_at: string;
    assets: GitHubReleaseAsset[];
    html_url: string;
    body: string;
}

interface ResData {
    version: string;
    releaseDate: string;
    changes: string[];
    updateURL: string;
}

function parseReleaseBody(body: string): string[] {
    return body
        .split(/\r?\n/)                      // 줄 단위로 나누기
        .map(line => line.trim())             // 앞뒤 공백 제거
        .filter(line => line.startsWith('-')) // "-"로 시작하는 줄만
        .map(line => line.replace(/^-+\s*/, '')) // "-"와 공백 제거
        .filter(Boolean);                     // 빈 문자열 제거
}

export async function GET() {
    try {
        const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/latest`, {
            headers: token ? { Authorization: `token ${token}` } : {}
        });

        const resData: ResData = {
            version: "0.1.0",
            releaseDate: "2025-05-27T08:58:10Z",
            changes: [
                "버그 수정"
            ],
            updateURL: "https://github.com/hafskjfha/kkuko-extension-download/releases/tag/0.1.0"
        };

        if (res.status === 404) {
            return NextResponse.json({ data: resData })
        }
        else if (!res.ok) {
            throw new Error(`GitHub API Error: ${res.status}`);
        }

        const data: GitHubRelease = await res.json();
        resData.version = data.tag_name;
        resData.releaseDate = data.published_at;
        resData.updateURL = `https://github.com/hafskjfha/kkuko-extension-download/releases/tag/${data.tag_name}`
        resData.changes = parseReleaseBody(data.body);

        return NextResponse.json({ data: resData })
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: '' }, { status: 500 });
    }
}