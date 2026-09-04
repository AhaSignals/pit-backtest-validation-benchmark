import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const privateHandle = String.fromCharCode(0x73, 0x6e, 0x6f, 0x77);
const bytePatterns = [
  `/users/${privateHandle}/`,
  `/home/${privateHandle}/`,
  `c:\\users\\${privateHandle}\\`,
  `${privateHandle}@`,
].map((value) => Buffer.from(value));
const identityField = new RegExp(
  `(?:author|creator|operator|researcher|username|user)[^a-z0-9]{1,12}${privateHandle}\\b`,
  'i',
);

const trackedFiles = execFileSync('git', ['ls-files', '-z'])
  .toString('utf8')
  .split('\0')
  .filter(Boolean);
const violations = [];

for (const file of trackedFiles) {
  const content = readFileSync(file);
  const lower = Buffer.from(content.toString('latin1').toLowerCase(), 'latin1');
  const text = content.toString('utf8');
  const lowerFilename = Buffer.from(file.toLowerCase());
  if (bytePatterns.some((pattern) => lower.includes(pattern) || lowerFilename.includes(pattern)) || identityField.test(text)) {
    violations.push(file);
  }
}

if (violations.length > 0) {
  console.error('Public identity check failed. Replace personal identity data in:');
  for (const file of violations) console.error(`- ${file}`);
  process.exit(1);
}

console.log(`Public identity check passed for ${trackedFiles.length} tracked files.`);
