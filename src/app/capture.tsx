import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';

import { Button, EmptyState, LoadingState } from '@/components/ui';
import { insertCandidate } from '@/data/repositories/upiCandidates';
import { parseBankSms } from '@/domain/upi/bankSms';
import { useUpi } from '@/services/upi/UpiProvider';

type Outcome = 'notPayment' | 'duplicate' | 'ignored';

const messages: Record<Outcome, { title: string; body: string; icon: 'help-circle' | 'copy' | 'ban' }> = {
  notPayment: {
    title: 'No payment found',
    body: 'This message does not look like a completed bank debit or credit, so nothing was saved.',
    icon: 'help-circle',
  },
  duplicate: {
    title: 'Already captured',
    body: 'This payment was captured before. Check the review list or your transactions.',
    icon: 'copy',
  },
  ignored: {
    title: 'Not added',
    body: 'Failed payments and payment requests are never added as expenses.',
    icon: 'ban',
  },
};

/**
 * Target of `financetracker://capture?text=<message>`, opened by an iOS
 * Shortcuts automation when a bank SMS arrives. The message is parsed on the
 * device and only the extracted details are kept, never the message itself.
 */
export default function CaptureScreen() {
  const db = useSQLiteContext();
  const { refresh } = useUpi();
  const { text } = useLocalSearchParams<{ text?: string }>();
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  useEffect(() => {
    let cancelled = false;
    const capture = async (): Promise<Outcome | null> => {
      const parsed = text ? parseBankSms(text, Date.now()) : null;
      if (!parsed) {
        return 'notPayment';
      }
      const id = await insertCandidate(db, parsed);
      await refresh();
      if (!id) {
        return 'duplicate';
      }
      if (parsed.status !== 'success') {
        return 'ignored';
      }
      router.replace(`/transaction/new?candidateId=${id}`);
      return null;
    };
    capture().then(result => {
      if (!cancelled) {
        setOutcome(result);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [db, text, refresh]);

  if (!outcome) {
    return <LoadingState />;
  }
  const message = messages[outcome];
  return (
    <EmptyState
      icon={message.icon}
      title={message.title}
      body={message.body}
      action={<Button title="Open review list" variant="secondary" onPress={() => router.replace('/upi-review')} />}
    />
  );
}
