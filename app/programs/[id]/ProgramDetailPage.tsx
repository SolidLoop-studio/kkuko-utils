'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Program, GitHubRelease, ProgramCategory } from '@/app/types/program';
import { formatDate, formatFileSize, getCategoryColor } from '@/app/lib/programUtils';
import { 
  Download, 
  Tag, 
  Calendar, 
  ArrowLeft, 
  ExternalLink, 
  FileDown,
  Package,
  BookOpen
} from 'lucide-react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import axios from 'axios';
import useSWR from 'swr';
import useSWRMutation from "swr/mutation"

const programInfoFetcher = async (id: string): Promise<{data: {data: Program}, error: null} | {data: null, error: FetchError}> => {
  try {
    const res = await axios.get<{data: Program}>('/api/programs/info', { params: { id } });
    return { data: res.data, error: null };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      return { data: null, error: { name: 'FetchError', httpCode: error.response.status, message: '프로그램 정보를 불러오는 데 실패했습니다', stackTrace: error.stack, data: error.response.data } };
    }
    return { data: null, error: { name: 'FetchError', httpCode: null, message: '프로그램 정보를 불러오는 데 실패했습니다', stackTrace: error instanceof Error ? error.stack : undefined } };
  }
}

const ProgramReleaseFetcher = async (_: string, { arg }: { arg: { repo: string } }): Promise<{data: {latest: GitHubRelease, all: GitHubRelease[]}, error: null} | {data: null, error: FetchError}> => {
  try {
    const repo = arg.repo;
    const encodedRepo = encodeURIComponent(repo);

    // 최신 릴리즈 가져오기
    const latestResponse = await axios.get<{release: GitHubRelease}>(`/api/programs/releases/${encodedRepo}/latest`);

    // 전체 릴리즈 목록 가져오기
    const releasesResponse = await axios.get<{releases: GitHubRelease[]}>(`/api/programs/releases/${encodedRepo}?per_page=10`);

    const returnData: { latest: GitHubRelease; all: GitHubRelease[] } = {
      latest: latestResponse.data.release,
      all: releasesResponse.data.releases,
    };

    return {data: returnData, error: null};
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      return { data: null, error: { name: 'FetchError', httpCode: error.response.status, message: '프로그램 정보를 불러오는 데 실패했습니다', stackTrace: error.stack, data: error.response.data } };
    }
    return { data: null, error: { name: 'FetchError', httpCode: null, message: '프로그램 정보를 불러오는 데 실패했습니다', stackTrace: error instanceof Error ? error.stack : undefined } };
  }
}

