/**
 * MLLP TCP server for HL7 v2.x inbound messages.
 *
 * Design:
 * - One persistent TCP connection per device (LIMS / PACS analyzer).
 * - AA is sent synchronously (fire-and-forget) — domain errors never produce AE.
 * - Per-IP watchdog: if no message is received from a connected source for 60 min,
 *   a MACHINE_OFFLINE warning is logged.
 * - Partial TCP packet reassembly via per-socket buffer.
 */

const net = require('net');
const logger = require('../../utils/logger');
const { unwrapMllp, wrapMllp, parseMessage, buildAck } = require('./Hl7Parser');

const WATCHDOG_INTERVAL_MS   = 5 * 60 * 1000;   // check every 5 min
const WATCHDOG_OFFLINE_MS    = 60 * 60 * 1000;  // warn after 60 min of silence

let server = null;
let watchdogTimer = null;

// Map of remoteAddress → { lastSeen: Date, deviceLabel: string }
const connectedSources = new Map();

function updateWatchdog(remoteAddress, deviceLabel) {
  connectedSources.set(remoteAddress, { lastSeen: new Date(), deviceLabel });
}

function startWatchdog() {
  watchdogTimer = setInterval(() => {
    const cutoff = Date.now() - WATCHDOG_OFFLINE_MS;
    for (const [addr, info] of connectedSources) {
      if (info.lastSeen.getTime() < cutoff) {
        logger.warn('MACHINE_OFFLINE: no HL7 message received', {
          remoteAddress: addr,
          deviceLabel:   info.deviceLabel,
          lastSeenMs:    Date.now() - info.lastSeen.getTime(),
        });
      }
    }
  }, WATCHDOG_INTERVAL_MS);
  if (watchdogTimer.unref) watchdogTimer.unref(); // don't block process exit
}

/**
 * Create the TCP server. The messageHandler async function is called with
 * (parsedMessage, remoteAddress) for every valid MLLP message received.
 */
function createServer(messageHandler) {
  server = net.createServer((socket) => {
    const addr = socket.remoteAddress || 'unknown';
    logger.info('HL7 device connected', { remoteAddress: addr });
    updateWatchdog(addr, addr);

    let buf = Buffer.alloc(0);

    socket.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk]);

      // Extract all complete MLLP messages from the accumulated buffer.
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { message, remainder } = unwrapMllp(buf);
        buf = remainder;
        if (!message) break;

        updateWatchdog(addr, addr);

        let msh;
        let parsed;
        try {
          parsed = parseMessage(message);
          msh = parsed.msh;
        } catch (parseErr) {
          // Framing was valid but content was unparseable — send AE only for this case.
          logger.warn('HL7 parse error', { remoteAddress: addr, error: parseErr.message });
          const errAck = buildAck({ controlId: 'UNKNOWN', sendingApp: addr, sendingFacility: '' }, 'AE', 'Parse error');
          socket.write(wrapMllp(errAck));
          continue;
        }

        // ALWAYS send AA before processing — fire-and-forget.
        const ack = buildAck(msh, 'AA');
        socket.write(wrapMllp(ack));

        // Process asynchronously — errors are swallowed (AA already sent).
        messageHandler(parsed, addr).catch((err) => {
          logger.warn('HL7 domain processing error (AA already sent)', {
            controlId:     msh.controlId,
            messageType:   msh.messageType,
            remoteAddress: addr,
            error:         err.message,
          });
        });
      }
    });

    socket.on('close', () => {
      logger.info('HL7 device disconnected', { remoteAddress: addr });
      connectedSources.delete(addr);
    });

    socket.on('error', (err) => {
      logger.warn('HL7 socket error', { remoteAddress: addr, error: err.message });
    });
  });

  return server;
}

function getStatus() {
  return {
    listening:        server?.listening ?? false,
    connectedSources: Array.from(connectedSources.entries()).map(([addr, info]) => ({
      remoteAddress: addr,
      deviceLabel:   info.deviceLabel,
      lastSeenAt:    info.lastSeen.toISOString(),
      silenceMs:     Date.now() - info.lastSeen.getTime(),
    })),
  };
}

async function start(port, messageHandler) {
  createServer(messageHandler);
  await new Promise((resolve, reject) => {
    server.listen(port, () => {
      logger.info('MLLP server listening', { port });
      resolve();
    });
    server.once('error', reject);
  });
  startWatchdog();
}

async function stop() {
  if (watchdogTimer) {
    clearInterval(watchdogTimer);
    watchdogTimer = null;
  }
  if (server) {
    await new Promise((resolve) => server.close(resolve));
    server = null;
  }
  connectedSources.clear();
}

module.exports = { start, stop, getStatus };
