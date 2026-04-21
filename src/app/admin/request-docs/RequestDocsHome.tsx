import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/src/app/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/src/app/components/ui/card';
import { Checkbox } from '@/src/app/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/app/components/ui/table';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/src/app/components/ui/pagination';
import { SCM } from '@/src/app/lib/supabaseClient';
import { PostgrestError } from '@supabase/supabase-js';
import ErrorModal from '@/src/app/components/ErrModal';
import Link from 'next/link';

type DocsWaitRequest = {id: number, req_at: string, docs_name: string, req_by: string | null, initial_consonant: boolean, req_byId: string | null}

export default function DocsWaitManager({initialData}: {initialData?: DocsWaitRequest[]}) {
  const [docsWaitRequests, setDocsWaitRequests] = useState<DocsWaitRequest[]>(initialData || []);
  const [selectedRequests, setSelectedRequests] = useState<Set<number>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [initialConsonantSettings, setInitialConsonantSettings] = useState<{ [key: number]: boolean }>({});
  const [showErrorMessage, setShowErrorMessage] = useState<ErrorMessage | null>(null);

  const itemsPerPage = 10;
  const totalPages = Math.ceil(docsWaitRequests.length / itemsPerPage);
  const currentRequests = docsWaitRequests.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const makeError = (error: PostgrestError) => {
    setShowErrorMessage({
      ErrName: error.name || "알 수 없음",
      ErrMessage: error.message || "없음",
      ErrStackRace: error.code || "알 수 없음",
      inputValue: "admin/request-docs",
    });
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  const toggleRequest = (id: number) => {
    setSelectedRequests(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedRequests.size === currentRequests.length) {
      setSelectedRequests(new Set());
    } else {
      setSelectedRequests(new Set(currentRequests.map(req => req.id)));
    }
  };

  const toggleInitialConsonant = (id: number) => {
    setInitialConsonantSettings(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const allSelected = currentRequests.length > 0 && selectedRequests.size === currentRequests.length;

  const approveSelected = async () => {
    const insertQuery = Array.from(selectedRequests).map(id => {
        const request = docsWaitRequests.find(req => req.id === id);
        if (!request) return null;
        return {
            name: request.docs_name,
            maker: request.req_byId,
            duem: initialConsonantSettings[id] || false,
            typez: "letter"
        };
    }).filter(item => item !== null) as { name: string; maker: string | null; duem: boolean; typez: "letter" }[];
    if (insertQuery.length === 0) return;
    const {error} = await SCM.add().docs(insertQuery);
    if (error) return makeError(error);
    const idsToRemove = Array.from(selectedRequests);
    const {error: deleteError} = await SCM.delete().waitDocsByIds(idsToRemove);
    if (deleteError) return makeError(deleteError);
    setDocsWaitRequests(prev => prev.filter(req => !idsToRemove.includes(req.id)));
    setSelectedRequests(new Set());
    setInitialConsonantSettings(prev => {
        const newSettings = {...prev};
        idsToRemove.forEach(id => delete newSettings[id]);
        return newSettings;
        }
    );
    setCurrentPage(1); // 페이지 초기화
    setShowErrorMessage(null); // 에러 메시지 초기화
  }

  const rejectSelected = async () => {
    const idsToReject = Array.from(selectedRequests);
    const {error} = await SCM.delete().waitDocsByIds(idsToReject);
    if (error) return makeError(error);

    setDocsWaitRequests(prev => prev.filter(req => !selectedRequests.has(req.id)));
    setSelectedRequests(new Set());
    setCurrentPage(1); // 페이지 초기화
    setShowErrorMessage(null); // 에러 메시지 초기화
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-100 to-gray-200 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto py-8">
        <div className="mb-4 flex">
          <Link href={'/admin'} className="mb-4 flex">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              관리자 대시보드로 이동
            </Button>
          </Link>
        </div>
        
        <Card className="w-full bg-white dark:bg-gray-800 border border-transparent dark:border-gray-700 shadow-sm">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-gray-100">문서 대기 관리자 페이지</CardTitle>
            <CardDescription className="dark:text-gray-300">
              문서 추가 요청을 승인하거나 거절할 수 있습니다.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <div className="flex justify-end mb-4 gap-2">
              <Button
                variant="outline"
                className="bg-green-100 hover:bg-green-200 dark:bg-green-900 dark:hover:bg-green-800"
                onClick={approveSelected}
                disabled={selectedRequests.size === 0}
              >
                선택 승인
              </Button>
              <Button
                variant="outline"
                className="bg-red-100 hover:bg-red-200 dark:bg-red-900 dark:hover:bg-red-800"
                onClick={rejectSelected}
                disabled={selectedRequests.size === 0}
              >
                선택 거절
              </Button>
            </div>

            <div className="border rounded-md dark:border-gray-700">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={toggleSelectAll}
                        aria-label="전체 선택"
                      />
                    </TableHead>
                    <TableHead className="w-16 text-gray-700 dark:text-gray-200">No.</TableHead>
                    <TableHead className="w-48 text-gray-700 dark:text-gray-200">문서명</TableHead>
                    <TableHead className="w-36 text-gray-700 dark:text-gray-200">요청자</TableHead>
                    <TableHead className="w-40 text-gray-700 dark:text-gray-200">요청 시간</TableHead>
                    <TableHead className="w-32 text-gray-700 dark:text-gray-200">두음 여부</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentRequests.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-4 text-gray-500 dark:text-gray-400">
                        요청이 없습니다.
                      </TableCell>
                    </TableRow>
                  ) : (
                    currentRequests.map((request) => (
                      <TableRow key={`r-${request.id}`} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                        <TableCell>
                          <Checkbox
                            checked={selectedRequests.has(request.id)}
                            onCheckedChange={() => toggleRequest(request.id)}
                            aria-label={`${request.docs_name} 선택`}
                          />
                        </TableCell>
                        <TableCell className="text-gray-900 dark:text-gray-100">{request.id}</TableCell>
                        <TableCell className="text-gray-900 dark:text-gray-100 font-medium">{request.docs_name}</TableCell>
                        <TableCell className="text-gray-700 dark:text-gray-200">{request.req_by}</TableCell>
                        <TableCell className="text-gray-700 dark:text-gray-200">{formatDate(request.req_at)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id={`initial-consonant-${request.id}`}
                              checked={initialConsonantSettings[request.id] ?? request.initial_consonant}
                              onCheckedChange={() => toggleInitialConsonant(request.id)}
                            />
                            <label 
                              htmlFor={`initial-consonant-${request.id}`} 
                              className="text-sm text-gray-700 dark:text-gray-200 cursor-pointer"
                            >
                              두음 적용
                            </label>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>

          <CardFooter>
            <div className="w-full">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>

                  {/* 페이지네이션 렌더링 - 최대 5개 버튼 표시 */}
                  {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                    let pageNum;

                    if (totalPages <= 5) {
                      // 5페이지 이하면 1부터 순차적으로
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      // 현재 페이지가 앞쪽이면 1~5 표시
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      // 현재 페이지가 뒤쪽이면 마지막 5개 표시
                      pageNum = totalPages - 4 + i;
                    } else {
                      // 중간이면 현재 페이지 중심으로 표시
                      pageNum = currentPage - 2 + i;
                    }

                    return (
                      <PaginationItem key={`p-${pageNum}`}>
                        <PaginationLink
                          isActive={currentPage === pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                        >
                          {pageNum}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  })}

                  <PaginationItem>
                    <PaginationNext
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          </CardFooter>
        </Card>
        {showErrorMessage && (
            <ErrorModal error={showErrorMessage} onClose={() => setShowErrorMessage(null)} />
        )}
      </div>
    </div>
  );
}