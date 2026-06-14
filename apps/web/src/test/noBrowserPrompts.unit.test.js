import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const SOURCE_ROOT = path.resolve(process.cwd(), 'src');
const CODE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx']);
const EXCLUDED_SEGMENTS = ['.test.', '/test/'];

const collectSourceFiles = (directory) => {
  const entries = readdirSync(directory, { withFileTypes: true });
  const files = [];

  entries.forEach((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(fullPath));
      return;
    }

    if (!entry.isFile()) return;
    const extension = path.extname(entry.name);
    if (!CODE_EXTENSIONS.has(extension)) return;
    const normalized = fullPath.split(path.sep).join('/');
    if (EXCLUDED_SEGMENTS.some((segment) => normalized.includes(segment))) return;
    files.push(fullPath);
  });

  return files;
};

describe('modal system safety', () => {
  it('does not use browser native confirm/alert/prompt APIs in app source', () => {
    const blockedPatterns = [
      /window\.(confirm|alert|prompt)\s*\(/g,
      /globalThis\.(confirm|alert|prompt)\s*\(/g,
      /(^|[^.\w$])(confirm|alert|prompt)\s*\(/g,
    ];

    const violations = [];
    collectSourceFiles(SOURCE_ROOT).forEach((filePath) => {
      const source = readFileSync(filePath, 'utf8');
      const relativePath = path.relative(process.cwd(), filePath);
      blockedPatterns.forEach((pattern) => {
        pattern.lastIndex = 0;
        if (pattern.test(source)) {
          violations.push(relativePath);
        }
      });
    });

    expect(violations).toEqual([]);
  });
});
