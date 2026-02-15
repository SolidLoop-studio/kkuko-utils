import { ProgramCategory } from '@/src/app/types/program';

export const PROGRAM_CATEGORIES: { value: ProgramCategory; label: string; param: string }[] = [
  { value: '게임도구', label: '게임도구', param: 'tool' },
  { value: '유틸리티', label: '유틸리티', param: 'util' },
  { value: '기타', label: '기타', param: 'other' },
];

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function getRepositoryOwnerAndName(githubRepo: string): { owner: string; name: string } {
  const parts = githubRepo.split('/');
  return {
    owner: parts[0],
    name: parts[1]
  };
}

export function getCategoryColor(category: ProgramCategory): string {
  const colors: Record<ProgramCategory, string> = {
    '게임도구': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    '유틸리티': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    '기타': 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
  };
  
  return colors[category] || colors['기타'];
}

export function extractRepositoryFromUrl(url: string): string {
  // GitHub URL에서 소유자/저장소명 추출
  const match = url.match(/github\.com\/([^\/]+\/[^\/]+)/);
  return match ? match[1] : url;
}

export function isValidGitHubRepo(repo: string): boolean {
  // 소유자/저장소명 형식인지 확인
  const pattern = /^[a-zA-Z0-9\-_.]+\/[a-zA-Z0-9\-_.]+$/;
  return pattern.test(repo);
}
