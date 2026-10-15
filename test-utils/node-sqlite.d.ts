declare module 'node:sqlite' {
  type Value = string | number | null;
  type Row = Record<string, Value>;

  interface StatementSync {
    run(...params: Value[]): { changes: number | bigint; lastInsertRowid: number | bigint };
    get(...params: Value[]): Row | undefined;
    all(...params: Value[]): Row[];
  }

  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
  }
}
