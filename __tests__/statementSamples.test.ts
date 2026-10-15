import fs from 'node:fs';
import path from 'node:path';

import { createTestDb } from '../test-utils/testDb';
import { migrateDbIfNeeded } from '../src/data/local/migrations';
import { createAccount, listAccounts } from '../src/data/repositories/accounts';
import { parseStatement } from '../src/domain/statements/parseStatement';
import type { StatementPages } from '../src/domain/statements/types';
import {
  applyStatementImport,
  checkStatementBalance,
  matchStatementBalance,
  planStatementImport,
  suggestAccount,
} from '../src/services/statements/importStatement';

jest.mock('expo-crypto', () => ({ randomUUID: () => jest.requireActual('node:crypto').randomUUID() }));

/**
 * Real statements, unlocked to text with a local script, live in the
 * gitignored samples/ folder. These checks only run where they exist.
 */
const SAMPLES = path.join(__dirname, '..', 'samples');
const files = fs.existsSync(SAMPLES) ? fs.readdirSync(SAMPLES).filter(name => name.endsWith('.items.json')) : [];

const describeSamples = files.length > 0 ? describe : describe.skip;

function read(file: string) {
  return parseStatement(JSON.parse(fs.readFileSync(path.join(SAMPLES, file), 'utf8')) as StatementPages);
}

describeSamples('real statement samples', () => {
  it.each(files.length > 0 ? files : ['none'])('%s reads without problems', (file: string) => {
    const statement = read(file);
    expect(statement.problems).toEqual([]);
    expect(statement.rows.length).toBeGreaterThan(0);
  });

  it('imports every sample into its own account with matching balances, once', async () => {
    const db = createTestDb();
    await migrateDbIfNeeded(db);
    const statements = files.map(read);
    for (const statement of statements) {
      await createAccount(db, { name: statement.bank, type: 'bank', openingBalanceMinor: 0 });
    }
    const accounts = await listAccounts(db);
    for (const statement of statements) {
      const account = suggestAccount(accounts, statement);
      expect(account).not.toBeNull();
      await applyStatementImport(db, await planStatementImport(db, statement, account!.id));
      const check = await checkStatementBalance(db, account!.id, statement);
      await matchStatementBalance(db, account!.id, check!);
      expect(await checkStatementBalance(db, account!.id, statement)).toEqual({
        appMinor: statement.closingBalanceMinor,
        statementMinor: statement.closingBalanceMinor,
      });
    }
    for (const statement of statements) {
      const plan = await planStatementImport(db, statement, suggestAccount(accounts, statement)!.id);
      expect(plan.rows.filter(r => !r.existing)).toEqual([]);
      expect(plan.notOnStatement).toBe(0);
    }
  });
});
