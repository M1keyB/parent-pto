import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { collection, getDocs, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useHousehold } from '../context/HouseholdContext';
import { useToast } from '../context/ToastContext';
import { WeekStrip, EventRow } from '../components/CalendarBits';
import { Button, Card, EmptyState, Input, PageContainer, Pill, Select } from '../components/UI';
import { addDailyTask } from '../services/householdService';
import { useActionState } from '../hooks/useActionState';
import { CATEGORY_OPTIONS } from '../lib/constants';
import { toDateKey } from '../lib/dates';

export function CalendarPage() {
  const { user } = useAuth();
  const { householdId, events } = useHousehold();
  const { pushToast } = useToast();
  const { busy, error, runAction } = useActionState();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [tasks, setTasks] = useState([]);
  const [viewMode, setViewMode] = useState('week');
  const [dayTaskMap, setDayTaskMap] = useState({});
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(CATEGORY_OPTIONS[0]);
  const [points, setPoints] = useState(4);

  const selectedKey = toDateKey(selectedDate);
  const selectedDay = dayjs(selectedDate);
  const weekStart = selectedDay.startOf('week');
  const monthStart = selectedDay.startOf('month').startOf('week');
  const monthEnd = selectedDay.endOf('month').endOf('week');

  const visibleDateKeys = useMemo(() => {
    if (viewMode === 'week') {
      return Array.from({ length: 7 }).map((_, index) => weekStart.add(index, 'day').format('YYYY-MM-DD'));
    }

    const days = monthEnd.diff(monthStart, 'day') + 1;
    return Array.from({ length: days }).map((_, index) => monthStart.add(index, 'day').format('YYYY-MM-DD'));
  }, [monthEnd, monthStart, viewMode, weekStart]);

  useEffect(() => {
    if (!householdId) return undefined;
    const unsubscribe = onSnapshot(
      query(collection(db, 'households', householdId, 'dailyTasks', selectedKey, 'items'), orderBy('createdAt', 'desc')),
      (snapshot) => {
        setTasks(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
      }
    );
    return unsubscribe;
  }, [householdId, selectedKey]);

  useEffect(() => {
    if (!householdId) {
      setDayTaskMap({});
      return undefined;
    }

    let cancelled = false;
    void (async () => {
      const entries = await Promise.all(
        visibleDateKeys.map(async (key) => {
          const snapshot = await getDocs(collection(db, 'households', householdId, 'dailyTasks', key, 'items'));
          return [
            key,
            snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })),
          ];
        })
      );

      if (!cancelled) {
        setDayTaskMap(Object.fromEntries(entries));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [householdId, visibleDateKeys]);

  const dayEvents = useMemo(
    () =>
      events.filter((event) => {
        const start = event.startAt?.toDate ? dayjs(event.startAt.toDate()) : dayjs(event.startAt);
        return start.format('YYYY-MM-DD') === selectedKey;
      }),
    [events, selectedKey]
  );

  const weekTasks = useMemo(
    () => Array.from({ length: 7 }).map((_, index) => weekStart.add(index, 'day')),
    [weekStart]
  );

  const monthGridDays = useMemo(() => {
    const days = monthEnd.diff(monthStart, 'day') + 1;
    return Array.from({ length: days }).map((_, index) => monthStart.add(index, 'day'));
  }, [monthEnd, monthStart]);

  async function handleAddTask(event) {
    event.preventDefault();
    if (!title.trim()) return;
    await runAction(async () => {
      await addDailyTask({
        householdId,
        uid: user.uid,
        dateKey: selectedKey,
        title: title.trim(),
        category,
        points: Number(points),
      });
      setTitle('');
      pushToast('Task added to selected day.');
    });
  }

  return (
    <PageContainer title="Planner" subtitle="Map tasks and recovery windows for the week.">
      <Card title="Plan View" subtitle="Tap a day to plan or review.">
        <div className="mode-toggle" style={{ marginBottom: 12 }}>
          <button type="button" className={viewMode === 'week' ? 'active' : ''} onClick={() => setViewMode('week')}>
            Week
          </button>
          <button type="button" className={viewMode === 'month' ? 'active' : ''} onClick={() => setViewMode('month')}>
            Month
          </button>
        </div>

        {viewMode === 'week' ? (
          <div className="stack">
            <WeekStrip selectedDate={selectedDate} onSelectDate={setSelectedDate} />
            <div className="stack">
              {weekTasks.map((day) => {
                const key = day.format('YYYY-MM-DD');
                const items = dayTaskMap[key] ?? [];
                return (
                  <button
                    key={key}
                    type="button"
                    className={selectedKey === key ? 'planner-day-row active' : 'planner-day-row'}
                    onClick={() => setSelectedDate(day.toDate())}
                  >
                    <div>
                      <strong>{day.format('ddd, MMM D')}</strong>
                      <p className="text-muted">
                        {items.length === 0
                          ? 'No tasks'
                          : items
                              .slice(0, 2)
                              .map((item) => item.title)
                              .join(' - ')}
                      </p>
                    </div>
                    <Pill>{items.length}</Pill>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="month-grid">
            {monthGridDays.map((day) => {
              const key = day.format('YYYY-MM-DD');
              const items = dayTaskMap[key] ?? [];
              const inMonth = day.month() === selectedDay.month();
              const selected = key === selectedKey;
              return (
                <button
                  key={key}
                  type="button"
                  className={`month-cell${selected ? ' active' : ''}${inMonth ? '' : ' muted'}`}
                  onClick={() => setSelectedDate(day.toDate())}
                >
                  <span>{day.format('D')}</span>
                  {items.length > 0 && <small>{items.length}</small>}
                </button>
              );
            })}
          </div>
        )}
      </Card>

      <Card title={dayjs(selectedDate).format('dddd, MMM D')} subtitle="Tasks">
        {tasks.length === 0 ? (
          <EmptyState icon="?" title="No tasks yet" text="Add one below for this day." />
        ) : (
          <div className="stack">
            {tasks.map((task) => (
              <div key={task.id} className="event-row">
                <div>
                  <strong>{task.title}</strong>
                  <p className="text-muted">{task.category}</p>
                </div>
                <Pill className={task.status === 'done' ? 'pill-done' : ''}>{task.status}</Pill>
              </div>
            ))}
          </div>
        )}

        <form className="stack" style={{ marginTop: 16 }} onSubmit={handleAddTask}>
          <Input
            id="planner-task-title"
            label="New task"
            placeholder="Add task for this day"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
          />
          <div className="inline-fields">
            <Select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Category">
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </Select>
            <Input type="number" min={1} max={20} value={points} onChange={(event) => setPoints(Number(event.target.value))} />
          </div>
          <Button type="submit" disabled={busy}>
            Add to {selectedKey}
          </Button>
        </form>

        {error && <p className="error">{error}</p>}
      </Card>

      <Card title="Breaks + Decompression">
        {dayEvents.length === 0 ? (
          <EmptyState icon="?" title="No events scheduled" text="Breaks and decompression requests for this day appear here." />
        ) : (
          <div className="stack">
            {dayEvents.map((event) => (
              <EventRow key={event.id} event={event} label={event.type === 'BREAK' ? 'PTO Break' : 'Decompression'} />
            ))}
          </div>
        )}
      </Card>
    </PageContainer>
  );
}
