import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { useAuth } from '../context/AuthContext';
import { useHousehold } from '../context/HouseholdContext';
import { useToast } from '../context/ToastContext';
import { Button, Card, EmptyState, Input, PageContainer, Pill, Select } from '../components/UI';
import { finishBreakEarly, scheduleBreak, startBreakNow } from '../services/householdService';
import { useActionState } from '../hooks/useActionState';

function formatTimer(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const secs = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, '0');
  return `${mins}:${secs}`;
}

export function BreaksPage() {
  const { user } = useAuth();
  const { householdId, me, events } = useHousehold();
  const { pushToast } = useToast();
  const [duration, setDuration] = useState(20);
  const [scheduleMinutes, setScheduleMinutes] = useState(30);
  const [scheduleTime, setScheduleTime] = useState(dayjs().add(1, 'hour').format('YYYY-MM-DDTHH:mm'));
  const [tick, setTick] = useState(Date.now());
  const { busy, error, runAction } = useActionState();

  useEffect(() => {
    const timer = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const activeMyBreak = useMemo(
    () => events.find((event) => event.type === 'BREAK' && event.ownerUid === user.uid && event.status === 'active') ?? null,
    [events, user.uid]
  );

  const activePartnerBreak = useMemo(
    () => events.find((event) => event.type === 'BREAK' && event.ownerUid !== user.uid && event.status === 'active') ?? null,
    [events, user.uid]
  );

  const scheduledBreaks = useMemo(() => events.filter((event) => event.type === 'BREAK' && event.status === 'scheduled'), [events]);

  const remainingSeconds = useMemo(() => {
    if (!activeMyBreak) return 0;
    const end = activeMyBreak.endAt?.toDate ? activeMyBreak.endAt.toDate().getTime() : new Date(activeMyBreak.endAt).getTime();
    return Math.max(0, Math.floor((end - tick) / 1000));
  }, [activeMyBreak, tick]);

  return (
    <PageContainer title="Breaks" subtitle="Protect recovery windows without losing track.">
      <Card title="Start Break Timer" subtitle="Minutes are charged now and refunded if ended early.">
        {activeMyBreak ? (
          <div className="stack">
            <p className="timer">{formatTimer(remainingSeconds)}</p>
            <div className="inline-fields">
              <Button variant="ghost" disabled>Active</Button>
              <Button
                onClick={() => {
                  void runAction(async () => {
                    await finishBreakEarly({ householdId, uid: user.uid, eventId: activeMyBreak.id });
                    pushToast('Break ended and refund applied.');
                  });
                }}
              >
                End early + refund
              </Button>
            </div>
          </div>
        ) : (
          <div className="inline-fields">
            <Select value={duration} onChange={(event) => setDuration(Number(event.target.value))} aria-label="Break duration">
              {[10, 15, 20, 30, 45, 60].map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes} min now
                </option>
              ))}
            </Select>
            <Button
              disabled={busy}
              onClick={() => {
                void runAction(async () => {
                  await startBreakNow({
                    householdId,
                    uid: user.uid,
                    minutes: duration,
                    title: `${me?.displayName ?? 'Parent'}'s ${duration} min break`,
                  });
                  pushToast('Break started.');
                });
              }}
            >
              Start break
            </Button>
          </div>
        )}
        {error && <p className="error">{error}</p>}
      </Card>

      <Card title="Partner Status">
        {activePartnerBreak ? (
          <div className="stack" style={{ gap: 8 }}>
            <p>{activePartnerBreak.title} is active.</p>
            <Pill className="pill-soft">Cover mode</Pill>
          </div>
        ) : (
          <EmptyState icon="?" title="Partner is available" text="No active break right now." />
        )}
      </Card>

      <Card title="Schedule a Future Break">
        <div className="inline-fields">
          <Input
            id="schedule-time"
            label="Start"
            type="datetime-local"
            value={scheduleTime}
            onChange={(event) => setScheduleTime(event.target.value)}
          />
          <Select label="Duration" value={scheduleMinutes} onChange={(event) => setScheduleMinutes(Number(event.target.value))}>
            {[20, 30, 45, 60, 90].map((minutes) => (
              <option key={minutes} value={minutes}>
                {minutes} min
              </option>
            ))}
          </Select>
          <Button
            onClick={() => {
              void runAction(async () => {
                await scheduleBreak({
                  householdId,
                  uid: user.uid,
                  title: `${me?.displayName ?? 'Parent'} scheduled ${scheduleMinutes} min PTO`,
                  startAt: new Date(scheduleTime),
                  minutes: scheduleMinutes,
                });
                pushToast('Break scheduled.');
              });
            }}
          >
            Schedule
          </Button>
        </div>
      </Card>

      <Card title="Upcoming Breaks">
        {scheduledBreaks.length === 0 ? (
          <EmptyState icon="?" title="No scheduled breaks" text="Add one above so both of you can plan ahead." />
        ) : (
          <div className="stack">
            {scheduledBreaks.map((event) => {
              const start = event.startAt?.toDate ? dayjs(event.startAt.toDate()) : dayjs(event.startAt);
              return (
                <div key={event.id} className="event-row">
                  <div>
                    <strong>{event.title}</strong>
                    <p className="text-muted">{start.format('ddd h:mm A')}</p>
                  </div>
                  <Pill>{event.minutes} min</Pill>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </PageContainer>
  );
}

