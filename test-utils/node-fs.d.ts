declare module 'node:fs' {
  export function existsSync(path: string): boolean;
  export function readdirSync(path: string): string[];
  export function readFileSync(path: string, encoding: 'utf8'): string;
  const fs: { existsSync: typeof existsSync; readdirSync: typeof readdirSync; readFileSync: typeof readFileSync };
  export default fs;
}

declare module 'node:path' {
  export function join(...parts: string[]): string;
  const path: { join: typeof join };
  export default path;
}

declare const __dirname: string;
