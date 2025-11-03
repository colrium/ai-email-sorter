type LogLevel = "info" | "warn" | "error" | "debug";

interface LogData {
  [key: string]: unknown;
}

class Logger {
  private log(level: LogLevel, message: string, data?: LogData) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...data,
    };

    let logString: string;
    try {
      logString = JSON.stringify(logEntry);
    } catch {
      // Handle circular references
      logString = JSON.stringify({
        timestamp,
        level,
        message,
        error: "Failed to serialize log data: circular reference detected",
      });
    }

    switch (level) {
      case "error":
        console.error(logString);
        break;
      case "warn":
        console.warn(logString);
        break;
      case "debug":
        if (process.env.NODE_ENV === "development") {
          console.debug(logString);
        }
        break;
      default:
        console.log(logString);
    }
  }

  info(message: string, data?: LogData) {
    this.log("info", message, data);
  }

  warn(message: string, data?: LogData) {
    this.log("warn", message, data);
  }

  error(message: string, error?: Error | unknown, data?: LogData) {
    this.log("error", message, {
      ...data,
      error:
        error instanceof Error
          ? {
              message: error.message,
              stack: error.stack,
              name: error.name,
            }
          : error,
    });
  }

  debug(message: string, data?: LogData) {
    this.log("debug", message, data);
  }
}

export const logger = new Logger();
