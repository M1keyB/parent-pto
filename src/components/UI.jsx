import clsx from 'clsx';
import { NavLink } from 'react-router-dom';
import dayjs from 'dayjs';

export function PageContainer({ title, subtitle, children, headerActions }) {
  return (
    <div className="page page-enter">
      <header className="page-header">
        <div>
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {headerActions}
      </header>
      <div className="stack-lg">{children}</div>
    </div>
  );
}

export function Card({ title, subtitle, actions, children, className }) {
  return (
    <section className={clsx('card', className)}>
      {(title || subtitle || actions) && (
        <header className="card-header">
          <div>
            {title && <h2>{title}</h2>}
            {subtitle && <p>{subtitle}</p>}
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

export function Button({ children, variant = 'primary', size = 'md', className, ...props }) {
  return (
    <button className={clsx('btn', `btn-${variant}`, `btn-${size}`, className)} {...props}>
      {children}
    </button>
  );
}

export function Input({ label, id, className, ...props }) {
  return (
    <label className={clsx('field', className)} htmlFor={id}>
      {label && <span className="field-label">{label}</span>}
      <input id={id} {...props} />
    </label>
  );
}

export function Select({ label, id, className, children, ...props }) {
  return (
    <label className={clsx('field', className)} htmlFor={id}>
      {label && <span className="field-label">{label}</span>}
      <select id={id} {...props}>
        {children}
      </select>
    </label>
  );
}

export function Modal({ open, title, children, onClose, actions }) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div className="modal-card" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <header className="modal-header">
          <h3>{title}</h3>
        </header>
        <div className="modal-body">{children}</div>
        {actions && <footer className="modal-actions">{actions}</footer>}
      </div>
    </div>
  );
}

export function TabBar({ links }) {
  return (
    <nav className="tab-bar" aria-label="Primary">
      {links.map((item) => (
        <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => clsx('tab-item', isActive && 'active')}>
          <span className="tab-icon" aria-hidden="true">
            {item.icon}
          </span>
          <span className="tab-label">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export function TaskItem({ task, disabled, onToggle, onOptions }) {
  const isDone = task.status === 'done';
  const doneTime = task.doneAt?.toDate?.() ? dayjs(task.doneAt.toDate()).format('h:mm A') : dayjs().format('h:mm A');
  return (
    <div className="task-row">
      <button
        type="button"
        className={clsx('task-item', isDone && 'done', task._optimistic && 'optimistic')}
        onClick={onToggle}
        disabled={disabled || isDone}
      >
        <span className={clsx('check-badge', isDone && 'checked')} aria-hidden="true">
          {isDone ? 'v' : ''}
        </span>
        <span className="task-content">
          <strong>{task.title}</strong>
          <small>
            {task.category} - {task.points} pts
          </small>
        </span>
        <span className="task-meta">{isDone ? doneTime : 'Open'}</span>
      </button>
      {onOptions && (
        <button
          type="button"
          className="task-options-btn"
          onClick={() => onOptions(task)}
          disabled={disabled}
          aria-label={`Task options for ${task.title}`}
        >
          ...
        </button>
      )}
    </div>
  );
}

export function Pill({ children, className = '' }) {
  return <span className={clsx('pill', className)}>{children}</span>;
}

export function EmptyState({ icon = 'o', title = 'Nothing here yet', text }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <p className="empty-title">{title}</p>
      {text && <p className="empty-text">{text}</p>}
    </div>
  );
}

