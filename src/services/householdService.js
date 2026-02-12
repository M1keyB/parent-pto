import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { toDateKey, minutesBetween, nowPlusMinutes } from '../lib/dates';
import { warmCopy } from '../lib/constants';

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function applyCredit(member, creditMinutes) {
  const balance = Number(member.ptoBalanceMinutes ?? 0);
  const overdraft = Number(member.overdraftMinutes ?? 0);
  const payback = Math.min(overdraft, creditMinutes);
  return {
    ptoBalanceMinutes: balance + (creditMinutes - payback),
    overdraftMinutes: overdraft - payback,
  };
}

function applyDebit(member, spendMinutes, overdraftLimit = 30) {
  const balance = Number(member.ptoBalanceMinutes ?? 0);
  const overdraft = Number(member.overdraftMinutes ?? 0);
  const spendFromBalance = Math.min(balance, spendMinutes);
  const remaining = spendMinutes - spendFromBalance;
  if (overdraft + remaining > overdraftLimit) {
    throw new Error('Not enough PTO minutes right now.');
  }

  return {
    ptoBalanceMinutes: balance - spendFromBalance,
    overdraftMinutes: overdraft + remaining,
  };
}

function getConversion(household) {
  const thresholdPoints = Number(household?.ptoConversion?.thresholdPoints ?? 10);
  const minutesPerThreshold = Number(household?.ptoConversion?.minutesPerThreshold ?? 10);
  return { thresholdPoints, minutesPerThreshold };
}

function getLoggerShare(household) {
  return clamp(Number(household?.split?.loggerShare ?? 0.6), 0.5, 0.8);
}

function createCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export async function createHousehold({ uid, householdName, displayName, partnerName }) {
  const householdRef = doc(collection(db, 'households'));
  const code = createCode();
  const codeRef = doc(db, 'householdCodes', code);

  await runTransaction(db, async (transaction) => {
    transaction.set(householdRef, {
      name: householdName,
      code,
      createdAt: serverTimestamp(),
      pointBank: 0,
      split: { loggerShare: 0.6 },
      ptoConversion: { thresholdPoints: 10, minutesPerThreshold: 10 },
      tone: 'gentle',
      members: {
        [uid]: {
          displayName,
          role: 'parent',
        },
      },
      pendingPartnerName: partnerName,
    });

    transaction.set(doc(db, 'households', householdRef.id, 'members', uid), {
      displayName,
      joinedAt: serverTimestamp(),
      ptoBalanceMinutes: 0,
      overdraftMinutes: 0,
    });

    transaction.set(doc(db, 'users', uid), {
      householdId: householdRef.id,
      displayName,
      updatedAt: serverTimestamp(),
    });

    transaction.set(codeRef, {
      householdId: householdRef.id,
      createdAt: serverTimestamp(),
    });

    transaction.set(doc(collection(db, 'households', householdRef.id, 'feed')), {
      type: 'ACK',
      text: 'Household created. Cozy mode enabled.',
      createdAt: serverTimestamp(),
      actorUid: uid,
    });

    const starterTasks = [
      { title: 'Kitchen reset', category: 'Chore', points: 4 },
      { title: 'Bedtime handoff', category: 'Kid Time', points: 5 },
      { title: 'School forms + calendar', category: 'Life Admin', points: 6 },
      { title: 'Emotional weather check-in', category: 'Emotional Labor', points: 5 },
    ];

    starterTasks.forEach((task) => {
      transaction.set(doc(collection(db, 'households', householdRef.id, 'taskTemplates')), {
        ...task,
        active: true,
        createdAt: serverTimestamp(),
        createdBy: uid,
      });
    });
  });

  return householdRef.id;
}

export async function joinHousehold({ uid, householdId, displayName }) {
  const householdRef = doc(db, 'households', householdId);
  const memberRef = doc(db, 'households', householdId, 'members', uid);

  await runTransaction(db, async (transaction) => {
    const householdSnap = await transaction.get(householdRef);
    if (!householdSnap.exists()) {
      throw new Error('Household code not found.');
    }

    const household = householdSnap.data();
    const existingMembers = household.members ?? {};

    transaction.update(householdRef, {
      [`members.${uid}`]: { displayName, role: 'parent' },
    });

    transaction.set(memberRef, {
      displayName,
      joinedAt: serverTimestamp(),
      ptoBalanceMinutes: 0,
      overdraftMinutes: 0,
    });

    transaction.set(doc(db, 'users', uid), {
      householdId,
      displayName,
      updatedAt: serverTimestamp(),
    });

    transaction.set(doc(collection(db, 'households', householdId, 'feed')), {
      type: 'ACK',
      text:
        Object.keys(existingMembers).length > 0
          ? `${displayName} joined the house squad.`
          : `${displayName} opened the household.`,
      createdAt: serverTimestamp(),
      actorUid: uid,
    });
  });
}

