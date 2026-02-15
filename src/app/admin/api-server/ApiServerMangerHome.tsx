'use client';
import { Button } from "@/src/app/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from 'next/link';

export default function ApiServerAdminHome() {
  const sections = [
    {
      title: 'Crawler 관리',
      description: '크롤러 Health 상태 확인 및 세션 관리',
      href: '/admin/api-server/crawler',
    },
    {
      title: 'Logs 조회',
      description: 'API Server 및 Crawler 로그 조회',
      href: '/admin/api-server/logs',
    },
    {
      title: 'Items 관리',
      description: '아이템 상태 확인 및 수정',
      href: '/admin/api-server/items',
    }
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 관리자 대시보드로 이동 버튼 */}
      <Link href={'/admin'} className="mb-4 flex">
          <Button variant="outline">
              <ArrowLeft />
              관리자 대시보드로 이동
          </Button>
      </Link>
      <h1 className="text-3xl font-bold mb-2 dark:text-gray-100">API Server 관리</h1>
      <p className="text-gray-600 dark:text-gray-300 mb-8">API 서버 관리 도구</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {sections.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="block p-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400 hover:shadow-lg transition-all"
          >
            <h2 className="text-xl font-semibold mb-2 dark:text-gray-100">{section.title}</h2>
            <p className="text-gray-600 dark:text-gray-300">{section.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}