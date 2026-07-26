import { Injectable, LoggerService, LogLevel, Scope } from '@nestjs/common';

export interface LogEntry {
  level: string;
  message: string;
  timestamp: string;
  context?: string;
  correlationId?: string;
  requestId?: string;
  userId?: string;
  duration?: number;
  error?: string;
  stack?: string;
  [key: string]: unknown;
}

@Injectable({ scope: Scope.TRANSIENT })
export class PinoLoggerService implements LoggerService {
  private context?: string;
  private correlationId?: string;
  private requestId?: string;

  setContext(context: string) {
    this.context = context;
  }

  setCorrelationId(id: string) {
    this.correlationId = id;
  }

  setRequestId(id: string) {
    this.requestId = id;
  }

  log(message: unknown, ...optionalParams: unknown[]) {
    this.print('info', message, optionalParams);
  }

  warn(message: unknown, ...optionalParams: unknown[]) {
    this.print('warn', message, optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]) {
    this.print('error', message, optionalParams);
  }

  debug(message: unknown, ...optionalParams: unknown[]) {
    this.print('debug', message, optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]) {
    this.print('trace', message, optionalParams);
  }

  fatal(message: unknown, ...optionalParams: unknown[]) {
    this.print('fatal', message, optionalParams);
  }

  private print(level: string, message: unknown, optionalParams: unknown[]) {
    const entry: LogEntry = {
      level,
      message: typeof message === 'string' ? message : JSON.stringify(message),
      timestamp: new Date().toISOString(),
      context: this.context,
      correlationId: this.correlationId,
      requestId: this.requestId,
    };

    if (optionalParams.length > 0) {
      const [first] = optionalParams;
      if (typeof first === 'object' && first !== null) {
        Object.assign(entry, first);
      } else if (typeof first === 'string') {
        entry.message += ' ' + first;
      }
    }

    // Structured JSON output (works with production log aggregators)
    if (process.env.NODE_ENV === 'production') {
      process.stdout.write(JSON.stringify(entry) + '\n');
    } else {
      const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}]${entry.context ? ' [' + entry.context + ']' : ''}${entry.correlationId ? ' [cid:' + entry.correlationId + ']' : ''}`;
      const output = `${prefix} ${entry.message}`;

      switch (level) {
        case 'error':
        case 'fatal':
          console.error(output);
          if (entry.stack) console.error(entry.stack);
          break;
        case 'warn':
          console.warn(output);
          break;
        default:
          console.log(output);
      }
    }
  }
}
