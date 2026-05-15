/**
 * HL7 service lifecycle.
 * Reads HL7_ENABLED, HL7_PORT, HL7_TENANT_ID from environment.
 * Not started by default — only when HL7_ENABLED=true is set.
 */

const mllpServer = require('./MllpServer');
const { processOruR01 } = require('./Hl7MappingService');
const logger = require('../../utils/logger');

let started = false;

async function messageHandler(parsed, remoteAddress) {
  const tenantId = process.env.HL7_TENANT_ID;
  if (!tenantId) {
    logger.warn('HL7_TENANT_ID not set — message discarded', { remoteAddress });
    return;
  }
  await processOruR01(tenantId, parsed);
}

async function start() {
  if (process.env.HL7_ENABLED !== 'true') return;
  if (started) return;

  const port = parseInt(process.env.HL7_PORT || '2575', 10);
  const tenantId = process.env.HL7_TENANT_ID;

  if (!tenantId) {
    logger.warn('HL7_ENABLED=true but HL7_TENANT_ID is not set — HL7 service not started');
    return;
  }

  await mllpServer.start(port, messageHandler);
  started = true;
  logger.info('HL7 MLLP service started', { port, tenantId });

  // On Windows Server the firewall blocks inbound TCP by default.
  // The sysadmin must run this once (elevated prompt) to allow LIMS/PACS traffic:
  if (process.platform === 'win32') {
    logger.warn(
      `Windows firewall: run once in an elevated command prompt to allow HL7 traffic:\n` +
      `  netsh advfirewall firewall add rule name="HL7 MLLP" dir=in action=allow protocol=TCP localport=${port}`
    );
  }
}

async function stop() {
  if (!started) return;
  await mllpServer.stop();
  started = false;
  logger.info('HL7 MLLP service stopped');
}

function getStatus() {
  return {
    enabled: process.env.HL7_ENABLED === 'true',
    started,
    ...mllpServer.getStatus(),
  };
}

module.exports = { start, stop, getStatus };
