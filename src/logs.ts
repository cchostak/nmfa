type LogLevel = 'debug' | 'info' | 'warn' | 'error';

type LogFields = Record<string, string | number | boolean | null | undefined>;

/**
 * Event stream logger for 12-factor friendly structured logs.
 */
export class Logger {
  constructor(private readonly namespace: string) {}

  /**
   * Write a debug event to stdout.
   */
  debug(message: string, fields: LogFields = {}): void {
    this.write('debug', message, fields);
  }

  /**
   * Write an informational event to stdout.
   */
  info(message: string, fields: LogFields = {}): void {
    this.write('info', message, fields);
  }

  /**
   * Write a warning event to stderr.
   */
  warn(message: string, fields: LogFields = {}): void {
    this.write('warn', message, fields);
  }

  /**
   * Write an error event to stderr.
   */
  error(message: string, fields: LogFields = {}): void {
    this.write('error', message, fields);
  }

  private write(level: LogLevel, message: string, fields: LogFields): void {
    const payload = {
      timestamp: new Date().toISOString(),
      level,
      namespace: this.namespace,
      message,
      ...fields,
    };
    const output = JSON.stringify(payload);
    if (level === 'warn' || level === 'error') {
      console.error(output);
      return;
    }

    console.log(output);
  }
}
