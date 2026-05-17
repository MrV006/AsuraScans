import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, doc, setDoc, deleteDoc, serverTimestamp, getDocs, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Series } from '../lib/types';

export interface Bookmark {
  seriesId: string;
  createdAt: any;
  seriesData?: Series;
}

export interface ReadingHistory {
  seriesId: string;
  chapterId: string;
  chapterNumber: number;
  updatedAt: any;
  seriesData?: Series;
}

export function useBookmarks() {
  const { user } = useAuth();
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setBookmarks([]);
      setLoading(false);
      return;
    }

    const q = query(collection(db, `users/${user.uid}/bookmarks`), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      try {
        const list = snapshot.docs.map(d => ({ ...d.data() } as Bookmark));
        
        // Fetch series data for each bookmark
        const fullList = await Promise.all(list.map(async (b) => {
          const sdoc = await getDoc(doc(db, 'series', b.seriesId));
          if (sdoc.exists()) {
            b.seriesData = { id: sdoc.id, ...sdoc.data() } as Series;
          }
          return b;
        }));
        setBookmarks(fullList);
        setLoading(false);
      } catch (e) {
        console.error("Error loading bookmarks", e);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [user]);

  const addBookmark = async (seriesId: string) => {
    if (!user) return false;
    try {
      await setDoc(doc(db, `users/${user.uid}/bookmarks`, seriesId), {
        seriesId,
        createdAt: serverTimestamp()
      });
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  const removeBookmark = async (seriesId: string) => {
    if (!user) return false;
    try {
      await deleteDoc(doc(db, `users/${user.uid}/bookmarks`, seriesId));
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  const isBookmarked = (seriesId: string) => {
    return bookmarks.some(b => b.seriesId === seriesId);
  };

  return { bookmarks, loading, addBookmark, removeBookmark, isBookmarked };
}

export function useHistory() {
  const { user } = useAuth();
  const [history, setHistory] = useState<ReadingHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setHistory([]);
      setLoading(false);
      return;
    }

    const q = query(collection(db, `users/${user.uid}/history`), orderBy('updatedAt', 'desc'));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      try {
        const list = snapshot.docs.map(d => ({ ...d.data() } as ReadingHistory));
        
        // Fetch series data for each history item
        const fullList = await Promise.all(list.map(async (h) => {
          const sdoc = await getDoc(doc(db, 'series', h.seriesId));
          if (sdoc.exists()) {
            h.seriesData = { id: sdoc.id, ...sdoc.data() } as Series;
          }
          return h;
        }));
        
        setHistory(fullList);
        setLoading(false);
      } catch (e) {
        console.error("Error loading history", e);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [user]);

  const updateHistory = async (seriesId: string, chapterId: string, chapterNumber: number) => {
    if (!user) return false;
    try {
      await setDoc(doc(db, `users/${user.uid}/history`, seriesId), {
        seriesId,
        chapterId,
        chapterNumber,
        updatedAt: serverTimestamp()
      });
      return true;
    } catch (e) {
      console.error("Error updating history:", e);
      return false;
    }
  };

  const getHistoryForSeries = (seriesId: string) => {
    return history.find(h => h.seriesId === seriesId);
  };

  return { history, loading, updateHistory, getHistoryForSeries };
}
