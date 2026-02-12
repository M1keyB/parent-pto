import { useState } from 'react';

export function useActionState() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function runAction(action) {
    setBusy(true);
    setError('');
    try {
      await action();
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Action failed.';
      setError(message);
      return { ok: false, error: message };
    } finally {
      setBusy(false);
    }
  }

  return { busy, error, setError, runAction };
}

