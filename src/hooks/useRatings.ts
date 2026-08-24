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

export function useRatings(seriesId?: string) {
  const { user } = useAuth();
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [summary, setSummary] = useState<RatingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRating, setUserRating] = useState<number | null>(null);

  const fetchRatings = async () => {
    if (!seriesId) {
      setRatings([]);
      setSummary(null);
      setLoading(false);
      return;
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
    fetchRatings();

    const socket = getSocketInstance();
    const handleUpdate = (data: any) => {
      if (data.seriesId === seriesId) {
        fetchRatings();
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
      fetchRatings();
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
    refetch: fetchRatings
  };
}
