import { useState, useEffect } from 'react';
import { apiClient, getSocketInstance } from '../lib/apiClient';
import { useAuth } from '../contexts/AuthContext';

export interface Rating {
  seriesId: string;
  userId: string;
  rating: number;
  updatedAt: any;
}

export interface RatingSummary {
  averageRating: number;
  totalRatings: number;
  starCounts: { 1: number; 2: number; 3: number; 4: number; 5: number };
}

const ratingsCache = new Map<string, { ratings: Rating[]; summary: RatingSummary | null; timestamp: number }>();

export function useRatings(seriesId?: string) {
  const { user } = useAuth();
  const cleanId = seriesId ? decodeURIComponent(seriesId).trim() : '';
  const cached = cleanId ? (ratingsCache.get(cleanId) || ratingsCache.get(seriesId || '')) : null;

  const [ratings, setRatings] = useState<Rating[]>(cached ? cached.ratings : []);
  const [summary, setSummary] = useState<RatingSummary | null>(cached ? cached.summary : null);
  const [loading, setLoading] = useState(!cached);
  const [userRating, setUserRating] = useState<number | null>(() => {
    if (user && cached?.ratings) {
      const my = cached.ratings.find(r => r.userId === user.uid);
      return my ? my.rating : null;
    }
    return null;
  });

  const fetchRatings = async (isBackground = false) => {
    if (!seriesId) {
      setRatings([]);
      setSummary(null);
      setLoading(false);
      return;
    }
    if (!isBackground && !cached) {
      setLoading(true);
    }
    try {
      const [data, summaryData] = await Promise.all([
        apiClient.getRatings(seriesId).catch(() => []),
        apiClient.getRatingsSummary(seriesId).catch(() => null)
      ]);
      const list = (Array.isArray(data) ? data : []).map((r: any) => ({
        seriesId: r.seriesId,
        userId: r.userId,
        rating: r.score, // score mapped to rating
        updatedAt: r.createdAt
      }));
      setRatings(list);
      if (summaryData && typeof summaryData.averageRating === 'number') {
        setSummary(summaryData);
      }

      ratingsCache.set(seriesId, { ratings: list, summary: summaryData, timestamp: Date.now() });
      if (cleanId) ratingsCache.set(cleanId, { ratings: list, summary: summaryData, timestamp: Date.now() });
      
      if (user) {
        const myRating = list.find((r: any) => r.userId === user.uid);
        setUserRating(myRating ? myRating.rating : null);
      } else {
        setUserRating(null);
      }
      setLoading(false);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  useEffect(() => {
    const isCached = cleanId && (ratingsCache.has(cleanId) || ratingsCache.has(seriesId || ''));
    if (isCached) {
      const existing = (ratingsCache.get(cleanId) || ratingsCache.get(seriesId || ''));
      if (existing) {
        setRatings(existing.ratings);
        setSummary(existing.summary);
        if (user) {
          const my = existing.ratings.find(r => r.userId === user.uid);
          setUserRating(my ? my.rating : null);
        }
        setLoading(false);
      }
    }
    fetchRatings(!!isCached);

    const socket = getSocketInstance();
    const handleUpdate = (data: any) => {
      if (data && (data.seriesId === seriesId || data.seriesId === cleanId)) {
        fetchRatings(true);
      }
    };

    socket.on("ratings:updated", handleUpdate);

    return () => {
      socket.off("ratings:updated", handleUpdate);
    };
  }, [seriesId, user?.uid]);

  const averageRating = summary?.averageRating !== undefined 
    ? summary.averageRating 
    : (ratings.length > 0 
        ? ratings.reduce((acc, curr) => acc + curr.rating, 0) / ratings.length 
        : 0);

  const totalRatings = summary?.totalRatings !== undefined 
    ? summary.totalRatings 
    : ratings.length;

  const starCounts = summary?.starCounts || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  const submitRating = async (ratingValue: number) => {
    if (!user || !seriesId) return false;
    
    const oldUserRating = userRating;
    const oldRatings = [...ratings];
    
    setUserRating(ratingValue);
    setRatings(prev => {
      const filtered = prev.filter(r => r.userId !== user.uid);
      if (ratingValue > 0) {
        return [...filtered, {
          seriesId,
          userId: user.uid,
          rating: ratingValue,
          updatedAt: new Date().toISOString()
        }];
      }
      return filtered;
    });

    try {
      await apiClient.rateSeries(seriesId, user.uid, ratingValue);
      fetchRatings(true);
      return true;
    } catch (e) {
      console.error("Error submitting rating:", e);
      setUserRating(oldUserRating);
      setRatings(oldRatings);
      return false;
    }
  };

  const removeRating = async () => {
    return submitRating(0);
  };

  return { 
    ratings, 
    averageRating, 
    userRating, 
    summary,
    totalRatings,
    starCounts,
    loading, 
    submitRating, 
    removeRating,
    refetch: () => fetchRatings(false)
  };
}
