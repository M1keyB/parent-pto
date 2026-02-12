import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getHouseholdByCode } from '../context/HouseholdContext';
import { createHousehold, joinHousehold } from '../services/householdService';
import { useActionState } from '../hooks/useActionState';
import { Button, Card, EmptyState, Input, PageContainer } from '../components/UI';

export function OnboardingPage() {
  const { user } = useAuth();
  const [mode, setMode] = useState('create');
  const [householdName, setHouseholdName] = useState('Team Tiny Humans');
  const [displayName, setDisplayName] = useState('Parent 1');
  const [partnerName, setPartnerName] = useState('Parent 2');
  const [joinCode, setJoinCode] = useState('');
  const { busy, error, setError, runAction } = useActionState();

  async function handleCreate(event) {
    event.preventDefault();
    await runAction(async () => {
      await createHousehold({
        uid: user.uid,
        householdName: householdName.trim(),
        displayName: displayName.trim(),
        partnerName: partnerName.trim(),
      });
    });
  }

  async function handleJoin(event) {
    event.preventDefault();
    await runAction(async () => {
      const householdId = await getHouseholdByCode(joinCode);
      if (!householdId) {
        setError('Could not find that household code.');
        return;
      }
      await joinHousehold({
        uid: user.uid,
        householdId,
        displayName: displayName.trim(),
      });
    });
  }

  return (
    <div className="onboarding-shell">
      <PageContainer title="Parent PTO" subtitle="A calmer way to share the home load.">
        <Card className="glass-card">
          <div className="mode-toggle">
            <button type="button" className={mode === 'create' ? 'active' : ''} onClick={() => setMode('create')}>
              Create Household
            </button>
            <button type="button" className={mode === 'join' ? 'active' : ''} onClick={() => setMode('join')}>
              Join Household
            </button>
          </div>
        </Card>

        <Card title={mode === 'create' ? 'Start your home base' : 'Join with a code'} subtitle="Everything syncs in real time.">
          {mode === 'create' ? (
            <form className="stack" onSubmit={handleCreate}>
              <Input id="household-name" label="Household name" value={householdName} onChange={(event) => setHouseholdName(event.target.value)} required />
              <Input id="display-name-create" label="Your display name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} required />
              <Input id="partner-name" label="Partner display name" value={partnerName} onChange={(event) => setPartnerName(event.target.value)} required />
              <Button type="submit" disabled={busy}>{busy ? 'Setting up...' : 'Start Household'}</Button>
            </form>
          ) : (
            <form className="stack" onSubmit={handleJoin}>
              <Input
                id="join-code"
                label="Household code"
                value={joinCode}
                onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                placeholder="ABC123"
                required
              />
              <Input id="display-name-join" label="Your display name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} required />
              <Button type="submit" disabled={busy}>{busy ? 'Joining...' : 'Join Household'}</Button>
            </form>
          )}
          {error && <p className="error">{error}</p>}
        </Card>

        <Card>
          <EmptyState icon="+" title="Small wins matter" text="Track tasks, mint calm minutes, and protect each other's recovery time." />
        </Card>
      </PageContainer>
    </div>
  );
}

