/**
 * Logs Table Component
 * Displays parsed log entries in a sortable, filterable table with virtualization
 */

'use client';

import { useState, useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ParsedLogEntry } from '../utils/pinoLogParser';
import { ArrowUpDown, ArrowUp, ArrowDown, Filter, Search } from 'lucide-react';

interface LogsTableProps {
  logs: ParsedLogEntry[];
  maxRows?: number;
  onLogClick?: (log: ParsedLogEntry) => void;
}

type SortField = 'timestamp' | 'level' | 'method' | 'url' | 'statusCode' | 'duration';
type SortDirection = 'asc' | 'desc';

export default function LogsTable({ logs, maxRows = 10000, onLogClick }: LogsTableProps) {
  const [sortField, setSortField] = useState<SortField>('timestamp');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const tableContainerRef = useRef<HTMLDivElement>(null);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const filteredAndSortedLogs = useMemo(() => {
    let filtered = [...logs];

    // Filter by level
    if (filterLevel !== 'all') {
      filtered = filtered.filter(log => log.levelName === filterLevel);
    }

    // Filter by status code
    if (filterStatus !== 'all') {
      if (filterStatus === '2xx') {
        filtered = filtered.filter(log => log.statusCode && log.statusCode >= 200 && log.statusCode < 300);
      } else if (filterStatus === '4xx') {
        filtered = filtered.filter(log => log.statusCode && log.statusCode >= 400 && log.statusCode < 500);
      } else if (filterStatus === '5xx') {
        filtered = filtered.filter(log => log.statusCode && log.statusCode >= 500);
      }
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(log =>
        log.url?.toLowerCase().includes(query) ||
        log.method?.toLowerCase().includes(query) ||
        log.msg?.toLowerCase().includes(query)
      );
    }

    // Sort
    filtered.sort((a, b) => {
      let aVal: string | number | Date | undefined = a[sortField];
      let bVal: string | number | Date | undefined = b[sortField];

      if (sortField === 'timestamp') {
        aVal = a.timestamp.getTime();
        bVal = b.timestamp.getTime();
      }

      if (aVal === undefined) return 1;
      if (bVal === undefined) return -1;

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered.slice(0, maxRows);
  }, [logs, sortField, sortDirection, filterLevel, filterStatus, searchQuery, maxRows]);

  // Virtual scrolling setup
  const rowVirtualizer = useVirtualizer({
    count: filteredAndSortedLogs.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 45, // Estimated row height in pixels
    overscan: 10, // Number of items to render outside visible area
  });

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-4 h-4" />;
    return sortDirection === 'asc' 
      ? <ArrowUp className="w-4 h-4" />
      : <ArrowDown className="w-4 h-4" />;
  };

  const getLevelColor = (level: string) => {
    const colors: Record<string, string> = {
      TRACE: 'text-gray-500',
      DEBUG: 'text-blue-500',
      INFO: 'text-green-500',
      WARN: 'text-yellow-500',
      ERROR: 'text-red-500',
      FATAL: 'text-red-700 font-bold',
    };
    return colors[level] || 'text-gray-500';
  };

  const getStatusColor = (status?: number) => {
    if (!status) return 'text-gray-500';
    if (status >= 200 && status < 300) return 'text-green-600';
    if (status >= 300 && status < 400) return 'text-blue-600';
    if (status >= 400 && status < 500) return 'text-yellow-600';
    return 'text-red-600';
  };

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom = virtualRows.length > 0 ? totalSize - virtualRows[virtualRows.length - 1].end : 0;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
      {/* Filters */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filters:</span>
          </div>

          <select
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value)}
            className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          >
            <option value="all">All Levels</option>
            <option value="TRACE">TRACE</option>
            <option value="DEBUG">DEBUG</option>
            <option value="INFO">INFO</option>
            <option value="WARN">WARN</option>
            <option value="ERROR">ERROR</option>
            <option value="FATAL">FATAL</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          >
            <option value="all">All Status</option>
            <option value="2xx">2xx Success</option>
            <option value="4xx">4xx Client Error</option>
            <option value="5xx">5xx Server Error</option>
          </select>

          <div className="flex-1 min-w-[200px] relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search URL, method, message..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>

          <span className="text-sm text-gray-500 dark:text-gray-400">
            Showing {filteredAndSortedLogs.length} of {logs.length} logs
          </span>
        </div>
      </div>

      {/* Virtualized Table */}
      <div 
        ref={tableContainerRef}
        className="overflow-auto"
        style={{ maxHeight: '600px' }}
      >
        <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">
              <tr>
                <th
                  onClick={() => handleSort('timestamp')}
                  className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <div className="flex items-center gap-2">
                    Timestamp
                    <SortIcon field="timestamp" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('level')}
                  className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <div className="flex items-center gap-2">
                    Level
                    <SortIcon field="level" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('method')}
                  className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <div className="flex items-center gap-2">
                    Method
                    <SortIcon field="method" />
                  </div>
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">
                  URL / Message
                </th>
                <th
                  onClick={() => handleSort('statusCode')}
                  className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <div className="flex items-center gap-2">
                    Status
                    <SortIcon field="statusCode" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('duration')}
                  className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <div className="flex items-center gap-2">
                    Duration
                    <SortIcon field="duration" />
                  </div>
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">
                  Message
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-500 dark:text-gray-400">
                    No logs found matching your filters
                  </td>
                </tr>
              ) : (
                <>
                  {paddingTop > 0 && (
                    <tr>
                      <td style={{ height: `${paddingTop}px` }} />
                    </tr>
                  )}
                  {virtualRows.map((virtualRow) => {
                    const log = filteredAndSortedLogs[virtualRow.index];
                    return (
                      <tr
                        key={virtualRow.index}
                        onClick={() => onLogClick?.(log)}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer border-b border-gray-200 dark:border-gray-700"
                        style={{ height: `${virtualRow.size}px` }}
                      >
                        <td className="px-4 py-3 whitespace-nowrap text-gray-600 dark:text-gray-400 font-mono text-xs">
                          {log.timestamp.toLocaleString()}
                        </td>
                        <td className={`px-4 py-3 whitespace-nowrap font-semibold ${getLevelColor(log.levelName)}`}>
                          {log.levelName}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-gray-900 dark:text-gray-100 font-mono">
                          {log.method || '-'}
                        </td>
                        <td className="px-4 py-3 text-gray-900 dark:text-gray-100 font-mono text-xs max-w-xs truncate">
                          {log.url || log.msg || '-'}
                        </td>
                        <td className={`px-4 py-3 whitespace-nowrap font-semibold ${getStatusColor(log.statusCode)}`}>
                          {log.statusCode || '-'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-gray-900 dark:text-gray-100">
                          {log.duration !== undefined ? `${log.duration}ms` : '-'}
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400 max-w-md truncate">
                          {log.msg || log.err?.message || '-'}
                        </td>
                      </tr>
                    );
                  })}
                  {paddingBottom > 0 && (
                    <tr>
                      <td style={{ height: `${paddingBottom}px` }} />
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
      </div>
    </div>
  );
}
