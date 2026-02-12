import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { useAuth } from '../context/AuthContext';
import { useHousehold } from '../context/HouseholdContext';
import { Button, Card, EmptyState, PageContainer, Pill, Select } from '../components/UI';
import { EnergyBar } from '../components/EnergyBar';
import { DECOMPRESSION_CHOICES, ACK_OPTIONS } from '../lib/constants';
import { markTaskDone, requestDecompression, acknowledgeDecompression } from '../services/householdService';
import { useActionState } from '../hooks/useActionState';

function formatStamp(stamp) {
  if (!stamp) return 'just now';
  const date = stamp.toDate ? stamp.toDate() : new Date(stamp);
  return dayjs(date).format('ddd h:mm A');
}

export function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { householdId, household, me, partner, todayStats, todayTasks, feed, events } = useHousehold();
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [requestMinutes, setRequestMinutes] = useState(20);
  const { busy, error, runAction } = useActionState();

  const openTasks = useMemo(() => todayTasks.filter((task) => task.status === 'open'), [todayTasks]);
  const incomingRequests = useMemo(
    () =>
      events.filter(
        (event) =>
          event.type === 'DECOMPRESSION_REQUEST' &&
          event.ownerUid !== user.uid &&
          !event.metadata?.response
      ),
    [events, user.uid]
  );

  async function handleMarkDone() {
    if (!selectedTaskId) return;
    const result = await runAction(async () => {
      await markTaskDone({ householdId, itemId: selectedTaskId, uid: user.uid });
      setSelectedTaskId('');
    });
    if (!result.ok) return;
  }

  async function handleRequestDecompression() {
    await runAction(async () => {
      await requestDecompression({
        householdId,
        uid: user.uid,
        minutes: Number(requestMinutes),
        title: `${me?.displayName ?? 'Parent'} ${requestMinutes} min recharge`,
      });
    });
  }

  return (
    <PageContainer title="Today" subtitle="Keep the house steady with tiny coordinated wins.">
      <Card
        title="Household Energy"
        subtitle="Every done task nudges this bar toward PTO minting."
        actions={<Pill>Code {household?.code ?? '----'}</Pill>}
      >
        <EnergyBar
          points={todayStats?.pointsTotal ?? 0}
          threshold={household?.ptoConversion?.thresholdPoints ?? 10}
          pointBank={household?.pointBank ?? 0}
        />
      </Card>

      <div className="two-col">
        <Card title="You" subtitle="Available PTO">
          <p className="balance">{me?.ptoBalanceMinutes ?? 0} min</p>
          {(me?.overdraftMinutes ?? 0) > 0 && (
            <p className="text-muted">
              We borrowed a little calm from tomorrow: {me.overdraftMinutes} min overdraft.
            </p>
          )}
        </Card>
        <Card title={partner?.displayName ?? 'Partner'} subtitle="Partner PTO">
          <p className="balance">{partner?.ptoBalanceMinutes ?? 0} min</p>
          {(partner?.overdraftMinutes ?? 0) > 0 && <p className="text-muted">Overdraft: {partner.overdraftMinutes} min</p>}
        </Card>
      </div>

      <Card title="Quick Actions" subtitle="Fast controls for the busiest moments.">
        <div className="grid-actions">
          <Button onClick={() => navigate('/tasks')}>Add / Plan Tasks</Button>
          <Button onClick={handleMarkDone} disabled={!selectedTaskId || busy}>
            Mark something done
          </Button>
          <Button onClick={handleRequestDecompression} disabled={busy}>
            Request Decompression
          </Button>
          <Button variant="secondary" onClick={() => navigate('/breaks')}>Schedule PTO Break</Button>
        </div>

        <div className="inline-fields">
          <Select value={selectedTaskId} onChange={(event) => setSelectedTaskId(event.target.value)} aria-label="Open tasks">
            <option value="">Pick an open task...</option>
            {openTasks.map((task) => (
              <option key={task.id} value={task.id}>
                {task.title} ({task.points} pts)
              </option>
            ))}
          </Select>
          <Select value={requestMinutes} onChange={(event) => setRequestMinutes(Number(event.target.value))} aria-label="Request minutes">
            {DECOMPRESSION_CHOICES.map((minutes) => (
              <option key={minutes} value={minutes}>
                Decompress {minutes} min
              </option>
            ))}
          </Select>
        </div>
        {error && <p className="error">{error}</p>}
      </Card>

      <Card title="Decompression Inbox" subtitle="Pressure valve requests from your partner.">
        {incomingRequests.length === 0 ? (
          <EmptyState icon="~" title="Inbox is quiet" text="No pending decompression asks right now." />
        ) : (
          <div className="stack">
            {incomingRequests.map((request) => (
              <div key={request.id} className="request-row">
                <div>
                  <strong>{request.title}</strong>
                  <p className="text-muted">{request.minutes} min requested</p>
                </div>
                <div className="ack-row">
                  {ACK_OPTIONS.map((option) => (
                    <Button
                      key={option.value}
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        runAction(() =>
                          acknowledgeDecompression({
                            householdId,
                            eventId: request.id,
                            uid: user.uid,
                            response: option.value,
                            copy: option.copy,
                          })
                        )
                      }
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Recent Feed" subtitle="Warm, tiny status pings.">
        {feed.length === 0 ? (
          <EmptyState icon="*" title="Your feed starts here" text="As tasks and breaks happen, updates will appear here." />
        ) : (
          <div className="stack">
            {feed.map((item) => (
              <div key={item.id} className="feed-row">
                <Pill>{item.type.replace('_', ' ')}</Pill>
                <p>{item.text}</p>
                <span>{formatStamp(item.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </PageContainer>
  );
}

