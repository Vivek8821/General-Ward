/**
 * Password breach and common-password checks.
 *
 * Two layers:
 *  1. Local Set  — instant, works offline, catches the worst offenders.
 *  2. HIBP API   — k-anonymity model: only the first 5 hex chars of the SHA-1
 *                  hash are sent to the server. The actual password never leaves
 *                  this process. Covers billions of real-world breached passwords.
 *                  Degrades gracefully if the network is unavailable.
 */

const crypto = require('crypto');
const https  = require('https');

// ── Local common-password list ────────────────────────────────────────────────
// Top ~300 most common passwords from public breach analyses (rockyou, HIBP top list).
// Checked before the network call — blocks obvious choices instantly even offline.
const COMMON_PASSWORDS = new Set([
  // ── Pure numbers ──
  '123456','12345678','123456789','1234567890','12345','1234567','123123',
  '000000','111111','1111111','11111111','112233','121212','123321',
  '123abc','1234','12341234','1234abcd','12345a',
  // ── Keyboard patterns ──
  'qwerty','qwerty123','qwerty1','qwertyuiop','qwertyuiop1','qazwsx',
  'qazwsxedc','1q2w3e4r','1q2w3e4r5t','1q2w3e','q1w2e3r4','asdf',
  'asdfgh','asdfghjkl','zxcvbn','zxcvbnm','asdfasdf','qazxsw',
  '!qaz2wsx','!qaz@wsx','1qaz2wsx','2wsx3edc',
  // ── Password-ish ──
  'password','password1','password123','password12','password2',
  'passw0rd','passwort','pass','pass123','pass1234','pass12',
  'p@ssword','p@ssw0rd','p@ss','P@ssword','P@ssw0rd','P@$$w0rd',
  'Passw0rd','Password1','Password123','Admin@123',
  // ── Admin / default ──
  'admin','admin123','admin1234','admin12345','administrator',
  'root','toor','default','changeme','changeMe','changeme1',
  'login','login123','guest','guest123','test','test123','test1234',
  'testing','tester','user','user123','demo','demo123',
  'welcome','welcome1','welcome123','Welcome1','Welcome@123',
  'secret','secret1','secret123','letmein','letmein1',
  // ── Common words + numbers ──
  'abc123','abc1234','abc12345','abcd1234','abcdef','abcdefg','abcdefgh',
  'iloveyou','iloveyou1','iloveme','master','master1','master123',
  'monkey','monkey1','dragon','dragon1','shadow','shadow1',
  'sunshine','sunshine1','princess','princess1','superman','batman',
  'spider','spider1','spiderman','matrix','matrix1',
  'michael','michael1','jessica','jessica1','daniel','daniel1',
  'hunter','hunter1','joshua','charlie','andrew','thomas','matthew',
  'jordan','harley','ranger','robert','george','donald','william',
  'jennifer','samantha','michelle','chelsea','amanda','ashley',
  // ── Sports ──
  'baseball','baseball1','soccer','soccer1','hockey','football','basketball',
  // ── Tech / internet ──
  'google','google1','facebook','twitter','instagram','internet',
  'linux','windows','microsoft','apple','iphone','android',
  'computer','computer1','laptop','server','network',
  // ── Mixed / popular ──
  'trustno1','super123','hello','hello123','hello1','hi123',
  'abc','abcd','abcde','pass1','pass2','qwerty12','ninja',
  'mustang','corvette','ferrari','porsche','bmw','maverick',
  'phoenix','thunder','lightning','storm','fire','earth','water',
  'merlin','wizard','gandalf','frodo','harry','potter','hermione',
  'voldemort','spartan','sparta','viking','marine','ranger1',
  'cookie','butter','cheese','cheese1','flower','buster','tigger',
  'gaming','gamer','gamer1','gaming1','player1','player',
  'whatever','ninja1','killer','hunter2','maverick1',
  '696969','121212','131313','112233','654321','987654',
  '987654321','147258','147258369','159753','753951',
  // ── Months / seasons ──
  'january','february','march','april','june','july','august',
  'september','october','november','december',
  'summer','winter','spring','autumn','summer1','winter1',
  // ── Common short phrases ──
  'iloveu','loveyou','please','thanks','noway','monkey123',
]);

function isCommonPassword(password) {
  if (!password) return false;
  return COMMON_PASSWORDS.has(password) || COMMON_PASSWORDS.has(password.toLowerCase());
}

// ── HIBP k-anonymity check ────────────────────────────────────────────────────

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      { headers: { 'User-Agent': 'ward-backend/password-check' } },
      (res) => {
        if (res.statusCode !== 200) {
          // Consume body to free socket
          res.resume();
          reject(new Error(`HIBP returned HTTP ${res.statusCode}`));
          return;
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        res.on('error', reject);
      }
    );
    req.on('error', reject);
    // Fail fast — registration should not stall for more than 4 s
    req.setTimeout(4000, () => { req.destroy(new Error('HIBP timeout')); });
  });
}

/**
 * Returns true if the password appears in the HIBP breach database.
 * Only the first 5 hex chars of the SHA-1 hash are transmitted.
 */
async function isBreachedPassword(password) {
  const sha1   = crypto.createHash('sha1').update(password).digest('hex').toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);

  const body = await httpsGet(`https://api.pwnedpasswords.com/range/${prefix}`);
  return body.split('\n').some((line) => {
    const sep = line.indexOf(':');
    if (sep === -1) return false;
    return line.slice(0, sep).trim().toUpperCase() === suffix;
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Validates a password against the common-password list and the HIBP API.
 * Returns an error message string if the password should be rejected,
 * or null if it is acceptable.
 *
 * Basic length checks (min 8, max 128) are done separately in validatePassword().
 */
async function checkPasswordSecurity(password) {
  if (!password) return null; // length check is upstream

  // Layer 1: local list — instant, no network required
  if (isCommonPassword(password)) {
    return 'This password is too common and easily guessed. Please choose a longer or more unique password.';
  }

  // Layer 2: HIBP breach database — comprehensive, graceful degradation
  try {
    if (await isBreachedPassword(password)) {
      return 'This password has appeared in known data breaches and cannot be used. Please choose a different password.';
    }
  } catch {
    // Network unavailable, API down, or timeout — do not block registration.
    // The local list above already blocked the most common offenders.
  }

  return null;
}

module.exports = { checkPasswordSecurity, isCommonPassword };
