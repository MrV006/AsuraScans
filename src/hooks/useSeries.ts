import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, getDocs, limit, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Series, Chapter } from '../lib/types';

export function useSeriesList() {
  const [series, setSeries] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'series'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      try {
        const seriesList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Series));
        const fullList = await Promise.all(seriesList.map(async (s) => {
          const chaptersQ = query(collection(db, `series/${s.id}/chapters`), orderBy('number', 'desc'), limit(2));
          const chaptersSnap = await getDocs(chaptersQ);
          return {
            ...s,
            chapters: chaptersSnap.docs.map(c => ({ id: c.id, ...c.data() } as Chapter))
          };
        }));
        setSeries(fullList);
        setLoading(false);
      } catch (err: any) {
        setError(err.message);
        setLoading(false);
      }
    }, (err) => {
      setError(err.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { series, loading, error };
}

export function useSeriesOverview(id?: string) {
  const [series, setSeries] = useState<Series | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    const docRef = doc(db, 'series', id);
    const unsubSeries = onSnapshot(docRef, async (docSnap) => {
      if (!docSnap.exists()) {
        setSeries(null);
        setLoading(false);
        return;
      }
      const s = { id: docSnap.id, ...docSnap.data() } as Series;
      
      const chaptersQ = query(collection(db, `series/${id}/chapters`), orderBy('number', 'desc'));
      const chaptersSnap = await getDocs(chaptersQ);
      s.chapters = chaptersSnap.docs.map(c => ({ id: c.id, ...c.data() } as Chapter));
      setSeries(s);
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

    return () => unsubSeries();
  }, [id]);

  return { series, loading };
}
