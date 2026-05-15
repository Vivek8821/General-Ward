/**
 * HL7 v2.x parser and ACK builder.
 *
 * Supports ORU^R01 messages (lab results from LIMS analyzers).
 * MLLP framing: VT (0x0B) | HL7 body | FS (0x1C) CR (0x0D)
 */

const VT = 0x0b;
const FS = 0x1c;
const CR = 0x0d;
const MLLP_START = Buffer.from([VT]);
const MLLP_END   = Buffer.from([FS, CR]);

// Try UTF-8 first; fall back to latin-1 (ISO-8859-1) for older analyzers.
function safeDecode(buf) {
  try {
    const text = buf.toString('utf8');
    // Validate: if the decoded string contains replacement char (U+FFFD) it's likely latin-1.
    if (text.includes('�')) {
      return buf.toString('latin1');
    }
    return text;
  } catch {
    return buf.toString('latin1');
  }
}

/**
 * Extract the first complete HL7 message from a raw TCP buffer.
 * Returns { message: string, remainder: Buffer } or { message: null, remainder: buf }.
 */
function unwrapMllp(buf) {
  const start = buf.indexOf(VT);
  if (start === -1) return { message: null, remainder: buf };

  const end = buf.indexOf(FS, start + 1);
  if (end === -1) return { message: null, remainder: buf };

  const body = buf.slice(start + 1, end);
  const message = safeDecode(body);
  const remainder = buf.slice(end + 2); // skip FS + CR
  return { message, remainder };
}

function wrapMllp(hl7Text) {
  return Buffer.concat([MLLP_START, Buffer.from(hl7Text, 'utf8'), MLLP_END]);
}

/**
 * Parse an HL7 v2.x message text into a structured object.
 * Returns { msh, pid, obr, obxList } or throws on malformed MSH.
 */
function parseMessage(text) {
  // HL7 uses CR (\r) as the segment terminator; some senders use CRLF.
  const segments = text.split(/\r\n?|\n/).filter(Boolean);

  const getSegment = (tag) => segments.find((s) => s.startsWith(tag + '|')) || null;
  const getAllSegments = (tag) => segments.filter((s) => s.startsWith(tag + '|'));

  const mshRaw = getSegment('MSH');
  if (!mshRaw) throw new Error('Missing MSH segment');

  const msh = parseMsh(mshRaw);
  const pidRaw = getSegment('PID');
  const pid = pidRaw ? parsePid(pidRaw) : null;
  const obrRaw = getSegment('OBR');
  const obr = obrRaw ? parseObr(obrRaw) : null;
  const obxList = getAllSegments('OBX').map(parseObx);

  return { msh, pid, obr, obxList, rawText: text };
}

function fields(raw) {
  return raw.split('|');
}

function parseMsh(raw) {
  const f = fields(raw);
  // MSH|^~\&|SendingApp|SendingFacility|...|...|DateTime|...|MsgType|...|ControlID|...
  return {
    sendingApp:      f[2]  || '',
    sendingFacility: f[3]  || '',
    receivingApp:    f[4]  || '',
    dateTime:        f[6]  || '',
    messageType:     f[8]  || '',   // e.g. ORU^R01
    controlId:       f[9]  || '',   // MSH-10 — used as idempotency key
    processingId:    f[10] || '',
    versionId:       f[11] || '',
  };
}

function parsePid(raw) {
  const f = fields(raw);
  // PID|1||PatientID^^^System^MR||LastName^FirstName|...
  const patientIdField = f[3] || f[2] || '';
  // Patient ID can be composite: ID^^^Authority^TypeCode — take first component
  const mrn = patientIdField.split('^')[0].trim();

  const nameField = f[5] || '';
  const nameParts = nameField.split('^');
  const lastName  = nameParts[0] || '';
  const firstName = nameParts[1] || '';
  const name = [firstName, lastName].filter(Boolean).join(' ') || null;

  const dob = f[7] || null;

  return { mrn, name, dob };
}

function parseObr(raw) {
  const f = fields(raw);
  // OBR|1|OrderID|FillerID|TestCode^TestName|...
  const testCodeField = f[4] || '';
  const [code, name] = testCodeField.split('^');
  return {
    orderId:    f[2] || null,
    fillerId:   f[3] || null,
    testCode:   code || null,
    testName:   name || null,
    specimenAt: f[14] || null,
    reportedAt: f[22] || null,
  };
}

function parseObx(raw) {
  const f = fields(raw);
  // OBX|1|NM|AnalyteCode^AnalyteName|SubID|Value|Units|RefRange|AbnFlag|...|Status
  const analyteField = f[3] || '';
  const [code, name] = analyteField.split('^');
  return {
    setId:      f[1]  || null,
    valueType:  f[2]  || 'ST',
    code:       code  || null,
    name:       name  || null,
    subId:      f[4]  || null,
    value:      f[5]  || null,
    units:      f[6]  || null,
    refRange:   f[7]  || null,
    abnFlag:    f[8]  || null,
    status:     f[11] || null,
  };
}

/**
 * Build an HL7 ACK message.
 * ackCode: 'AA' (Application Accept) | 'AE' (Application Error) | 'AR' (Application Reject)
 */
function buildAck(msh, ackCode = 'AA', errorMsg = '') {
  const now = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  const lines = [
    `MSH|^~\\&|GeneralWard|GeneralWard|${msh.sendingApp}|${msh.sendingFacility}|${now}||ACK^R01|${now}|P|2.5`,
    `MSA|${ackCode}|${msh.controlId}${errorMsg ? `|${errorMsg}` : ''}`,
  ];
  return lines.join('\r') + '\r';
}

module.exports = { safeDecode, unwrapMllp, wrapMllp, parseMessage, buildAck };
