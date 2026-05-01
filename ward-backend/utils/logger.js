/**
 * Structured, Buffered Logger
 * Minimizes I/O overhead by buffering log entries and flushing them periodically.
 */

const BUFFER_SIZE_LIMIT = 50;
const FLUSH_INTERVAL_MS = 2000;

let logBuffer = [];
let flushTimeout = null;

function flush() {
  if (logBuffer.length === 0) return;

  const logs = logBuffer;
  logBuffer = [];

  // In a real production app, this might write to a file or a logging service.
  // For this environment, we use console.log as the standard output stream.
  logs.forEach((entry) => {
    process.stdout.write(JSON.stringify(entry) + '\n');
  });

  if (flushTimeout) {
    clearTimeout(flushTimeout);
    flushTimeout = null;
  }
}

function scheduleFlush() {
  if (flushTimeout) return;
  flushTimeout = setTimeout(flush, FLUSH_INTERVAL_MS);
}

const logger = {
  log(level, message, context = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...context,
    };

    logBuffer.push(entry);

    if (logBuffer.length >= BUFFER_SIZE_LIMIT) {
      flush();
    } else {
      scheduleFlush();
    }
  },

  info(message, context) {
    this.log('info', message, context);
  },

  warn(message, context) {
    this.log('warn', message, context);
  },

  error(message, context) {
    this.log('error', message, context);
  },

  // Immediate flush for critical errors or shutdown
  flush() {
    flush();
  },
};

// Ensure logs are flushed on process exit
process.on('beforeExit', () => logger.flush());
process.on('SIGINT', () => {
  logger.flush();
  process.exit(0);
});
process.on('SIGTERM', () => {
  logger.flush();
  process.exit(0);
});

module.exports = logger;
