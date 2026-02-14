/**
 * @file Structured JSON logger
 * @purpose Provides consistent, structured logging across the application.
 *          All log output follows the schema defined in CONVENTIONS.md.
 *          Never use console.log directly in application code; use this logger.
 * @inputs Log level, event type, actor, resource, metadata
 * @outputs Structured JSON to console (captured by Cloudflare Workers runtime)
 * @invariants All log entries include timestamp, event, and outcome fields.
 *             No PII, passwords, tokens, or full request bodies in metadata.
 */

export interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  event: string;
  actor: string;
  resource?: string;
  outcome: 'success' | 'failure';
  metadata?: Record<string, unknown>;
}

function emit(entry: LogEntry): void {
  const output = JSON.stringify(entry);
  switch (entry.level) {
    case 'error':
      console.error(output);
      break;
    case 'warn':
      console.warn(output);
      break;
    default:
      console.info(output);
  }
}

export const logger = {
  info(params: Omit<LogEntry, 'timestamp' | 'level'>): void {
    emit({ ...params, timestamp: new Date().toISOString(), level: 'info' });
  },

  warn(params: Omit<LogEntry, 'timestamp' | 'level'>): void {
    emit({ ...params, timestamp: new Date().toISOString(), level: 'warn' });
  },

  error(params: Omit<LogEntry, 'timestamp' | 'level'>): void {
    emit({ ...params, timestamp: new Date().toISOString(), level: 'error' });
  },

  debug(params: Omit<LogEntry, 'timestamp' | 'level'>): void {
    emit({ ...params, timestamp: new Date().toISOString(), level: 'debug' });
  },
};
