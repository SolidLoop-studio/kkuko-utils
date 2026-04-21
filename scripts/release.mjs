// scripts/release.mjs
import fs from 'fs/promises';
import path from 'path';
import simpleGit from 'simple-git';
import semver from 'semver';
import * as core from '@actions/core';
import { getOctokit, context } from '@actions/github';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// 환경변수 로드 (로컬 테스트용)
dotenv.config();

const git = simpleGit();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configPath = path.resolve(__dirname, '../release-config.json');
const packageJsonPath = path.resolve(__dirname, '../package.json');
const changelogPath = path.resolve(__dirname, '../CHANGELOG.md');

// CLI Arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isReleaseMode = args.includes('--release'); // 릴리즈 등록 모드

async function run() {
  try {
    // 1. 설정 및 패키지 정보 로드
    const config = JSON.parse(await fs.readFile(configPath, 'utf-8'));
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
    const currentVersion = packageJson.version; // v가 없는 버전 (예: 1.0.0)

    console.log(`ℹ️ Current Version: v${currentVersion}`);

    // 2. [skip deploy] 체크 (PR 모드일 때만)
    if (!isReleaseMode) {
      const log = await git.log({ maxCount: 1 });
      const lastCommitMsg = log.latest.message;
      if (lastCommitMsg.includes('[skip ci]') || lastCommitMsg.includes('[skip deploy]')) {
        console.log('🛑 Last commit contains [skip deploy]. Exiting...');
        return;
      }
    }

    // 3. 커밋 로그 가져오기 (마지막 태그부터 HEAD까지)
    let logs;
    try {
      const tags = await git.tags();
      const latestTag = tags.latest;
      if (latestTag) {
        logs = await git.log({ from: latestTag, to: 'HEAD' });
      } else {
        logs = await git.log(); // 태그가 없으면 전체 로그
      }
    } catch (e) {
      logs = await git.log();
    }

    // 4. 커밋 파싱 및 필터링
    const commits = logs.all.map(commit => {
      // Regex: type(scope): subject OR type: subject
      const regex = /^(\w+)(?:\(([^)]+)\))?:\s(.+)$/;
      const match = commit.message.match(regex);

      if (!match) return null;

      return {
        hash: commit.hash.substring(0, 7), // 7자리 해시
        type: match[1],
        scope: match[2],
        subject: match[3],
        raw: commit.message
      };
    }).filter(c => c !== null && config.allowedTypes[c.type]);

    if (commits.length === 0) {
      console.log('⚠️ No matching conventional commits found. Passing...');
      return;
    }

    // 5. 다음 버전 계산
    let bumpType = 'patch'; // default
    let hasBreakingChange = false;

    commits.forEach(commit => {
      if (commit.raw.includes('BREAKING CHANGE') || commit.type === 'breaking') {
        hasBreakingChange = true;
      } else if (commit.type === 'feat') {
        bumpType = 'minor';
      }
    });

    if (hasBreakingChange) bumpType = 'major';

    const nextVersionRaw = semver.inc(currentVersion, bumpType);
    const nextVersion = `v${nextVersionRaw}`;

    console.log(`🚀 Next Version: ${nextVersion} (${bumpType} bump)`);

    // 6. 체인지로그 내용 생성
    const date = new Date().toISOString().split('T')[0];
    const versionHeader = isReleaseMode ? `v${currentVersion}` : nextVersion;
    let header = `# [${versionHeader}] - ${date}`;

    // Repo URL이 있으면 비교 링크 생성
    if (config.repoUrl) {
      // 릴리즈 모드일 때는 이전 태그와 현재 버전 비교 필요 (구현 생략 - 단순화)
       // PR 모드일 때는 현재 버전(old) .. 다음 버전(new)
      const prevVersionTag = isReleaseMode ? '...' : `v${currentVersion}`;
      header = `# [${versionHeader}](${config.repoUrl}/compare/${prevVersionTag}...${versionHeader}) - ${date}`;
    }

    let changelogBody = `${header}\n\n`;

    // 그룹화
    const grouped = commits.reduce((acc, curr) => {
      acc[curr.type] = acc[curr.type] || [];
      acc[curr.type].push(curr);
      return acc;
    }, {});

    const displayHash = (hash) => {
        if (config.repoUrl) {
            return `[${hash}](${config.repoUrl}/commit/${hash})`;
        }
        return hash;
    }

    for (const [type, list] of Object.entries(grouped)) {
      changelogBody += `## ${type}\n`;
      list.forEach(c => {
        changelogBody += `- (${displayHash(c.hash)}) - ${c.subject}\n`;
      });
      changelogBody += '\n';
    }

    // --- 실행 분기: Release Mode (GitHub Release 등록) vs Normal Mode (PR 생성) ---

    if (isReleaseMode) {
      // 릴리즈 모드에서는 이미 버전이 업데이트 된 상태이므로 currentVersion을 사용
      await createGitHubRelease(`v${currentVersion}`, changelogBody, isReleaseMode && isDryRun);
      return;
    }

    // 7. 파일 업데이트 (Normal Mode)
    if (isDryRun) {
      console.log('🧪 [Dry Run] Generated Changelog:\n', changelogBody);
      console.log(`🧪 [Dry Run] Would update package.json to ${nextVersionRaw}`);
    } else {
      // 7-1. package.json 업데이트
      packageJson.version = nextVersionRaw;
      await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

      // 7-2. CHANGELOG.md 업데이트
      let existingChangelog = '';
      try {
        existingChangelog = await fs.readFile(changelogPath, 'utf-8');
      } catch (e) {
        existingChangelog = '';
      }
      
      const newChangelogContent = changelogBody + existingChangelog;
      await fs.writeFile(changelogPath, newChangelogContent);
    }

    // 8. Git 커밋 및 PR 생성
    if (!isDryRun) {
      const branchName = `release/${nextVersion}`;
      const commitMessage = `[skip deploy] - (${nextVersion})`;

      // Git 설정
      await git.addConfig('user.name', 'github-actions[bot]');
      await git.addConfig('user.email', 'github-actions[bot]@users.noreply.github.com');

      // 브랜치 생성 및 체크아웃
      await git.checkoutLocalBranch(branchName);
      
      // 파일 스테이징 및 커밋
      await git.add([packageJsonPath, changelogPath]);
      await git.commit(commitMessage);
      
      // 푸시
      await git.push('origin', branchName);
      
      console.log(`✅ Pushed branch ${branchName}`);

      // PR 생성
      await createPullRequest(branchName, config.targetBranch, nextVersion, changelogBody);
    } else {
      console.log('🧪 [Dry Run] Would create branch, commit, push, and open PR.');
    }

  } catch (error) {
    core.setFailed(`Action failed with error: ${error.message}`);
    process.exit(1);
  }
}

// GitHub PR 생성 함수
async function createPullRequest(head, base, version, body) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN is missing');

  const octokit = getOctokit(token);

  const { data: pr } = await octokit.rest.pulls.create({
    owner: context.repo.owner,
    repo: context.repo.repo,
    title: `chore(release): ${version}`,
    head: head,
    base: base,
    body: `## Release ${version}\n\n${body}`
  });

  console.log(`🎉 Pull Request created: ${pr.html_url}`);
}

// GitHub Release 생성 함수
async function createGitHubRelease(version, body, dryRun) {
  if (dryRun) {
    console.log(`🧪 [Dry Run] Would create GitHub Release for ${version}`);
    return;
  }
  
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN is missing');

  const octokit = getOctokit(token);

  // 릴리즈 생성
  const { data: release } = await octokit.rest.repos.createRelease({
    owner: context.repo.owner,
    repo: context.repo.repo,
    tag_name: version,
    name: version,
    body: body,
    draft: false,
    prerelease: false
  });

  console.log(`🎉 GitHub Release published: ${release.html_url}`);
}

run();
