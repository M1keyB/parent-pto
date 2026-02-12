import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './AuthContext';
import { toDateKey } from '../lib/dates';
import { useToast } from './ToastContext';

const HouseholdContext = createContext(null);

export function HouseholdProvider({ children }) {
  const { user } = useAuth();
  const { pushToast } = useToast();
  const [householdId, setHouseholdId] = useState(null);
  const [household, setHousehold] = useState(null);
  const [members, setMembers] = useState([]);
  const [todayStats, setTodayStats] = useState(null);
  const [todayTasks, setTodayTasks] = useState([]);
  const [events, setEvents] = useState([]);
  const [feed, setFeed] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [indexBanner, setIndexBanner] = useState('');
  const [loading, setLoading] = useState(true);
  const seenRequestIdsRef = useRef(new Set());

  const clearHouseholdState = useCallback(() => {
    setHouseholdId(null);
    setHousehold(null);
    setMembers([]);
    setTodayStats(null);
    setTodayTasks([]);
    setEvents([]);
    setFeed([]);
    setTemplates([]);
    setIndexBanner('');
    seenRequestIdsRef.current = new Set();
    try {
      localStorage.removeItem('householdId');
      sessionStorage.removeItem('householdId');
    } catch {
      // Ignore storage access issues.
    }
  }, []);

  useEffect(() => {
    if (!user) {
      clearHouseholdState();
      setLoading(false);
      return;
    }

    const userRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userRef, (snapshot) => {
      const householdFromDoc = snapshot.exists() ? snapshot.data().householdId : null;
      setHouseholdId(householdFromDoc ?? null);
      setLoading(false);
    });

    return unsubscribe;
  }, [clearHouseholdState, user]);

  useEffect(() => {
    if (!householdId) {
      setHousehold(null);
      setMembers([]);
      setTodayStats(null);
      setTodayTasks([]);
      setEvents([]);
      setFeed([]);
      setTemplates([]);
      setIndexBanner('');
      return;
    }

    const unsubscribers = [];
    const today = toDateKey();

    unsubscribers.push(onSnapshot(doc(db, 'households', householdId), (snapshot) => {
      setHousehold(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null);
    }));

    unsubscribers.push(
      onSnapshot(collection(db, 'households', householdId, 'members'), (snapshot) => {
        setMembers(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
      })
    );

    unsubscribers.push(
      onSnapshot(doc(db, 'households', householdId, 'stats', today), (snapshot) => {
        setTodayStats(snapshot.exists() ? snapshot.data() : null);
      })
    );

    unsubscribers.push(
      onSnapshot(
        query(
          collection(db, 'households', householdId, 'dailyTasks', today, 'items'),
          orderBy('createdAt', 'desc')
        ),
        (snapshot) => {
          setTodayTasks(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
        }
      )
    );

    unsubscribers.push(
      onSnapshot(
        query(collection(db, 'households', householdId, 'events'), orderBy('startAt', 'desc')),
        (snapshot) => {
          const nextEvents = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
          setEvents(nextEvents);

          nextEvents
            .filter(
              (item) =>
                item.type === 'DECOMPRESSION_REQUEST' &&
                item.ownerUid !== user?.uid &&
                !item.metadata?.response
            )
            .forEach((item) => {
              if (!seenRequestIdsRef.current.has(item.id)) {
                seenRequestIdsRef.current.add(item.id);
                pushToast('New decompression request just landed.');
              }
            });
        }
      )
    );

    unsubscribers.push(
      onSnapshot(
        query(collection(db, 'households', householdId, 'feed'), orderBy('createdAt', 'desc')),
        (snapshot) => {
          setFeed(snapshot.docs.slice(0, 25).map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
        }
      )
    );

    unsubscribers.push(
      onSnapshot(
        query(
          collection(db, 'households', householdId, 'taskTemplates'),
          where('active', '==', true),
          orderBy('title')
        ),
        (snapshot) => {
          setIndexBanner('');
          setTemplates(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
        },
        (error) => {
          const isMissingIndex = error?.code === 'failed-precondition';
          if (isMissingIndex) {
            setIndexBanner('Building database index... try again in a minute.');
          }
          setTemplates([]);
        }
      )
    );

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [householdId, pushToast, user?.uid]);

  const decompressionBadgeCount = useMemo(
    () =>
      events.filter(
        (item) =>
          item.type === 'DECOMPRESSION_REQUEST' && item.ownerUid !== user?.uid && !item.metadata?.response
      ).length,
    [events, user?.uid]
  );

  const me = useMemo(() => members.find((member) => member.id === user?.uid) ?? null, [members, user?.uid]);
  const partner = useMemo(() => members.find((member) => member.id !== user?.uid) ?? null, [members, user?.uid]);

  const value = useMemo(
    () => ({
      householdId,
      household,
      members,
      me,
      partner,
      todayStats,
      todayTasks,
      events,
      feed,
      templates,
      indexBanner,
      loading,
      decompressionBadgeCount,
      clearHouseholdState,
    }),
    [
      householdId,
      household,
      members,
      me,
      partner,
      todayStats,
      todayTasks,
      events,
      feed,
      templates,
      indexBanner,
      loading,
      decompressionBadgeCount,
      clearHouseholdState,
    ]
  );

  return <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>;
}

export function useHousehold() {
  const context = useContext(HouseholdContext);
  if (!context) {
    throw new Error('useHousehold must be used inside HouseholdProvider');
  }
  return context;
}

export async function getHouseholdByCode(code) {
  const normalized = code.trim().toUpperCase();
  const match = await getDoc(doc(db, 'householdCodes', normalized));
  if (!match.exists()) {
    return null;
  }
  return match.data().householdId;
}
