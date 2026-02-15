/**
 * Log Detail Modal Component
 * Displays comprehensive details of a single log entry
 */

'use client';

import { ParsedLogEntry } from '../utils/pinoLogParser';
import { X, Calendar, Activity, Globe, AlertCircle, Code, Database } from 'lucide-react';

interface LogDetailModalProps {
  log: ParsedLogEntry | null;
  onClose: () => void;
}

export default function LogDetailModal({ log, onClose }: LogDetailModalProps) {
  if (!log) return null;

  const getLevelColor = (level: string) => {
    const colors: Record<string, string> = {
      TRACE: 'text-gray-500 bg-gray-100 dark:bg-gray-700',
      DEBUG: 'text-blue-500 bg-blue-100 dark:bg-blue-900',
      INFO: 'text-green-500 bg-green-100 dark:bg-green-900',
      WARN: 'text-yellow-500 bg-yellow-100 dark:bg-yellow-900',
      ERROR: 'text-red-500 bg-red-100 dark:bg-red-900',
      FATAL: 'text-red-700 bg-red-200 dark:bg-red-800',
    };
    return colors[level] || 'text-gray-500 bg-gray-100 dark:bg-gray-700';
  };

  const getStatusColor = (status?: number) => {
    if (!status) return 'text-gray-500';
    if (status >= 200 && status < 300) return 'text-green-600 dark:text-green-400';
    if (status >= 300 && status < 400) return 'text-blue-600 dark:text-blue-400';
    if (status >= 400 && status < 500) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const formatJSON = (obj: unknown) => {
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return String(obj);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Activity className="w-6 h-6 text-blue-500" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Log Entry Details
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-gray-400 mt-1" />
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Timestamp</p>
                <p className="text-base font-mono text-gray-900 dark:text-gray-100">
                  {log.timestamp.toLocaleString()}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {log.timestamp.toISOString()}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Activity className="w-5 h-5 text-gray-400 mt-1" />
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Log Level</p>
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${getLevelColor(log.levelName)}`}>
                  {log.levelName}
                </span>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Database className="w-5 h-5 text-gray-400 mt-1" />
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Process ID</p>
                <p className="text-base font-mono text-gray-900 dark:text-gray-100">{log.pid}</p>
              </div>
            </div>

            {log.hostname && (
              <div className="flex items-start gap-3">
                <Globe className="w-5 h-5 text-gray-400 mt-1" />
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Hostname</p>
                  <p className="text-base font-mono text-gray-900 dark:text-gray-100">{log.hostname}</p>
                </div>
              </div>
            )}
          </div>

          {/* Log Type Badge */}
          <div className="flex items-center gap-2">
            <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
              log.isHttpLog 
                ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200'
                : 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-200'
            }`}>
              {log.isHttpLog ? 'HTTP Request Log' : 'Application Log'}
            </span>
          </div>

          {/* Message */}
          {log.msg && (
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Message</p>
              <p className="text-gray-900 dark:text-gray-100">{log.msg}</p>
            </div>
          )}

          {/* HTTP Request Details */}
          {log.isHttpLog && (
            <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                <Globe className="w-5 h-5" />
                HTTP Request
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {log.method && (
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Method</p>
                    <p className="text-base font-mono font-semibold text-gray-900 dark:text-gray-100">
                      {log.method}
                    </p>
                  </div>
                )}
                {log.statusCode && (
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Status Code</p>
                    <p className={`text-base font-mono font-semibold ${getStatusColor(log.statusCode)}`}>
                      {log.statusCode}
                    </p>
                  </div>
                )}
                {log.duration !== undefined && (
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Response Time</p>
                    <p className="text-base font-mono text-gray-900 dark:text-gray-100">
                      {log.duration}ms
                    </p>
                  </div>
                )}
                {log.url && (
                  <div className="col-span-2">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">URL</p>
                    <p className="text-base font-mono text-gray-900 dark:text-gray-100 break-all">
                      {log.url}
                    </p>
                  </div>
                )}
              </div>

              {/* Request Details */}
              {log.req && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Request Details</p>
                  <div className="bg-white dark:bg-gray-800 rounded p-3 text-xs">
                    {log.req.remoteAddress && (
                      <p className="text-gray-700 dark:text-gray-300">
                        <span className="font-semibold">Remote:</span> {log.req.remoteAddress}
                        {log.req.remotePort && `:${log.req.remotePort}`}
                      </p>
                    )}
                    {log.req.id && (
                      <p className="text-gray-700 dark:text-gray-300">
                        <span className="font-semibold">Request ID:</span> {log.req.id}
                      </p>
                    )}
                    {log.req.headers && (
                      <details className="mt-2">
                        <summary className="cursor-pointer font-semibold text-gray-700 dark:text-gray-300">
                          Headers
                        </summary>
                        <pre className="mt-2 text-gray-600 dark:text-gray-400 overflow-x-auto">
                          {formatJSON(log.req.headers)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              )}

              {/* Response Details */}
              {log.res && log.res.headers && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Response Headers</p>
                  <div className="bg-white dark:bg-gray-800 rounded p-3">
                    <pre className="text-xs text-gray-600 dark:text-gray-400 overflow-x-auto">
                      {formatJSON(log.res.headers)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Error Details */}
          {log.err && (
            <div className="bg-red-50 dark:bg-red-950 rounded-lg p-4 border border-red-200 dark:border-red-800">
              <h3 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-4 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Error Details
              </h3>
              <div className="space-y-3">
                {log.err.type && (
                  <div>
                    <p className="text-sm font-medium text-red-700 dark:text-red-300">Type</p>
                    <p className="text-base font-mono text-red-900 dark:text-red-100">{log.err.type}</p>
                  </div>
                )}
                {log.err.message && (
                  <div>
                    <p className="text-sm font-medium text-red-700 dark:text-red-300">Message</p>
                    <p className="text-base text-red-900 dark:text-red-100">{log.err.message}</p>
                  </div>
                )}
                {log.err.stack && (
                  <div>
                    <p className="text-sm font-medium text-red-700 dark:text-red-300 mb-2">Stack Trace</p>
                    <pre className="text-xs text-red-800 dark:text-red-200 bg-red-100 dark:bg-red-900 p-3 rounded overflow-x-auto whitespace-pre-wrap break-words">
                      {log.err.stack}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Custom Fields */}
          {Object.keys(log.customFields).length > 0 && (
            <div className="bg-purple-50 dark:bg-purple-950 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                <Code className="w-5 h-5" />
                Custom Fields
              </h3>
              <pre className="text-sm text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-800 p-3 rounded overflow-x-auto">
                {formatJSON(log.customFields)}
              </pre>
            </div>
          )}

          {/* Raw Log Data */}
          <details className="bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
            <summary className="cursor-pointer p-4 font-semibold text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              View Raw Log Data (JSON)
            </summary>
            <div className="p-4 pt-0">
              <pre className="text-xs text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 p-3 rounded overflow-x-auto max-h-96">
                {formatJSON(log)}
              </pre>
            </div>
          </details>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => {
              navigator.clipboard.writeText(formatJSON(log));
              alert('Log data copied to clipboard!');
            }}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
          >
            Copy JSON
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