export async function createTaskTemplate({ householdId, uid, title, category, points }) {
  await setDoc(doc(collection(db, 'households', householdId, 'taskTemplates')), {
    title,
    category,
    points,
    active: true,
    createdBy: uid,
    createdAt: serverTimestamp(),
  });
}

export async function deleteTaskTemplate({ householdId, templateId }) {
  await deleteDoc(doc(db, 'households', householdId, 'taskTemplates', templateId));
}

export async function addDailyTask({ householdId, uid, dateKey, title, category, points }) {
  await setDoc(doc(collection(db, 'households', householdId, 'dailyTasks', dateKey, 'items')), {
    title,
    category,
    points,
    status: 'open',
    createdAt: serverTimestamp(),
    createdByUid: uid,
  });
}

export async function updateDailyTask({
  householdId,
  sourceDateKey,
  itemId,
  title,
  category,
  points,
  targetDateKey,
}) {
  const fromDateKey = sourceDateKey;
  const toDateKey = targetDateKey ?? sourceDateKey;
  const sourceRef = doc(db, 'households', householdId, 'dailyTasks', fromDateKey, 'items', itemId);

  if (fromDateKey === toDateKey) {
    await updateDoc(sourceRef, {
      title,
      category,
      points: Number(points),
      updatedAt: serverTimestamp(),
    });
    return;
  }

  const taskSnap = await getDoc(sourceRef);
  if (!taskSnap.exists()) {
    throw new Error('Task not found.');
  }

  const task = taskSnap.data();
  await setDoc(doc(collection(db, 'households', householdId, 'dailyTasks', toDateKey, 'items')), {
    ...task,
    title,
    category,
    points: Number(points),
    updatedAt: serverTimestamp(),
  });
  await deleteDoc(sourceRef);
}

export async function deleteDailyTask({ householdId, dateKey, itemId }) {
  await deleteDoc(doc(db, 'households', householdId, 'dailyTasks', dateKey, 'items', itemId));
}

export async function cloneTemplateToDay({ householdId, uid, templateId, dateKey }) {
  const templateRef = doc(db, 'households', householdId, 'taskTemplates', templateId);
  const templateSnap = await getDoc(templateRef);
  if (!templateSnap.exists()) {
    throw new Error('Template not found.');
  }
  const template = templateSnap.data();
  await addDailyTask({
    householdId,
    uid,
    dateKey,
    title: template.title,
    category: template.category,
    points: Number(template.points ?? 0),
  });
}

