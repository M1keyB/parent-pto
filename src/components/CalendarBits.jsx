import dayjs from 'dayjs';
import { startOfWeek, toDateKey } from '../lib/dates';

export function WeekStrip({ selectedDate, onSelectDate }) {
  const start = startOfWeek(selectedDate);

  return (
    <div className="week-grid">
      {Array.from({ length: 7 }).map((_, index) => {
        const current = start.add(index, 'day');
        const key = current.format('YYYY-MM-DD');
        const selected = toDateKey(selectedDate) === key;
        return (
          <button key={key} className={selected ? 'day-chip active' : 'day-chip'} onClick={() => onSelectDate(current.toDate())}>
            <span>{current.format('ddd')}</span>
            <strong>{current.format('D')}</strong>
          </button>
        );
      })}
    </div>
  );
}

export function EventRow({ event, label }) {
  const start = event.startAt?.toDate ? dayjs(event.startAt.toDate()) : dayjs(event.startAt);
  const end = event.endAt?.toDate ? dayjs(event.endAt.toDate()) : dayjs(event.endAt);

  return (
    <div className="event-row">
      <div>
        <p className="event-label">{label}</p>
        <strong>{event.title}</strong>
      </div>
      <span className="text-muted">
        {start.format('h:mm A')} - {end.format('h:mm A')}
      </span>
    </div>
  );
}

