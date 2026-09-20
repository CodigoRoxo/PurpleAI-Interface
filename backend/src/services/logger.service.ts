export class LoggerService {
  private static formatTime(): string {
    return new Date().toISOString().replace('T', ' ').slice(0, 19);
  }

  static rag(stage: string, message: string, meta?: Record<string, any>): void {
    const time = this.formatTime();
    const metaStr = meta ? ` | ${JSON.stringify(meta)}` : '';
    console.log(`\x1b[35m[RAG ${time}]\x1b[0m \x1b[36m${stage.padEnd(20)}\x1b[0m ${message}${metaStr}`);
  }

  static info(scope: string, message: string): void {
    const time = this.formatTime();
    console.log(`\x1b[34m[INFO ${time}]\x1b[0m \x1b[33m[${scope}]\x1b[0m ${message}`);
  }

  static warn(scope: string, message: string): void {
    const time = this.formatTime();
    console.warn(`\x1b[33m[WARN ${time}]\x1b[0m \x1b[33m[${scope}]\x1b[0m ${message}`);
  }

  static error(scope: string, message: string, err?: unknown): void {
    const time = this.formatTime();
    const errMsg = err instanceof Error ? err.stack || err.message : String(err || '');
    console.error(`\x1b[31m[ERROR ${time}]\x1b[0m \x1b[33m[${scope}]\x1b[0m ${message} ${errMsg}`);
  }
}

export const logger = LoggerService;
