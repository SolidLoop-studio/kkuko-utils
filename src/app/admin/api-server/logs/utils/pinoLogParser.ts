/**
 * Pino Log Parser Utility
 * Parses Pino JSON log format and extracts meaningful data
 */

export interface PinoLogEntry {
  level: number;
  time: number;
  pid: number;
  hostname?: string;
  req?: {
    id?: string;
    method?: string;
    url?: string;
    headers?: Record<string, string>;
    remoteAddress?: string;
    remotePort?: number;
  };
  res?: {
    statusCode?: number;
    headers?: Record<string, string>;
  };
  responseTime?: number;
  msg?: string;
  err?: {
    type?: string;
    message?: string;
    stack?: string;
  };
  [key: string]: unknown;
}

export interface ParsedLogEntry extends PinoLogEntry {
  timestamp: Date;
  levelName: string;
  method?: string;
  url?: string;
  statusCode?: number;
  duration?: number;
  isHttpLog: boolean;
  customFields: Record<string, unknown>;
}

export interface LogStatistics {
  totalRequests: number;
  httpRequests: number;
  nonHttpLogs: number;
  successCount: number;
  errorCount: number;
  avgResponseTime: number;
  maxResponseTime: number;
  minResponseTime: number;
  methodDistribution: Record<string, number>;
  statusCodeDistribution: Record<string, number>;
  hourlyDistribution: Record<string, number>;
  errorsByType: Record<string, number>;
  levelDistribution: Record<string, number>;
  timelineByLevel: Record<string, Record<string, number>>;
}

const LOG_LEVELS: Record<number, string> = {
  10: 'TRACE',
  20: 'DEBUG',
  30: 'INFO',
  40: 'WARN',
  50: 'ERROR',
  60: 'FATAL',
};

/**
 * Parse raw Pino log string (newline-delimited JSON)
 */
export function parsePinoLogs(logText: string): ParsedLogEntry[] {
  if (!logText || !logText.trim()) {
    return [];
  }

  const lines = logText.trim().split('\n');
  const parsed: ParsedLogEntry[] = [];

  const standardFields = new Set([
    'level', 'time', 'pid', 'hostname', 'req', 'res', 
    'responseTime', 'msg', 'err', 'name', 'v'
  ]);

  for (const line of lines) {
    if (!line.trim()) continue;

    try {
      const entry: PinoLogEntry = JSON.parse(line);
      
      // Extract custom fields (anything not in standard Pino/pino-http fields)
      const customFields: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(entry)) {
        if (!standardFields.has(key)) {
          customFields[key] = value;
        }
      }

      const isHttpLog = !!(entry.req || entry.res || entry.responseTime);

      parsed.push({
        ...entry,
        timestamp: new Date(entry.time),
        levelName: LOG_LEVELS[entry.level] || `LEVEL_${entry.level}`,
        method: entry.req?.method,
        url: entry.req?.url,
        statusCode: entry.res?.statusCode,
        duration: entry.responseTime,
        isHttpLog,
        customFields,
      });
    } catch (error) {
      console.warn('Failed to parse log line:', line, error);
    }
  }

  return parsed;
}

/**
 * Calculate comprehensive statistics from parsed logs
 */
