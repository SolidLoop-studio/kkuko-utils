/**
 * Charts Component
 * Visualizes log data using various chart types from recharts
 */

'use client';

import {
    BarChart,
    Bar,
    LineChart,
    Line,
    AreaChart,
    Area,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from 'recharts';
import { LogStatistics } from '../utils/pinoLogParser';

interface LogChartsProps {
    statistics: LogStatistics;
}

const COLORS = {
    primary: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'],
    status: {
        '2xx': '#10b981',
        '3xx': '#3b82f6',
        '4xx': '#f59e0b',
        '5xx': '#ef4444',
    },
};

export default function LogCharts({ statistics }: LogChartsProps) {
    // Prepare method distribution data
    const methodData = Object.entries(statistics.methodDistribution).map(([method, count]) => ({
        name: method,
        value: count,
        count,
    }));

    // Prepare status code distribution data
    const statusData = Object.entries(statistics.statusCodeDistribution)
        .map(([code, count]) => ({
            name: code,
            value: count,
            count,
            fill: getStatusColor(parseInt(code)),
        }))
        .sort((a, b) => parseInt(a.name) - parseInt(b.name));

    // Prepare hourly distribution data
    const hourlyData = Object.entries(statistics.hourlyDistribution)
        .map(([hour, count]) => ({
            hour: `${hour}:00`,
            requests: count,
        }))
        .sort((a, b) => a.hour.localeCompare(b.hour));

    // Prepare error type data
    const errorData = Object.entries(statistics.errorsByType)
        .map(([type, count]) => ({
            name: type,
            value: count,
            count,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10); // Top 10 errors

    // Prepare level distribution data
    const levelData = Object.entries(statistics.levelDistribution)
        .map(([level, count]) => ({
            name: level,
            value: count,
            count,
            fill: getLevelColor(level),
        }))
        .sort((a, b) => {
            const order = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'];
            return order.indexOf(a.name) - order.indexOf(b.name);
        });

    // Prepare timeline data (log levels over time)
    const allHours = Array.from(
        new Set([
            ...Object.keys(statistics.hourlyDistribution),
            ...Object.values(statistics.timelineByLevel).flatMap(level => Object.keys(level))
        ])
    ).sort();

    const timelineData = allHours.map(hour => {
        const dataPoint: Record<string, string | number> = { hour: `${hour}:00` };
        
        // Add count for each log level at this hour
        Object.entries(statistics.timelineByLevel).forEach(([level, hourData]) => {
            dataPoint[level] = hourData[hour] || 0;
        });
        
        return dataPoint;
    });

    const logLevels = Object.keys(statistics.timelineByLevel).sort((a, b) => {
        const order = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'];
        return order.indexOf(a) - order.indexOf(b);
    });

    function getLevelColor(level: string): string {
        const colors: Record<string, string> = {
            TRACE: '#6b7280',
            DEBUG: '#3b82f6',
            INFO: '#10b981',
            WARN: '#f59e0b',
            ERROR: '#ef4444',
            FATAL: '#7f1d1d',
        };
        return colors[level] || '#6b7280';
    }

    function getStatusColor(code: number): string {
        if (code >= 200 && code < 300) return COLORS.status['2xx'];
        if (code >= 300 && code < 400) return COLORS.status['3xx'];
        if (code >= 400 && code < 500) return COLORS.status['4xx'];
        return COLORS.status['5xx'];
    }

    interface TooltipPayload {
        name: string;
        value: number;
        [key: string]: unknown;
    }

    interface TooltipProps {
        active?: boolean;
        payload?: TooltipPayload[];
        label?: string;
    }

    const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{label}</p>
                    {payload.map((entry, index: number) => (
                        <p key={index} className="text-sm text-gray-600 dark:text-gray-400">
                            {entry.name}: <span className="font-semibold">{entry.value}</span>
                        </p>
                    ))}
                </div>
            );
        }
        return null;
    };

    return (
        <div className="space-y-6">
            {/* Log Timeline */}
            {timelineData.length > 0 && logLevels.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                        Log Timeline by Level
                    </h3>
                    <ResponsiveContainer width="100%" height={400}>
                        <AreaChart data={timelineData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis
                                dataKey="hour"
                                stroke="#9ca3af"
                                style={{ fontSize: '12px' }}
                            />
                            <YAxis stroke="#9ca3af" style={{ fontSize: '12px' }} />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend />
                            {logLevels.map((level, idx) => (
                                <Area
                                    key={level}
                                    type="monotone"
                                    dataKey={level}
                                    stroke={getLevelColor(level)}
                                    fill={getLevelColor(level)}
                                    strokeWidth={2}
                                    fillOpacity={0.18 + idx * 0.02}
                                    dot={false}
                                    name={level}
                                />
                            ))}
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* Request Distribution Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Hourly Distribution */}
                {hourlyData.length > 0 && (
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                            Hourly Request Distribution
                        </h3>
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={hourlyData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                <XAxis
                                    dataKey="hour"
                                    stroke="#9ca3af"
                                    style={{ fontSize: '12px' }}
                                />
                                <YAxis stroke="#9ca3af" style={{ fontSize: '12px' }} />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend />
                                <Line
                                    type="monotone"
                                    dataKey="requests"
                                    stroke="#3b82f6"
                                    strokeWidth={2}
                                    dot={{ fill: '#3b82f6', r: 4 }}
                                    activeDot={{ r: 6 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                )}

                {/* Log Level Distribution */}
                {levelData.length > 0 && (
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                            Log Level Distribution
                        </h3>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={levelData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                <XAxis
                                    dataKey="name"
                                    stroke="#9ca3af"
                                    style={{ fontSize: '12px' }}
                                />
                                <YAxis stroke="#9ca3af" style={{ fontSize: '12px' }} />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend />
                                <Bar dataKey="count" name="Logs">
                                    {levelData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>

            {/* Method and Status Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* HTTP Method Distribution */}
                {methodData.length > 0 && (
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                            HTTP Method Distribution
                        </h3>
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={methodData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ name, percent }) =>
                                        `${name} (${(percent * 100).toFixed(0)}%)`
                                    }
                                    outerRadius={100}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    {methodData.map((entry, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={COLORS.primary[index % COLORS.primary.length]}
                                        />
                                    ))}
                                </Pie>
                                <Tooltip content={<CustomTooltip />} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                )}

                {/* Status Code Distribution */}
                {statusData.length > 0 && (
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                            Status Code Distribution
                        </h3>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={statusData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                <XAxis
                                    dataKey="name"
                                    stroke="#9ca3af"
                                    style={{ fontSize: '12px' }}
                                />
                                <YAxis stroke="#9ca3af" style={{ fontSize: '12px' }} />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend />
                                <Bar dataKey="count" name="Requests">
                                    {statusData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>

            {/* Status Code and Error Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">


                {/* Error Type Distribution */}
                {errorData.length > 0 && (
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                            Top Error Types
                        </h3>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={errorData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                <XAxis type="number" stroke="#9ca3af" style={{ fontSize: '12px' }} />
                                <YAxis
                                    type="category"
                                    dataKey="name"
                                    stroke="#9ca3af"
                                    style={{ fontSize: '12px' }}
                                    width={120}
                                />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend />
                                <Bar dataKey="count" fill="#ef4444" name="Errors" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>

            {/* Success vs Error Chart */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                    Success vs Error Rate
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                        <Pie
                            data={[
                                { name: 'Success', value: statistics.successCount },
                                { name: 'Error', value: statistics.errorCount },
                            ]}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent, value }) =>
                                `${name}: ${value} (${(percent * 100).toFixed(1)}%)`
                            }
                            outerRadius={100}
                            fill="#8884d8"
                            dataKey="value"
                        >
                            <Cell fill="#10b981" />
                            <Cell fill="#ef4444" />
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
