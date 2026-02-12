import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button, Card, Input, Modal, PageContainer, Select } from '../components/UI';
import { useHousehold } from '../context/HouseholdContext';
import { saveDisplayNames, saveHouseholdSettings, getHouseholdExport, leaveHousehold } from '../services/householdService';
import { useActionState } from '../hooks/useActionState';

function normalizeExport(value) {
  if (!value || typeof value !== 'object') {
    return value;
  }
  if (typeof value.toDate === 'function') {
    return value.toDate().toISOString();
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeExport(item));
  }
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeExport(item)]));
}

export function SettingsPage() {
  const { user } = useAuth();
  const { householdId, household, me, partner, clearHouseholdState } = useHousehold();
  const [name, setName] = useState('');
  const [loggerShare, setLoggerShare] = useState(0.6);
  const [thresholdPoints, setThresholdPoints] = useState(10);
  const [minutesPerThreshold, setMinutesPerThreshold] = useState(10);
  const [tone, setTone] = useState('gentle');
  const [myDisplayName, setMyDisplayName] = useState('');
  const [partnerDisplayName, setPartnerDisplayName] = useState('');
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const { busy, error, runAction } = useActionState();

  useEffect(() => {
    if (!household) return;
    setName(household.name ?? '');
    setLoggerShare(Number(household.split?.loggerShare ?? 0.6));
    setThresholdPoints(Number(household.ptoConversion?.thresholdPoints ?? 10));
    setMinutesPerThreshold(Number(household.ptoConversion?.minutesPerThreshold ?? 10));
    setTone(household.tone ?? 'gentle');
    setMyDisplayName(me?.displayName ?? '');
    setPartnerDisplayName(partner?.displayName ?? household.pendingPartnerName ?? '');
  }, [household, me?.displayName, partner?.displayName]);

  const splitLabel = useMemo(() => `${Math.round(loggerShare * 100)}/${Math.round((1 - loggerShare) * 100)}`, [loggerShare]);

  return (
    <PageContainer title="Settings" subtitle="Tune fairness and export your household data.">
      <Card title="Fairness" subtitle="Choose what feels fair this season.">
        <div className="stack">
          <Input id="settings-name" label="Household name" value={name} onChange={(event) => setName(event.target.value)} />

          <Input
            id="settings-my-name"
            label="Your display name"
            value={myDisplayName}
            onChange={(event) => setMyDisplayName(event.target.value)}
          />

          <Input
            id="settings-partner-name"
            label="Partner display name"
            value={partnerDisplayName}
            onChange={(event) => setPartnerDisplayName(event.target.value)}
          />

          <Input id="settings-code" label="Household join code" value={household?.code ?? ''} readOnly />

          <label className="field" htmlFor="settings-split">
            <span className="field-label">Logger split ({splitLabel})</span>
            <input
              id="settings-split"
              type="range"
              min={0.5}
              max={0.7}
              step={0.1}
              value={loggerShare}
              onChange={(event) => setLoggerShare(Number(event.target.value))}
            />
          </label>

          <div className="inline-fields">
            <Input
              id="settings-threshold"
              label="Threshold points"
              type="number"
              min={1}
              value={thresholdPoints}
              onChange={(event) => setThresholdPoints(Number(event.target.value))}
            />
            <Input
              id="settings-minutes"
              label="Minutes per threshold"
              type="number"
              min={1}
              value={minutesPerThreshold}
              onChange={(event) => setMinutesPerThreshold(Number(event.target.value))}
            />
          </div>

          <Select id="settings-tone" label="Tone" value={tone} onChange={(event) => setTone(event.target.value)}>
            <option value="gentle">Gentle neutral</option>
            <option value="silly">Extra silly</option>
          </Select>

          <Button
            disabled={busy}
            onClick={() => {
              void runAction(async () => {
                await saveHouseholdSettings({
                  householdId,
                  updates: {
                    name,
                    split: { loggerShare },
                    ptoConversion: { thresholdPoints, minutesPerThreshold },
                    tone,
                  },
                });

                await saveDisplayNames({
                  householdId,
                  uid: user.uid,
                  myDisplayName: myDisplayName.trim(),
                  partnerUid: partner?.id ?? '',
                  partnerDisplayName: partnerDisplayName.trim(),
                });
              });
            }}
          >
            Save Settings
          </Button>
        </div>
      </Card>

      <Card title="Data Export" subtitle="Download all household data as JSON.">
        <Button
          variant="secondary"
          onClick={() => {
            void runAction(async () => {
              const payload = normalizeExport(await getHouseholdExport(householdId));
              const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
              const link = document.createElement('a');
              link.href = URL.createObjectURL(blob);
              link.download = `parent-ppto-${householdId}.json`;
              link.click();
              URL.revokeObjectURL(link.href);
            });
          }}
        >
          Export JSON
        </Button>
        {error && <p className="error">{error}</p>}
      </Card>

      <Card title="Household">
        <Button variant="ghost" onClick={() => setShowLeaveModal(true)}>
          Leave Household
        </Button>
      </Card>

      <Modal
        open={showLeaveModal}
        title="Leave household?"
        onClose={() => setShowLeaveModal(false)}
        actions={
          <>
            <Button variant="ghost" onClick={() => setShowLeaveModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                void runAction(async () => {
                  await leaveHousehold({ householdId, uid: user.uid });
                  clearHouseholdState();
                  setShowLeaveModal(false);
                });
              }}
              disabled={busy}
            >
              Leave
            </Button>
          </>
        }
      >
        <p className="text-muted">You'll need a code to re-join.</p>
      </Modal>
    </PageContainer>
  );
}
