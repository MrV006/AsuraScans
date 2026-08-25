import { useState, useEffect } from 'react';
import { apiClient, getSocketInstance } from '../lib/apiClient';
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

  const fetchBookmarks = async () => {
    if (!user) {
      setBookmarks([]);
      setLoading(false);
      return;
    }
    try {
      const data = await apiClient.getBookmarks(user.uid);
      const list = (Array.isArray(data) ? data : []).map((b: any) => ({
        seriesId: b.seriesId,
        createdAt: b.createdAt,
        seriesData: b.seriesData || undefined
      }));
      setBookmarks(list);
      setLoading(false);
    } catch (e) {
      console.error("Error loading bookmarks via API", e);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookmarks();

    const socket = getSocketInstance();
    const handleUpdate = (data: any) => {
      if (data.userId === user?.uid) {
        fetchBookmarks();
      }
    };

    socket.on("bookmarks:updated", handleUpdate);

    return () => {
      socket.off("bookmarks:updated", handleUpdate);
    };
  }, [user?.uid]);

  const addBookmark = async (seriesId: string) => {
    if (!user) return false;
    try {
      await apiClient.toggleBookmark(user.uid, seriesId);
      await fetchBookmarks();
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  const removeBookmark = async (seriesId: string) => {
    if (!user) return false;
    try {
      await apiClient.toggleBookmark(user.uid, seriesId);
      await fetchBookmarks();
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  const isBookmarked = (seriesId: string | undefined) => {
    if (!seriesId) return false;
    return bookmarks.some(b => String(b.seriesId) === String(seriesId));
  };

  return { bookmarks, loading, addBookmark, removeBookmark, isBookmarked };
}

export function useHistory() {
  const { user } = useAuth();
  const [history, setHistory] = useState<ReadingHistory[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = async () => {
    // 24 hour cutoff for client side as well
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

    if (!user) {
      // Local fallback for guest users with 24h expiration
      try {
        const raw = localStorage.getItem('asura_guest_history');
        if (raw) {
          const list: ReadingHistory[] = JSON.parse(raw);
          const valid = list.filter(item => new Date(item.updatedAt).getTime() >= oneDayAgo);
          if (valid.length !== list.length) {
            localStorage.setItem('asura_guest_history', JSON.stringify(valid));
          }
          setHistory(valid);
        } else {
          setHistory([]);
        }
      } catch (err) {
        setHistory([]);
      }
      setLoading(false);
      return;
    }

    try {
      const data = await apiClient.getHistory(user.uid);
      const list = (Array.isArray(data) ? data : []).map((h: any) => ({
        seriesId: h.seriesId,
        chapterId: h.chapterId,
        chapterNumber: h.chapterNumber,
        updatedAt: h.updatedAt,
        seriesData: h.seriesData || undefined
      }));
      setHistory(list);
      setLoading(false);
    } catch (e) {
      console.error("Error loading history via API", e);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();

    const socket = getSocketInstance();
    const handleUpdate = (data: any) => {
      if (!data || !data.userId || data.userId === user?.uid) {
        fetchHistory();
      }
    };

    socket.on("history:updated", handleUpdate);

    return () => {
      socket.off("history:updated", handleUpdate);
    };
  }, [user?.uid]);

  const updateHistory = async (seriesId: string, chapterId: string, chapterNumber: number) => {
    const now = new Date().toISOString();
    if (!user) {
      try {
        const raw = localStorage.getItem('asura_guest_history');
        let list: ReadingHistory[] = raw ? JSON.parse(raw) : [];
        const existingIdx = list.findIndex(h => h.seriesId === seriesId);
        const newItem: ReadingHistory = { seriesId, chapterId, chapterNumber, updatedAt: now };
        if (existingIdx >= 0) {
          list[existingIdx] = newItem;
        } else {
          list.unshift(newItem);
        }
        // Purge items older than 24h
        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
        list = list.filter(h => new Date(h.updatedAt).getTime() >= oneDayAgo);
        localStorage.setItem('asura_guest_history', JSON.stringify(list));
        fetchHistory();
        return true;
      } catch (err) {
        return false;
      }
    }

    try {
      await apiClient.updateHistory(user.uid, { seriesId, chapterId, chapterNumber });
      return true;
    } catch (e) {
      console.error("Error updating history via API:", e);
      return false;
    }
  };

  const deleteHistoryItem = async (seriesId: string) => {
    if (!user) {
      try {
        const raw = localStorage.getItem('asura_guest_history');
        if (raw) {
          const list: ReadingHistory[] = JSON.parse(raw);
          const filtered = list.filter(h => h.seriesId !== seriesId);
          localStorage.setItem('asura_guest_history', JSON.stringify(filtered));
          fetchHistory();
        }
        return true;
      } catch (err) {
        return false;
      }
    }

    try {
      await apiClient.deleteHistoryItem(user.uid, seriesId);
      await fetchHistory();
      return true;
    } catch (e) {
      console.error("Error deleting history item:", e);
      return false;
    }
  };

  const clearHistory = async () => {
    if (!user) {
      localStorage.removeItem('asura_guest_history');
      setHistory([]);
      return true;
    }

    try {
      await apiClient.clearHistory(user.uid);
      setHistory([]);
      return true;
    } catch (e) {
      console.error("Error clearing history:", e);
      return false;
    }
  };

  const getHistoryForSeries = (seriesId: string) => {
    return history.find(h => h.seriesId === seriesId);
  };

  return { history, loading, updateHistory, deleteHistoryItem, clearHistory, getHistoryForSeries, refreshHistory: fetchHistory };
}
