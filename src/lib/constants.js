export const CATEGORY_OPTIONS = ['Chore', 'Kid Time', 'Life Admin', 'Emotional Labor'];

export const DECOMPRESSION_CHOICES = [10, 20, 30, 60];

export const ACK_OPTIONS = [
  { value: 'got_it', label: 'Got it', copy: 'Copy that. I got this pocket of time covered.' },
  { value: 'in_5', label: 'In 5', copy: 'Copy. Launching in five.' },
  { value: 'delay_15', label: 'Can we do 15?', copy: 'Copy. I can cover in 15.' },
];

export function vibeFromPercent(percent) {
  if (percent < 35) return 'Home vibe: steady. Tiny wins still count.';
  if (percent < 75) return 'Home vibe: spicy but survivable.';
  return 'Home vibe: glow mode. You two are cooking.';
}

export function warmCopy(type, payload = {}) {
  switch (type) {
    case 'TASK_DONE':
      return `${payload.name ?? 'Someone'} did a thing. The house noticed.`;
    case 'PTO_EARNED':
      return `PTO minted: ${payload.minutes ?? 0} minute tiny victory.`;
    case 'BREAK_SCHEDULED':
      return `${payload.name ?? 'A parent'} reserved a calm window.`;
    case 'DECOMP_REQUESTED':
      return `${payload.name ?? 'A parent'} requested a reset. Team mode on.`;
    case 'ACK':
      return payload.copy ?? 'Response logged with care.';
    default:
      return 'Family sync happened.';
  }
}
