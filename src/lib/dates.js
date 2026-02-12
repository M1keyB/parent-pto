import dayjs from 'dayjs';

export function toDateKey(input = new Date()) {
  return dayjs(input).format('YYYY-MM-DD');
}

export function nowPlusMinutes(minutes) {
  return dayjs().add(minutes, 'minute').toDate();
}

export function minutesBetween(startDate, endDate) {
  const ms = endDate.getTime() - startDate.getTime();
  return Math.max(0, Math.ceil(ms / 60000));
}

export function startOfWeek(day) {
  const date = dayjs(day);
  const dayIndex = (date.day() + 6) % 7;
  return date.subtract(dayIndex, 'day');
}

export function formatMinutes(total) {
  return `${Math.max(0, Math.round(total))} min`;
}
