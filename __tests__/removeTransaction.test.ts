import { createTestDb } from '../test-utils/testDb';
import { loadBudgetSummary } from '../src/data/queries/budgetSummary';
import { loadMonth } from '../src/data/queries/monthSummary';
import { migrateDbIfNeeded } from '../src/data/local/migrations';
import { createAccount, getAccountFlows, listAccounts } from '../src/data/repositories/accounts';
import { setBudget } from '../src/data/repositories/budgets';
import { listCategories } from '../src/data/repositories/categories';
import { setReceiptUri } from '../src/data/repositories/receipts';
import { listTransactions } from '../src/data/repositories/transactions';
import { getCandidate, insertCandidate } from '../src/data/repositories/upiCandidates';
import { accountBalance } from '../src/domain/accounting/accounting';
import { monthKeyOf } from '../src/domain/period';
import { parseBankSms } from '../src/domain/upi/bankSms';
import { removeTransaction } from '../src/services/removeTransaction';
import { autoAddCandidates } from '../src/services/upi/autoAdd';

jest.mock('expo-crypto', () => ({ randomUUID: () => jest.requireActual('node:crypto').randomUUID() }));

const mockDeletedFiles: (string | null)[] = [];
jest.mock('../src/services/receipts', () => ({
  deleteReceiptPhoto: async (uri: string | null) => {
    mockDeletedFiles.push(uri);
  },
}));

describe('removeTransaction', () => {
  it('takes a deleted payment out of balances, month totals and budgets, and back to review', async () => {
    const db = createTestDb();
    await migrateDbIfNeeded(db);
    const bank = await createAccount(db, { name: 'HDFC', type: 'bank', openingBalanceMinor: 1_000_00 });
    const food = (await listCategories(db)).find(c => c.name === 'Food and dining')!;
    await setBudget(db, food.id, 500_00);

    const sms = parseBankSms('Sent Rs.120.00 From HDFC Bank A/C *1234 To SWIGGY On 15/10/26 Ref 529200000001 Not You?', Date.now())!;
    const candidate = await insertCandidate(db, sms);
    await autoAddCandidates(db, [candidate!]);
    const [added] = await listTransactions(db, {});
    expect(added).toMatchObject({ accountId: bank, amountMinor: 120_00, categoryId: food.id });
    await setReceiptUri(db, added.id, 'file:///receipts/swiggy.jpg');

    const month = monthKeyOf(new Date(added.occurredAt));
    const balance = async () => {
      const [account, flows] = await Promise.all([listAccounts(db), getAccountFlows(db)]);
      return accountBalance(account.find(a => a.id === bank)!, flows.get(bank));
    };
    const foodSpent = async () =>
      (await loadBudgetSummary(db, month)).progress.find(p => p.categoryId === food.id)?.spentMinor;
    expect(await balance()).toBe(880_00);
    expect((await loadMonth(db, month)).summary.expenseMinor).toBe(120_00);
    expect(await foodSpent()).toBe(120_00);

    await removeTransaction(db, added.id);

    expect(await balance()).toBe(1_000_00);
    expect((await loadMonth(db, month)).summary.expenseMinor).toBe(0);
    expect(await foodSpent()).toBe(0);
    expect(await getCandidate(db, candidate!)).toMatchObject({ reviewState: 'needs_review', transactionId: null });
    expect(mockDeletedFiles).toEqual(['file:///receipts/swiggy.jpg']);
    const outbox = await db.getFirstAsync<{ n: number }>(
      "SELECT COUNT(*) AS n FROM sync_outbox WHERE table_name = 'transactions' AND row_id = ?",
      added.id,
    );
    expect(outbox?.n).toBeGreaterThan(0);
  });
});
