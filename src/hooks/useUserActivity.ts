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
      const fullList = await Promise.all(
        data.map(async (b: any) => {
          const s = await apiClient.getSeriesById(b.seriesId);
          return {
            seriesId: b.seriesId,
            createdAt: b.createdAt,
            seriesData: s || undefined
          };
        })
      );
      setBookmarks(fullList);
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
  }, [user]);

  const addBookmark = async (seriesId: string) => {
    if (!user) return false;
    try {
      await apiClient.toggleBookmark(user.uid, seriesId);
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

  const fetchHistory = async () => {
    if (!user) {
      setHistory([]);
      setLoading(false);
      return;
    }
    try {
      const data = await apiClient.getHistory(user.uid);
      const fullList = await Promise.all(
        data.map(async (h: any) => {
          const s = await apiClient.getSeriesById(h.seriesId);
          return {
            seriesId: h.seriesId,
            chapterId: h.chapterId,
            chapterNumber: h.chapterNumber,
            updatedAt: h.updatedAt,
            seriesData: s || undefined
          };
        })
      );
      setHistory(fullList);
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
      if (data.userId === user?.uid) {
        fetchHistory();
      }
    };

    socket.on("history:updated", handleUpdate);

    return () => {
      socket.off("history:updated", handleUpdate);
    };
  }, [user]);

  const updateHistory = async (seriesId: string, chapterId: string, chapterNumber: number) => {
    if (!user) return false;
    try {
      await apiClient.updateHistory(user.uid, { seriesId, chapterId, chapterNumber });
      return true;
    } catch (e) {
      console.error("Error updating history via API:", e);
      return false;
    }
  };

  const getHistoryForSeries = (seriesId: string) => {
    return history.find(h => h.seriesId === seriesId);
  };

  return { history, loading, updateHistory, getHistoryForSeries };
}