export async function markTaskDone({ householdId, dateKey = toDateKey(), itemId, uid }) {
  const householdRef = doc(db, 'households', householdId);
  const taskRef = doc(db, 'households', householdId, 'dailyTasks', dateKey, 'items', itemId);
  const statsRef = doc(db, 'households', householdId, 'stats', dateKey);

  await runTransaction(db, async (transaction) => {
    const [householdSnap, taskSnap] = await Promise.all([
      transaction.get(householdRef),
      transaction.get(taskRef),
    ]);

    if (!householdSnap.exists() || !taskSnap.exists()) {
      throw new Error('Task or household missing.');
    }

    const task = taskSnap.data();
    if (task.status === 'done') {
      return;
    }

    const household = householdSnap.data();
    const points = Number(task.points ?? 0);
    const priorPointBank = Number(household.pointBank ?? 0);
    const { thresholdPoints, minutesPerThreshold } = getConversion(household);
    const loggerShare = getLoggerShare(household);

    const totalBank = priorPointBank + points;
    const thresholdCrossings = Math.floor(totalBank / thresholdPoints);
    const mintedMinutes = thresholdCrossings * minutesPerThreshold;
    const nextPointBank = totalBank - thresholdCrossings * thresholdPoints;

    const memberUids = Object.keys(household.members ?? {});
    const partnerUid = memberUids.find((memberUid) => memberUid !== uid);

    let loggerRef = null;
    let loggerNext = null;
    let partnerRef = null;
    let partnerNext = null;

    if (mintedMinutes > 0) {
      const loggerRaw = Math.round(mintedMinutes * loggerShare);
      const partnerRaw = mintedMinutes - loggerRaw;

      loggerRef = doc(db, 'households', householdId, 'members', uid);
      const loggerSnap = await transaction.get(loggerRef);
      loggerNext = applyCredit(loggerSnap.exists() ? loggerSnap.data() : {}, loggerRaw);

      if (partnerUid) {
        partnerRef = doc(db, 'households', householdId, 'members', partnerUid);
        const partnerSnap = await transaction.get(partnerRef);
        partnerNext = applyCredit(partnerSnap.exists() ? partnerSnap.data() : {}, partnerRaw);
      }
    }

    transaction.update(taskRef, {
      status: 'done',
      doneByUid: uid,
      doneAt: serverTimestamp(),
    });

    transaction.set(
      statsRef,
      {
        dateKey,
        pointsTotal: increment(points),
        convertedMinutes: increment(mintedMinutes),
        tasksDone: increment(1),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    transaction.update(householdRef, { pointBank: nextPointBank });

    const taskDoneFeedRef = doc(collection(db, 'households', householdId, 'feed'));
    transaction.set(taskDoneFeedRef, {
      type: 'TASK_DONE',
      text: warmCopy('TASK_DONE', { name: household.members?.[uid]?.displayName }),
      createdAt: serverTimestamp(),
      actorUid: uid,
    });

    if (loggerRef && loggerNext) {
      transaction.set(loggerRef, loggerNext, { merge: true });
    }

    if (partnerRef && partnerNext) {
      transaction.set(partnerRef, partnerNext, { merge: true });
    }

    if (mintedMinutes > 0) {
      transaction.set(doc(collection(db, 'households', householdId, 'feed')), {
        type: 'PTO_EARNED',
        text: warmCopy('PTO_EARNED', { minutes: mintedMinutes }),
        createdAt: serverTimestamp(),
        actorUid: uid,
      });
    }
  });
}

export async function scheduleBreak({ householdId, uid, title, startAt, minutes }) {
  const endAt = new Date(startAt.getTime() + minutes * 60000);
  await setDoc(doc(collection(db, 'households', householdId, 'events')), {
    type: 'BREAK',
    title,
    ownerUid: uid,
    startAt,
    endAt,
    minutes,
    status: 'scheduled',
    createdAt: serverTimestamp(),
    metadata: {},
  });
  await setDoc(doc(collection(db, 'households', householdId, 'feed')), {
    type: 'BREAK_SCHEDULED',
    text: warmCopy('BREAK_SCHEDULED', {}),
    createdAt: serverTimestamp(),
    actorUid: uid,
  });
}

export async function startBreakNow({ householdId, uid, minutes, title }) {
  const memberRef = doc(db, 'households', householdId, 'members', uid);
  const eventRef = doc(collection(db, 'households', householdId, 'events'));
  const startAt = new Date();
  const endAt = nowPlusMinutes(minutes);

  await runTransaction(db, async (transaction) => {
    const memberSnap = await transaction.get(memberRef);
    if (!memberSnap.exists()) {
      throw new Error('Member record missing.');
    }

    const nextMember = applyDebit(memberSnap.data(), minutes);
    transaction.set(memberRef, nextMember, { merge: true });

    transaction.set(eventRef, {
      type: 'BREAK',
      title,
      ownerUid: uid,
      startAt,
      endAt,
      minutes,
      status: 'active',
      createdAt: serverTimestamp(),
      metadata: {
        chargedMinutes: minutes,
      },
    });

    transaction.set(doc(collection(db, 'households', householdId, 'feed')), {
      type: 'BREAK_SCHEDULED',
      text: `${title} started. Deep breath window is open.`,
      createdAt: serverTimestamp(),
      actorUid: uid,
    });
  });
}

export async function finishBreakEarly({ householdId, uid, eventId }) {
  const eventRef = doc(db, 'households', householdId, 'events', eventId);
  const memberRef = doc(db, 'households', householdId, 'members', uid);

  await runTransaction(db, async (transaction) => {
    const [eventSnap, memberSnap] = await Promise.all([transaction.get(eventRef), transaction.get(memberRef)]);
    if (!eventSnap.exists() || !memberSnap.exists()) {
      throw new Error('Break not found.');
    }

    const event = eventSnap.data();
    if (event.status !== 'active' || event.ownerUid !== uid) {
      throw new Error('Only active personal breaks can be ended.');
    }

    const now = new Date();
    const used = Math.min(Number(event.minutes ?? 0), minutesBetween(event.startAt.toDate(), now));
    const refund = Number(event.minutes ?? 0) - used;

    const nextMember = applyCredit(memberSnap.data(), refund);

    transaction.update(eventRef, {
      status: 'completed',
      endAt: now,
      minutesUsed: used,
      refundMinutes: refund,
    });

    transaction.set(memberRef, nextMember, { merge: true });

    transaction.set(doc(collection(db, 'households', householdId, 'feed')), {
      type: 'ACK',
      text: refund > 0 ? `Break wrapped early. ${refund} minute refund landed.` : 'Break wrapped right on time.',
      createdAt: serverTimestamp(),
      actorUid: uid,
    });
  });
}

export async function requestDecompression({ householdId, uid, minutes, title }) {
  const memberRef = doc(db, 'households', householdId, 'members', uid);
  const eventRef = doc(collection(db, 'households', householdId, 'events'));
  const startAt = new Date();
  const endAt = nowPlusMinutes(minutes);

  await runTransaction(db, async (transaction) => {
    const memberSnap = await transaction.get(memberRef);
    if (!memberSnap.exists()) {
      throw new Error('Member record missing.');
    }

    const nextMember = applyDebit(memberSnap.data(), minutes);

    transaction.set(memberRef, nextMember, { merge: true });
    transaction.set(eventRef, {
      type: 'DECOMPRESSION_REQUEST',
      title,
      ownerUid: uid,
      startAt,
      endAt,
      minutes,
      status: 'active',
      createdAt: serverTimestamp(),
      metadata: {},
    });

    transaction.set(doc(collection(db, 'households', householdId, 'feed')), {
      type: 'DECOMP_REQUESTED',
      text: warmCopy('DECOMP_REQUESTED', {}),
      createdAt: serverTimestamp(),
      actorUid: uid,
    });
  });
}

export async function acknowledgeDecompression({ householdId, eventId, uid, response, copy }) {
  await updateDoc(doc(db, 'households', householdId, 'events', eventId), {
    'metadata.response': response,
    'metadata.respondedByUid': uid,
    'metadata.respondedAt': serverTimestamp(),
  });

  await setDoc(doc(collection(db, 'households', householdId, 'feed')), {
    type: 'ACK',
    text: warmCopy('ACK', { copy }),
    createdAt: serverTimestamp(),
    actorUid: uid,
  });
}

export async function saveHouseholdSettings({ householdId, updates }) {
  await updateDoc(doc(db, 'households', householdId), updates);
}

export async function saveDisplayNames({
  householdId,
  uid,
  myDisplayName,
  partnerUid,
  partnerDisplayName,
}) {
  const batch = writeBatch(db);
  const householdRef = doc(db, 'households', householdId);

  batch.update(householdRef, {
    [`members.${uid}.displayName`]: myDisplayName,
    pendingPartnerName: partnerDisplayName,
  });

  batch.set(
    doc(db, 'households', householdId, 'members', uid),
    {
      displayName: myDisplayName,
    },
    { merge: true }
  );

  batch.set(
    doc(db, 'users', uid),
    {
      displayName: myDisplayName,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  if (partnerUid && partnerDisplayName.trim()) {
    batch.update(householdRef, {
      [`members.${partnerUid}.displayName`]: partnerDisplayName.trim(),
    });
    batch.set(
      doc(db, 'households', householdId, 'members', partnerUid),
      {
        displayName: partnerDisplayName.trim(),
      },
      { merge: true }
    );
  }

  await batch.commit();
}

export async function leaveHousehold({ householdId, uid }) {
  const householdRef = doc(db, 'households', householdId);
  const userRef = doc(db, 'users', uid);

  await runTransaction(db, async (transaction) => {
    const householdSnap = await transaction.get(householdRef);
    if (!householdSnap.exists()) {
      transaction.set(userRef, { householdId: null, updatedAt: serverTimestamp() }, { merge: true });
      return;
    }

    transaction.update(householdRef, {
      [`members.${uid}`]: deleteField(),
    });

    transaction.set(
      userRef,
      {
        householdId: null,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  });
}

export async function getHouseholdExport(householdId) {
  const [householdSnap, membersSnap, templatesSnap, eventsSnap] = await Promise.all([
    getDoc(doc(db, 'households', householdId)),
    getDocs(collection(db, 'households', householdId, 'members')),
    getDocs(query(collection(db, 'households', householdId, 'taskTemplates'), where('active', '==', true))),
    getDocs(query(collection(db, 'households', householdId, 'events'))),
  ]);

  return {
    household: householdSnap.exists() ? householdSnap.data() : null,
    members: membersSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })),
    templates: templatesSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })),
    events: eventsSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })),
    exportedAt: new Date().toISOString(),
  };
}
