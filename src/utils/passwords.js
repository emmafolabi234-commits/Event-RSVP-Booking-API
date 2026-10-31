const { promisify } = require('node:util');
const { randomBytes, scrypt: scryptCallback, timingSafeEqual } = require('node:crypto');

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, KEY_LENGTH, SCRYPT_OPTIONS);
  return `scrypt$16384$8$1$${salt.toString('hex')}$${hash.toString('hex')}`;
}

async function verifyPassword(password, storedHash) {
  const [algorithm, cost, blockSize, parallelization, saltHex, hashHex] = storedHash.split('$');
  if (algorithm !== 'scrypt' || cost !== '16384' || blockSize !== '8' ||
      parallelization !== '1' || !/^[0-9a-f]{32}$/i.test(saltHex) ||
      !/^[0-9a-f]{128}$/i.test(hashHex)) {
    return false;
  }

  const expected = Buffer.from(hashHex, 'hex');
  const actual = await scrypt(
    password,
    Buffer.from(saltHex, 'hex'),
    expected.length,
    SCRYPT_OPTIONS,
  );
  return timingSafeEqual(actual, expected);
}

module.exports = { hashPassword, verifyPassword };
