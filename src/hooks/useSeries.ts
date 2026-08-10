import { useState, useEffect } from 'react';
import { apiClient, getSocketInstance } from '../lib/apiClient';
import { Series } from '../lib/types';

export function useSeriesList() {
  const [series, setSeries] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSeries = async () => {
    try {
      const data = await apiClient.getSeries();
      if (!data || !Array.isArray(data)) {
        throw new Error(data?.error || "اطلاعات مانهوا یافت نشد یا ساختار داده نادرست است.");
      }
      
      // If series already include attached chapters/chaptersCount, avoid N extra HTTP calls
      const needsChaptersFetch = data.some((s: any) => !s.chapters || !Array.isArray(s.chapters));

      if (!needsChaptersFetch) {
        setSeries(data.map((s: any) => ({
          ...s,
          totalChapters: (s.chapters && s.chapters.length) || s.chaptersCount || s.totalChapters || 0,
          chaptersCount: (s.chapters && s.chapters.length) || s.chaptersCount || s.totalChapters || 0,
        })));
        setLoading(false);
        return;
      }

      // Parallel fetch only if needed
      const fullList = await Promise.all(data.map(async (s: any) => {
        if (s.chapters && Array.isArray(s.chapters) && s.chapters.length > 0) {
          return {
            ...s,
            totalChapters: s.chapters.length,
            chaptersCount: s.chapters.length,
          };
        }
        try {
          const chapters = await apiClient.getChapters(s.id);
          const validChs = Array.isArray(chapters) ? chapters : [];
          return {
            ...s,
            totalChapters: validChs.length > 0 ? validChs.length : (s.totalChapters || 0),
            chaptersCount: validChs.length > 0 ? validChs.length : (s.chaptersCount || 0),
            chapters: validChs
          };
        } catch (chapterErr) {
          return {
            ...s,
            totalChapters: s.totalChapters || 0,
            chaptersCount: s.chaptersCount || 0,
            chapters: s.chapters || []
          };
        }
      }));

      setSeries(fullList);
      setLoading(false);
    } catch (err: any) {
      setError(err.message || "خطا در دریافت لیست مانهوا");
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSeries();
    
    const socket = getSocketInstance();
    socket.on("series:updated", fetchSeries);
    socket.on("series:deleted", fetchSeries);
    socket.on("database:seeded", fetchSeries);

    return () => {
      socket.off("series:updated", fetchSeries);
      socket.off("series:deleted", fetchSeries);
      socket.off("database:seeded", fetchSeries);
    };
  }, []);

  return { series, loading, error, mutate: fetchSeries };
}

export function useSeriesOverview(id?: string) {
  const [series, setSeries] = useState<Series | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchOverview = async () => {
    if (!id) {
      setLoading(false);
      return;
    }
    try {
      // Parallel fetch series details AND chapters
      const [s, chapters] = await Promise.all([
        apiClient.getSeriesById(id),
        apiClient.getChapters(id).catch(() => [])
      ]);

      if (s) {
        s.chapters = Array.isArray(chapters) ? chapters : [];
      }
      setSeries(s);
      setLoading(false);
    } catch (err) {
      console.error("Error fetching series overview:", err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();

    const socket = getSocketInstance();
    const handleUpdate = (data: any) => {
      if (!data || data.seriesId === id || data.id === id) {
        fetchOverview();
      }
    };

    socket.on("series:updated", handleUpdate);
    socket.on("chapters:updated", handleUpdate);

    return () => {
      socket.off("series:updated", handleUpdate);
      socket.off("chapters:updated", handleUpdate);
    };
  }, [id]);

  return { series, loading, mutate: fetchOverview };
}
