'use client';

import { useState, useMemo } from 'react';
import { fetchApiServerLogs, fetchCrawlerLogs } from '@/src/modules/admin-api-server';
import { parsePinoLogs, calculateLogStatistics, ParsedLogEntry } from './utils/pinoLogParser';
import StatisticsCards from './components/StatisticsCards';
import LogCharts from './components/LogCharts';
import LogsTable from './components/LogsTable';
import LogDetailModal from './components/LogDetailModal';
import { BarChart3, Table2, FileText, Download, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/src/app/components/ui/button';

type LogType = 'api-server' | 'crawler';
type ViewMode = 'dashboard' | 'table' | 'raw';

export default function LogsViewer() {
  const [logType, setLogType] = useState<LogType>('api-server');
  const [date, setDate] = useState('');
  const [rawLogs, setRawLogs] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [selectedLog, setSelectedLog] = useState<ParsedLogEntry | null>(null);

  const parsedLogs = useMemo<ParsedLogEntry[]>(() => {
    if (!rawLogs) return [];
    return parsePinoLogs(rawLogs);
  }, [rawLogs]);

  const statistics = useMemo(() => {
    return calculateLogStatistics(parsedLogs);
  }, [parsedLogs]);

  const handleFetchLogs = async () => {
    setLoading(true);
    setError('');
    setRawLogs('');

    try {
      const data = logType === 'api-server' 
        ? await fetchApiServerLogs(date || undefined)
        : await fetchCrawlerLogs(date || undefined);
      setRawLogs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleExportData = () => {
    const data = {
      metadata: {
        logType,
        date: date || new Date().toISOString().split('T')[0],
        exportedAt: new Date().toISOString(),
        totalLogs: parsedLogs.length,
      },
      statistics,
      logs: parsedLogs,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-${logType}-${date || 'today'}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-[1600px]">
      {/* Header */}
      <div className="mb-6">
        <Link href={'/admin/api-server'} className="mb-4 flex">
          <Button variant="outline">
            <ArrowLeft />
            api-server admin 홈으로 이동
          </Button>
        </Link>
        <h1 className="text-3xl font-bold mb-2 dark:text-gray-100">
          Pino Logs Dashboard
        </h1>
        <p className="text-gray-600 dark:text-gray-300">
          API Server 및 Crawler 로그 분석 및 관리
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-4 bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-200 rounded-lg">
          {error}
        </div>
      )}

      {/* Controls */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6 border border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label htmlFor="logType" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              로그 타입
            </label>
            <select
              id="logType"
              value={logType}
              onChange={(e) => setLogType(e.target.value as LogType)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="api-server">API Server</option>
              <option value="crawler">Crawler</option>
            </select>
          </div>

          <div>
            <label htmlFor="date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              날짜 (YYYY-MM-DD)
            </label>
            <input
              type="date"
              id="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              placeholder={formatDate()}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={handleFetchLogs}
              disabled={loading}
              className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400 dark:disabled:bg-gray-600 transition-colors"
            >
              {loading ? '로딩중...' : '로그 조회'}
            </button>
          </div>

          
        </div>

        <div className="text-sm text-gray-500 dark:text-gray-400">
          * 날짜를 입력하지 않으면 오늘 날짜의 로그를 조회합니다.
        </div>
      </div>

      {/* View Mode Tabs */}
      {parsedLogs.length > 0 && (
        <div className="mb-6">
          <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setViewMode('dashboard')}
              className={`px-4 py-2 font-medium transition-colors flex items-center gap-2 ${
                viewMode === 'dashboard'
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              Dashboard
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-4 py-2 font-medium transition-colors flex items-center gap-2 ${
                viewMode === 'table'
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <Table2 className="w-4 h-4" />
              Table View
            </button>
            <button
              onClick={() => setViewMode('raw')}
              className={`px-4 py-2 font-medium transition-colors flex items-center gap-2 ${
                viewMode === 'raw'
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <FileText className="w-4 h-4" />
              Raw Logs
            </button>
          </div>
        </div>
      )}

      {/* Content Based on View Mode */}
      {parsedLogs.length > 0 && viewMode === 'dashboard' && (
        <div className="space-y-6">
          <StatisticsCards statistics={statistics} />
          <LogCharts statistics={statistics} />
        </div>
      )}

      {parsedLogs.length > 0 && viewMode === 'table' && (
        <LogsTable logs={parsedLogs} onLogClick={setSelectedLog} />
      )}

      {parsedLogs.length > 0 && viewMode === 'raw' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold dark:text-gray-100">
              {logType === 'api-server' ? 'API Server' : 'Crawler'} 로그
              {date && ` (${date})`}
            </h2>
            {parsedLogs.length > 0 && (
              <div className="flex items-end">
                <button
                  onClick={handleExportData}
                  className="w-full px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Export JSON
                </button>
              </div>
            )}
          </div>
          <pre className="bg-gray-900 dark:bg-gray-950 text-gray-100 dark:text-gray-200 p-4 rounded overflow-x-auto text-sm whitespace-pre-wrap break-words max-h-[600px] overflow-y-auto border border-gray-700 dark:border-gray-600">
            {rawLogs}
          </pre>
        </div>
      )}

      {/* Empty State */}
      {!rawLogs && !loading && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center border border-gray-200 dark:border-gray-700">
          <BarChart3 className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <p className="text-gray-500 dark:text-gray-400 text-lg">
            로그 타입과 날짜를 선택한 후 &quot;로그 조회&quot; 버튼을 클릭하세요.
          </p>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">
            대시보드에서 로그를 분석하고 시각화할 수 있습니다.
          </p>
        </div>
      )}

      {/* Log Detail Modal */}
      <LogDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />
    </div>
  );
}
