import { vibeFromPercent } from '../lib/constants';

export function EnergyBar({ points = 0, threshold = 10, pointBank = 0 }) {
  const percent = Math.min(100, Math.round((pointBank / threshold) * 100));

  return (
    <div>
      <div className="energy-row">
        <strong>{points} effort points today</strong>
        <span>
          {pointBank}/{threshold} toward next mint
        </span>
      </div>
      <div className="energy-track" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
        <div className="energy-fill" style={{ width: `${percent}%` }} />
      </div>
      <p className="text-muted">{vibeFromPercent(percent)}</p>
    </div>
  );
}