export default function ProgramDetailPage() {
  const params = useParams();
  const router = useRouter();
  const programId = params.id as string;

  const [program, setProgram] = useState<Program | null>(null);
  const [releases, setReleases] = useState<GitHubRelease[]>([]);
  const [latestRelease, setLatestRelease] = useState<GitHubRelease | null>(null);
  const [releasesLoading, setReleasesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllReleases, setShowAllReleases] = useState(false);
  const {data: infoData, isLoading} = useSWR(`/api/programs/info?id=${programId}`, () => programInfoFetcher(programId), { dedupingInterval: 300_000, revalidateIfStale: false });
  const { trigger, data: mutateData, isMutating } = useSWRMutation(`/api/programs/releases?id=${programId}`, ProgramReleaseFetcher);

  useEffect(()=>{
    const updateFunc = async () => {
      if (infoData) {
        if (infoData.error) {
          setError(infoData.error.message);
        } else if (infoData.data) {
          setProgram(infoData.data.data);
          setError(null);
          await trigger({repo: infoData.data.data.github_repo});
        }
      }
    }
    updateFunc()
  },[infoData])

  useEffect(()=>{
    setReleasesLoading(isMutating)
    if (mutateData) {
      if (mutateData.error) {
        setError(mutateData.error.message);
      } else if (mutateData.data) {
        setLatestRelease(mutateData.data.latest);
        setReleases(mutateData.data.all);
        setError(null);
      }
    }
  },[mutateData, isMutating])

  if (isLoading || releasesLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-900 dark:to-slate-900">
        <div className="container mx-auto px-6 py-12">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-gray-600 dark:text-gray-400">프로그램 정보를 불러오는 중...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !program) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-900 dark:to-slate-900">
        <div className="container mx-auto px-6 py-12">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <ExternalLink className="w-8 h-8 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">오류가 발생했습니다</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
              <button
                onClick={() => router.push('/programs')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                프로그램 목록으로 돌아가기
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-900 dark:to-slate-900">
      <div className="container mx-auto px-6 py-12">
        {/* 뒤로 가기 버튼 */}
        <Link
          href="/programs"
          className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 mb-8 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          프로그램 목록으로 돌아가기
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 메인 콘텐츠 */}
          <div className="lg:col-span-2 space-y-8">
            {/* 프로그램 정보 */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                      {program.name}
                    </h1>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getCategoryColor(program.category as ProgramCategory)}`}>
                      {program.category}
                    </span>
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 text-lg">
                    {program.description}
                  </p>
                </div>
              </div>

              {/* 태그 */}
              {program.tags.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">태그</h3>
                  <div className="flex flex-wrap gap-2">
                    {program.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded-md"
                      >
                        <Tag className="w-4 h-4 mr-1" />
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 액션 버튼들 */}
              <div className="flex flex-wrap gap-3">
                {latestRelease && (
                  <a
                    href={latestRelease.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                  >
                    <Download className="w-5 h-5 mr-2" />
                    최신 버전 다운로드 ({latestRelease.tag_name})
                  </a>
                )}
                <a
                  href={`https://github.com/${program.github_repo}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
                >
                  GitHub에서 보기
                </a>
              </div>
            </div>

            {/* README 파일 */}
            {program.readme_path && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
                    <BookOpen className="w-6 h-6 mr-2 text-blue-600 dark:text-blue-400" />
                    읽어주세요! 리드미 파일
                  </h2>
                </div>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  이 프로그램에 대한 자세한 설명과 사용법을 확인하세요.
                </p>
                <a
                  href={`https://github.com/${program.github_repo}/${program.readme_path}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                >
                  <BookOpen className="w-5 h-5 mr-2" />
                  README 파일 보기
                  <ExternalLink className="w-4 h-4 ml-2" />
                </a>
              </div>
            )}

            {/* 최신 릴리즈 정보 */}
            {latestRelease && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                  최신 릴리즈
                </h2>
                <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {latestRelease.name || latestRelease.tag_name}
                    </h3>
                    <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                      <Calendar className="w-4 h-4 mr-1" />
                      {formatDate(latestRelease.published_at)}
                    </div>
                  </div>
                  
                  {latestRelease.body && (
                    <div className="prose dark:prose-invert max-w-none mb-4">
                      <ReactMarkdown>{latestRelease.body}</ReactMarkdown>
                    </div>
                  )}

                  {/* 다운로드 파일들 */}
                  {latestRelease.assets.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white mb-2">다운로드 파일</h4>
                      <div className="space-y-2">
                        {latestRelease.assets.map((asset) => (
                          <a
                            key={asset.id}
                            href={asset.browser_download_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                          >
                            <div className="flex items-center">
                              <FileDown className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-3" />
                              <div>
                                <p className="font-medium text-gray-900 dark:text-white">
                                  {asset.name}
                                </p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                  {formatFileSize(asset.size)} • {asset.download_count}회 다운로드
                                </p>
                              </div>
                            </div>
                            <ExternalLink className="w-4 h-4 text-gray-400" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 모든 릴리즈 */}
            {releases.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    릴리즈 히스토리
                  </h2>
                  <button
                    onClick={() => setShowAllReleases(!showAllReleases)}
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
                  >
                    {showAllReleases ? '간단히 보기' : '전체 보기'}
                  </button>
                </div>

                <div className="space-y-4">
                  {(showAllReleases ? releases : releases.slice(0, 3)).map((release) => (
                    <div
                      key={release.id}
                      className="border border-gray-200 dark:border-gray-600 rounded-lg p-4"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900 dark:text-white">
                            {release.name || release.tag_name}
                          </h3>
                          {release.prerelease && (
                            <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 text-xs rounded">
                              Pre-release
                            </span>
                          )}
                        </div>
                        <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                          <Calendar className="w-4 h-4 mr-1" />
                          {formatDate(release.published_at)}
                        </div>
                      </div>

                      {showAllReleases && release.body && (
                        <div className="prose dark:prose-invert max-w-none text-sm mb-3">
                          <ReactMarkdown>{release.body}</ReactMarkdown>
                        </div>
                      )}

                      <div className="flex items-center gap-4">
                        <a
                          href={release.html_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm"
                        >
                          <ExternalLink className="w-4 h-4 mr-1" />
                          GitHub에서 보기
                        </a>
                        {release.assets.length > 0 && (
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            <Package className="w-4 h-4 inline mr-1" />
                            {release.assets.length}개 파일
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 사이드바 */}
          <div className="space-y-6">
            {/* 프로그램 정보 */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                프로그램 정보
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">카테고리</span>
                  <span className={`px-2 py-1 rounded text-sm ${getCategoryColor(program.category as ProgramCategory)}`}>
                    {program.category}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">등록일</span>
                  <span className="text-gray-900 dark:text-white text-sm">
                    {formatDate(program.created_at)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">최종 업데이트</span>
                  <span className="text-gray-900 dark:text-white text-sm">
                    {formatDate(program.updated_at)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">GitHub 저장소</span>
                  <a
                    href={`https://github.com/${program.github_repo}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm flex items-center"
                  >
                    {program.github_repo}
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </a>
                </div>
              </div>
            </div>

            {/* 릴리즈 통계 */}
            {!releasesLoading && releases.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                  릴리즈 통계
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400">총 릴리즈</span>
                    <span className="text-gray-900 dark:text-white font-medium">
                      {releases.length}개
                    </span>
                  </div>
                  {latestRelease && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600 dark:text-gray-400">최신 버전</span>
                        <span className="text-gray-900 dark:text-white font-medium">
                          {latestRelease.tag_name}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600 dark:text-gray-400">총 다운로드</span>
                        <span className="text-gray-900 dark:text-white font-medium">
                          {latestRelease.assets.reduce((total, asset) => total + asset.download_count, 0)}회
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
