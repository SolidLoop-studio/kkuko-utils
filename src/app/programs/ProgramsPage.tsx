'use client';

import { useState, useEffect } from 'react';
import { Program, ProgramCategory } from '@/src/app/types/program';
import { PROGRAM_CATEGORIES, getCategoryColor } from '@/src/app/lib/programUtils';
import { Download, Github, Tag, Calendar, Search, Filter, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { formatDate } from '@/src/app/lib/programUtils';
import useSWR, { mutate } from 'swr';
import axios from 'axios';

const programsFetcher = async (category: string): Promise<{data: null, error: FetchError} | {data: { programs: Program[] }, error: null}> => {
  try {
    const params = new URLSearchParams();
    if (category !== 'all') params.append('category', category);

    const res = await axios.get<{ programs: Program[] }>('/api/programs', { params });

    if (res.status !== 200) {
      return { data: null, error: { name: 'FetchError', httpCode: res.status, message: '프로그램 목록을 불러오는 데 실패했습니다', stackTrace: new Error().stack } };
    }

    return { data: res.data, error: null };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      return { data: null, error: { name: 'FetchError', httpCode: error.response.status, message: '프로그램 목록을 불러오는 데 실패했습니다', stackTrace: error.stack, data: error.response.data } };
    }
    return { data: null, error: { name: 'FetchError', httpCode: null, message: '프로그램 목록을 불러오는 데 실패했습니다', stackTrace: error instanceof Error ? error.stack : undefined } };
  }

};


export default function ProgramsPage() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { data, isLoading } = useSWR(`/api/programs?${selectedCategory}`, () => programsFetcher(selectedCategory), { dedupingInterval: 300_000 });

  useEffect(() => {
    const updateFunc = async () => {
      if (data){
        if (data.error){
          setError(data.error.message);
        }
        else if (data.data){
          setPrograms(data.data.programs);
          setError(null);
        }
      }
    }
    updateFunc()
  }, [data])


  const filteredPrograms = programs.filter(program =>
    program.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    program.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    program.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-900 dark:to-slate-900">
        <div className="container mx-auto px-6 py-12">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-gray-600 dark:text-gray-400">프로그램 목록을 불러오는 중...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
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
                onClick={() => mutate(`/api/programs?${selectedCategory}`)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                다시 시도
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
        {/* 헤더 */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            끄투코리아 프로그램 모음
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
            끄투코리아에서 사용할 수 있는 다양한 프로그램들을 소개합니다.
            각 프로그램의 최신 릴리즈 정보와 다운로드 링크를 확인하세요.
          </p>
        </div>

        {/* 검색 및 필터 */}
        <div className="mb-8 space-y-4">
          {/* 검색 */}
          <div className="relative max-w-md mx-auto">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="프로그램 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>

          {/* 카테고리 필터 */}
          <div className="flex flex-wrap justify-center gap-2">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${selectedCategory === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
            >
              <Filter className="w-4 h-4 inline mr-1" />
              전체
            </button>
            {PROGRAM_CATEGORIES.map((category) => (
              <button
                key={category.value}
                onClick={() => setSelectedCategory(category.param)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${selectedCategory === category.param
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
              >
                {category.label}
              </button>
            ))}
          </div>
        </div>

        {/* 프로그램 목록 */}
        {filteredPrograms.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              프로그램을 찾을 수 없습니다
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              다른 검색어나 카테고리를 시도해보세요.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPrograms.map((program) => (
              <div
                key={program.id}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-200 dark:border-gray-700 overflow-hidden group"
              >
                <div className="p-6">
                  {/* 카테고리 배지 */}
                  <div className="flex items-center justify-between mb-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getCategoryColor(program.category as ProgramCategory)}`}>
                      {program.category}
                    </span>
                    <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                      <Calendar className="w-4 h-4 mr-1" />
                      {formatDate(program.created_at)}
                    </div>
                  </div>

                  {/* 프로그램 정보 */}
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {program.name}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4 line-clamp-3">
                    {program.description}
                  </p>

                  {/* 태그 */}
                  {program.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-4">
                      {program.tags.slice(0, 3).map((tag, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded-md"
                        >
                          <Tag className="w-3 h-3 mr-1" />
                          {tag}
                        </span>
                      ))}
                      {program.tags.length > 3 && (
                        <span className="inline-flex items-center px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded-md">
                          +{program.tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}

                  {/* 액션 버튼 */}
                  <div className="flex gap-2">
                    <Link
                      href={`/programs/${program.id}`}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-center text-sm font-medium transition-colors flex items-center justify-center"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      다운로드
                    </Link>
                    <a
                      href={`https://github.com/${program.github_repo}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center"
                    >
                      <Github className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