export function calculateLogStatistics(logs: ParsedLogEntry[]): LogStatistics {
  if (logs.length === 0) {
    return {
      totalRequests: 0,
      httpRequests: 0,
      nonHttpLogs: 0,
      successCount: 0,
      errorCount: 0,
      avgResponseTime: 0,
      maxResponseTime: 0,
      minResponseTime: 0,
      methodDistribution: {},
      statusCodeDistribution: {},
      hourlyDistribution: {},
      errorsByType: {},
      levelDistribution: {},
      timelineByLevel: {},
    };
  }

  const methodDistribution: Record<string, number> = {};
  const statusCodeDistribution: Record<string, number> = {};
  const hourlyDistribution: Record<string, number> = {};
  const errorsByType: Record<string, number> = {};
  const levelDistribution: Record<string, number> = {};
  const timelineByLevel: Record<string, Record<string, number>> = {};

  let totalResponseTime = 0;
  const responseTimes: number[] = [];
  let successCount = 0;
  let errorCount = 0;
  let httpRequests = 0;
  let nonHttpLogs = 0;

  for (const log of logs) {
    // Track HTTP vs non-HTTP logs
    if (log.isHttpLog) {
      httpRequests++;
    } else {
      nonHttpLogs++;
    }

    // Level distribution
    levelDistribution[log.levelName] = (levelDistribution[log.levelName] || 0) + 1;

    // Method distribution (HTTP only)
    if (log.method) {
      methodDistribution[log.method] = (methodDistribution[log.method] || 0) + 1;
    }

    // Status code distribution (HTTP only)
    if (log.statusCode) {
      const statusKey = `${log.statusCode}`;
      statusCodeDistribution[statusKey] = (statusCodeDistribution[statusKey] || 0) + 1;

      // Count success vs errors
      if (log.statusCode >= 200 && log.statusCode < 400) {
        successCount++;
      } else {
        errorCount++;
      }
    } else {
      // For non-HTTP logs, count errors by level
      if (log.level >= 50) {
        errorCount++;
      } else if (log.level <= 30) {
        successCount++;
      }
    }

    // Hourly distribution
    const hour = log.timestamp.getHours().toString().padStart(2, '0');
    hourlyDistribution[hour] = (hourlyDistribution[hour] || 0) + 1;

    // Timeline by level
    if (!timelineByLevel[log.levelName]) {
      timelineByLevel[log.levelName] = {};
    }
    timelineByLevel[log.levelName][hour] = (timelineByLevel[log.levelName][hour] || 0) + 1;

    // Response time tracking (HTTP only)
    if (log.duration !== undefined && log.duration > 0) {
      totalResponseTime += log.duration;
      responseTimes.push(log.duration);
    }

    // Error tracking
    if (log.err) {
      const errorType = log.err.type || log.err.message?.split(':')[0] || 'Unknown';
      errorsByType[errorType] = (errorsByType[errorType] || 0) + 1;
    }
  }

  const avgResponseTime = responseTimes.length > 0 
    ? totalResponseTime / responseTimes.length 
    : 0;

  return {
    totalRequests: logs.length,
    httpRequests,
    nonHttpLogs,
    successCount,
    errorCount,
    avgResponseTime: Math.round(avgResponseTime * 100) / 100,
    maxResponseTime: responseTimes.length > 0 ? Math.max(...responseTimes) : 0,
    minResponseTime: responseTimes.length > 0 ? Math.min(...responseTimes) : 0,
    methodDistribution,
    statusCodeDistribution,
    hourlyDistribution,
    errorsByType,
    levelDistribution,
    timelineByLevel,
  };
}

/**
 * Filter logs by level
 */
export function filterByLevel(logs: ParsedLogEntry[], levels: string[]): ParsedLogEntry[] {
  return logs.filter(log => levels.includes(log.levelName));
}

/**
 * Filter logs by status code range
 */
export function filterByStatusCode(
  logs: ParsedLogEntry[], 
  minCode: number, 
  maxCode: number
): ParsedLogEntry[] {
  return logs.filter(log => 
    log.statusCode !== undefined && 
    log.statusCode >= minCode && 
    log.statusCode <= maxCode
  );
}

/**
 * Filter logs by time range
 */
export function filterByTimeRange(
  logs: ParsedLogEntry[], 
  startTime: Date, 
  endTime: Date
): ParsedLogEntry[] {
  return logs.filter(log => 
    log.timestamp >= startTime && log.timestamp <= endTime
  );
}

/**
 * Get top N slowest requests
 */
export function getTopSlowestRequests(logs: ParsedLogEntry[], n: number = 10): ParsedLogEntry[] {
  return logs
    .filter(log => log.duration !== undefined)
    .sort((a, b) => (b.duration || 0) - (a.duration || 0))
    .slice(0, n);
}

/**
 * Get logs with errors only
 */
export function getErrorLogs(logs: ParsedLogEntry[]): ParsedLogEntry[] {
  return logs.filter(log => 
    log.level >= 50 || // ERROR or FATAL
    (log.statusCode && log.statusCode >= 400) ||
    log.err !== undefined
  );
}
