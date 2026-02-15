/**
 * Statistics Cards Component
 * Displays key metrics from log analysis in card format
 */

'use client';

import { LogStatistics } from '../utils/pinoLogParser';
import { Activity, CheckCircle, XCircle, Clock, TrendingUp, Zap } from 'lucide-react';

interface StatisticsCardsProps {
  statistics: LogStatistics;
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  description?: string;
  trend?: 'up' | 'down' | 'neutral';
  colorClass?: string;
}

function StatCard({ title, value, icon, description, colorClass = 'bg-blue-500' }: StatCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</h3>
        <div className={`${colorClass} p-2 rounded-lg`}>
          {icon}
        </div>
      </div>
      <div className="mt-2">
        <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
        {description && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{description}</p>
        )}
      </div>
    </div>
  );
}

export default function StatisticsCards({ statistics }: StatisticsCardsProps) {
  const successRate = statistics.totalRequests > 0
    ? ((statistics.successCount / statistics.totalRequests) * 100).toFixed(1)
    : '0.0';

  const errorRate = statistics.totalRequests > 0
    ? ((statistics.errorCount / statistics.totalRequests) * 100).toFixed(1)
    : '0.0';

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
      <StatCard
        title="Total Logs"
        value={statistics.totalRequests.toLocaleString()}
        icon={<Activity className="w-5 h-5 text-white" />}
        colorClass="bg-blue-500"
        description={`${statistics.httpRequests} HTTP, ${statistics.nonHttpLogs} app logs`}
      />
      
      <StatCard
        title="Success Rate"
        value={`${successRate}%`}
        icon={<CheckCircle className="w-5 h-5 text-white" />}
        colorClass="bg-green-500"
        description={`${statistics.successCount} successful`}
      />
      
      <StatCard
        title="Error Rate"
        value={`${errorRate}%`}
        icon={<XCircle className="w-5 h-5 text-white" />}
        colorClass="bg-red-500"
        description={`${statistics.errorCount} errors`}
      />
      
      <StatCard
        title="Avg Response Time"
        value={statistics.avgResponseTime > 0 ? `${statistics.avgResponseTime}ms` : 'N/A'}
        icon={<Clock className="w-5 h-5 text-white" />}
        colorClass="bg-yellow-500"
        description={statistics.avgResponseTime > 0 ? "Average duration" : "No HTTP logs"}
      />
      
      <StatCard
        title="Max Response Time"
        value={statistics.maxResponseTime > 0 ? `${statistics.maxResponseTime}ms` : 'N/A'}
        icon={<TrendingUp className="w-5 h-5 text-white" />}
        colorClass="bg-orange-500"
        description={statistics.maxResponseTime > 0 ? "Slowest request" : "No HTTP logs"}
      />
      
      <StatCard
        title="Min Response Time"
        value={statistics.minResponseTime > 0 ? `${statistics.minResponseTime}ms` : 'N/A'}
        icon={<Zap className="w-5 h-5 text-white" />}
        colorClass="bg-purple-500"
        description={statistics.minResponseTime > 0 ? "Fastest request" : "No HTTP logs"}
      />
    </div>
  );
}
