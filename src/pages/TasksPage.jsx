import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useHousehold } from '../context/HouseholdContext';
import { useToast } from '../context/ToastContext';
import {
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  PageContainer,
  Select,
  TaskItem,
} from '../components/UI';
import { CATEGORY_OPTIONS } from '../lib/constants';
import {
  addDailyTask,
  cloneTemplateToDay,
  createTaskTemplate,
  deleteDailyTask,
  deleteTaskTemplate,
  markTaskDone,
  updateDailyTask,
} from '../services/householdService';
import { useActionState } from '../hooks/useActionState';
import { db } from '../lib/firebase';
import { toDateKey } from '../lib/dates';

export function TasksPage() {
  const { user } = useAuth();
  const { householdId, templates, todayTasks } = useHousehold();
  const { pushToast } = useToast();
  const [tab, setTab] = useState('today');
  const [dateKey, setDateKey] = useState(toDateKey());
  const [tasksForDay, setTasksForDay] = useState(todayTasks);
  const [pendingTasks, setPendingTasks] = useState([]);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(CATEGORY_OPTIONS[0]);
  const [points, setPoints] = useState(4);
  const [lastAddedLocalId, setLastAddedLocalId] = useState('');
  const [activeTask, setActiveTask] = useState(null);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState(CATEGORY_OPTIONS[0]);
  const [editPoints, setEditPoints] = useState(4);
  const [editDateKey, setEditDateKey] = useState(toDateKey());
  const [pendingDeletedTemplateIds, setPendingDeletedTemplateIds] = useState([]);
  const { busy, error, runAction } = useActionState();

  useEffect(() => {
    if (!householdId || dateKey === toDateKey()) {
      setTasksForDay(todayTasks);
      return;
    }

    const unsubscribe = onSnapshot(
      query(collection(db, 'households', householdId, 'dailyTasks', dateKey, 'items'), orderBy('createdAt', 'desc')),
      (snapshot) => {
        setTasksForDay(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
      }
    );

    return unsubscribe;
  }, [dateKey, householdId, todayTasks]);

  const displayedTasks = useMemo(() => [...pendingTasks, ...tasksForDay], [pendingTasks, tasksForDay]);
  const visibleTemplates = useMemo(
    () => templates.filter((template) => !pendingDeletedTemplateIds.includes(template.id)),
    [pendingDeletedTemplateIds, templates]
  );
  const doneCount = useMemo(() => displayedTasks.filter((task) => task.status === 'done').length, [displayedTasks]);

  async function handleQuickAdd(event) {
    event.preventDefault();
    if (!title.trim()) return;

    const localId = `pending-${Date.now()}`;
    const pendingTask = {
      id: localId,
      title: title.trim(),
      category,
      points: Number(points),
      status: 'open',
      _optimistic: true,
    };

    setPendingTasks((current) => [pendingTask, ...current]);
    setLastAddedLocalId(localId);

    const result = await runAction(async () => {
      await addDailyTask({
        householdId,
        uid: user.uid,
        dateKey,
        title: title.trim(),
        category,
        points: Number(points),
      });
      setTitle('');
      setPoints(4);
      pushToast('Task added. Nice momentum.');
    });

    setPendingTasks((current) => current.filter((task) => task.id !== localId));

    if (!result.ok) {
      setLastAddedLocalId('');
      return;
    }

    window.setTimeout(() => {
      setLastAddedLocalId('');
    }, 420);
  }

  async function handleTemplateAdd(event) {
    event.preventDefault();
    if (!title.trim()) return;

    const result = await runAction(async () => {
      await createTaskTemplate({
        householdId,
        uid: user.uid,
        title: title.trim(),
        category,
        points: Number(points),
      });
      setTitle('');
      setPoints(4);
      pushToast('Template saved.');
    });

    if (!result.ok) return;
  }

  async function handleMarkDone(task) {
    if (task.status === 'done' || task.id.startsWith('pending-')) {
      return;
    }

    const previous = task;
    const doneAt = new Date();
    setTasksForDay((current) =>
      current.map((item) =>
        item.id === task.id
          ? {
              ...item,
              status: 'done',
              doneByUid: user.uid,
              doneAt,
              _optimistic: true,
            }
          : item
      )
    );

    const result = await runAction(() =>
      markTaskDone({ householdId, dateKey, itemId: task.id, uid: user.uid })
    );

    if (!result.ok) {
      setTasksForDay((current) => current.map((item) => (item.id === task.id ? previous : item)));
      return;
    }

    pushToast('Task completed.');

    window.setTimeout(() => {
      setTasksForDay((current) =>
        current.map((item) => (item.id === task.id ? { ...item, _optimistic: false } : item))
      );
    }, 520);
  }

  function openTaskOptions(task) {
    if (task.id.startsWith('pending-')) return;
    setActiveTask(task);
    setShowOptionsModal(true);
  }

  function openEditModal() {
    if (!activeTask) return;
    setEditTitle(activeTask.title ?? '');
    setEditCategory(activeTask.category ?? CATEGORY_OPTIONS[0]);
    setEditPoints(Number(activeTask.points ?? 1));
    setEditDateKey(dateKey);
    setShowOptionsModal(false);
    setShowEditModal(true);
  }

  async function handleSaveEdit(event) {
    event.preventDefault();
    if (!activeTask || !editTitle.trim()) {
      return;
    }

    const snapshotBefore = tasksForDay;
    const optimisticDateMove = editDateKey !== dateKey;

    if (optimisticDateMove) {
      setTasksForDay((current) => current.filter((item) => item.id !== activeTask.id));
    } else {
      setTasksForDay((current) =>
        current.map((item) =>
          item.id === activeTask.id
            ? {
                ...item,
                title: editTitle.trim(),
                category: editCategory,
                points: Number(editPoints),
                _optimistic: true,
              }
            : item
        )
      );
    }

    const result = await runAction(async () => {
      await updateDailyTask({
        householdId,
        sourceDateKey: dateKey,
        itemId: activeTask.id,
        title: editTitle.trim(),
        category: editCategory,
        points: Number(editPoints),
        targetDateKey: editDateKey,
      });
      pushToast('Task updated.');
    });

    if (!result.ok) {
      setTasksForDay(snapshotBefore);
      return;
    }

    setShowEditModal(false);
    setActiveTask(null);
    window.setTimeout(() => {
      setTasksForDay((current) =>
        current.map((item) => (item.id === activeTask.id ? { ...item, _optimistic: false } : item))
      );
    }, 380);
  }

  async function handleDeleteTask() {
    if (!activeTask) return;
    const snapshotBefore = tasksForDay;
    setTasksForDay((current) => current.filter((item) => item.id !== activeTask.id));

    const result = await runAction(async () => {
      await deleteDailyTask({ householdId, dateKey, itemId: activeTask.id });
      pushToast('Task deleted.');
    });

    if (!result.ok) {
      setTasksForDay(snapshotBefore);
      return;
    }

    setShowDeleteModal(false);
    setActiveTask(null);
  }

  async function handleDeleteTemplate(templateId) {
    setPendingDeletedTemplateIds((current) => [...current, templateId]);
    const result = await runAction(async () => {
      await deleteTaskTemplate({ householdId, templateId });
      pushToast('Template deleted.');
    });

    if (!result.ok) {
      setPendingDeletedTemplateIds((current) => current.filter((id) => id !== templateId));
      return;
    }

    window.setTimeout(() => {
      setPendingDeletedTemplateIds((current) => current.filter((id) => id !== templateId));
    }, 250);
  }

  return (
    <PageContainer
      title="Tasks"
      subtitle={`${doneCount}/${displayedTasks.length} completed today`}
      headerActions={<span className="small-note">Tap once to mark complete</span>}
    >
      <Card>
        <div className="mode-toggle">
          <button type="button" className={tab === 'today' ? 'active' : ''} onClick={() => setTab('today')}>
            Daily Tasks
          </button>
          <button type="button" className={tab === 'templates' ? 'active' : ''} onClick={() => setTab('templates')}>
            Templates
          </button>
        </div>
      </Card>

      {tab === 'today' ? (
        <>
          <Card title="Daily List" subtitle="Small actions count.">
            <div className="inline-fields">
              <Input
                id="task-day"
                label="Date"
                type="date"
                value={dateKey}
                onChange={(event) => setDateKey(event.target.value)}
              />
            </div>

            {displayedTasks.length === 0 ? (
              <EmptyState
                icon="?"
                title="No tasks on this day yet"
                text="Add one below and keep the day realistic."
              />
            ) : (
              <div className="stack">
                {displayedTasks.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    disabled={busy}
                    onOptions={openTaskOptions}
                    onToggle={() => {
                      void handleMarkDone(task);
                    }}
                  />
                ))}
              </div>
            )}
          </Card>

          <Card title="Quick Add" subtitle="Instant insert with live sync.">
            <form className="stack" onSubmit={handleQuickAdd}>
              <Input
                id="task-title"
                label="Task title"
                placeholder="Unload dishwasher"
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
                <Input
                  id="task-points"
                  type="number"
                  min={1}
                  max={20}
                  value={points}
                  onChange={(event) => setPoints(Number(event.target.value))}
                />
              </div>
              <Button type="submit" disabled={busy} className={lastAddedLocalId ? 'pulse' : ''}>
                {busy ? 'Saving...' : 'Add Task'}
              </Button>
            </form>
          </Card>

          <Card title="From Templates">
            {visibleTemplates.length === 0 ? (
              <EmptyState icon="?" title="No templates yet" text="Create one in the Templates tab." />
            ) : (
              <div className="stack">
                {visibleTemplates.map((template) => (
                  <div key={template.id} className="event-row">
                    <div>
                      <strong>{template.title}</strong>
                      <p className="text-muted">
                        {template.category} - {template.points} points
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        void runAction(async () => {
                          await cloneTemplateToDay({
                            householdId,
                            uid: user.uid,
                            templateId: template.id,
                            dateKey,
                          });
                          pushToast('Template task added.');
                        });
                      }}
                    >
                      Add
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      ) : (
        <Card title="Task Templates" subtitle="Save repeatables for easier planning.">
          <form className="stack" onSubmit={handleTemplateAdd}>
            <Input
              id="template-title"
              label="Template title"
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
              <Input
                id="template-points"
                type="number"
                min={1}
                max={20}
                value={points}
                onChange={(event) => setPoints(Number(event.target.value))}
              />
            </div>
            <Button type="submit" disabled={busy}>
              {busy ? 'Saving...' : 'Save Template'}
            </Button>
          </form>

          <div className="stack" style={{ marginTop: 16 }}>
            {visibleTemplates.map((template) => (
              <div key={template.id} className="event-row">
                <div>
                  <strong>{template.title}</strong>
                  <p className="text-muted">
                    {template.category} - {template.points} points
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    void handleDeleteTemplate(template.id);
                  }}
                >
                  Delete
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {error && <p className="error">{error}</p>}

      <Modal
        open={showOptionsModal && !!activeTask}
        title="Task options"
        onClose={() => {
          setShowOptionsModal(false);
          setActiveTask(null);
        }}
        actions={
          <>
            <Button variant="ghost" onClick={() => setShowOptionsModal(false)}>
              Cancel
            </Button>
            <Button variant="secondary" onClick={openEditModal}>
              Edit Task
            </Button>
            <Button
              onClick={() => {
                setShowOptionsModal(false);
                setShowDeleteModal(true);
              }}
            >
              Delete Task
            </Button>
          </>
        }
      >
        <p className="text-muted">{activeTask?.title}</p>
      </Modal>

      <Modal
        open={showEditModal && !!activeTask}
        title="Edit task"
        onClose={() => {
          setShowEditModal(false);
          setActiveTask(null);
        }}
        actions={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setShowEditModal(false);
                setActiveTask(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" form="edit-task-form" disabled={busy}>
              Save
            </Button>
          </>
        }
      >
        <form id="edit-task-form" className="stack" onSubmit={handleSaveEdit}>
          <Input
            id="edit-task-title"
            label="Task title"
            value={editTitle}
            onChange={(event) => setEditTitle(event.target.value)}
            required
          />
          <div className="inline-fields">
            <Select
              id="edit-task-category"
              label="Category"
              value={editCategory}
              onChange={(event) => setEditCategory(event.target.value)}
            >
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </Select>
            <Input
              id="edit-task-points"
              label="Points"
              type="number"
              min={1}
              max={20}
              value={editPoints}
              onChange={(event) => setEditPoints(Number(event.target.value))}
            />
          </div>
          <Input
            id="edit-task-date"
            label="Date"
            type="date"
            value={editDateKey}
            onChange={(event) => setEditDateKey(event.target.value)}
          />
        </form>
      </Modal>

      <Modal
        open={showDeleteModal && !!activeTask}
        title="Delete task?"
        onClose={() => {
          setShowDeleteModal(false);
          setActiveTask(null);
        }}
        actions={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setShowDeleteModal(false);
                setActiveTask(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={() => void handleDeleteTask()} disabled={busy}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-muted">Delete "{activeTask?.title}"? This cannot be undone.</p>
      </Modal>
    </PageContainer>
  );
}

