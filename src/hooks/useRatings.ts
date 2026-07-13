import { useState, useEffect } from 'react';
import { apiClient, getSocketInstance } from '../lib/apiClient';
import { useAuth } from '../contexts/AuthContext';

export interface Rating {
  seriesId: string;
  userId: string;
  rating: number;
  updatedAt: any;
}

export function useRatings(seriesId?: string) {
  const { user } = useAuth();
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRating, setUserRating] = useState<number | null>(null);

  const fetchRatings = async () => {
    if (!seriesId) {
      setRatings([]);
      setLoading(false);
      return;
    }
    try {
      const data = await apiClient.getRatings(seriesId);
      const list = data.map((r: any) => ({
        seriesId: r.seriesId,
        userId: r.userId,
        rating: r.score, // score mapped to rating
        updatedAt: r.createdAt
      }));
      setRatings(list);
      
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
  }, [seriesId, user]);

  const averageRating = ratings.length > 0 
    ? ratings.reduce((acc, curr) => acc + curr.rating, 0) / ratings.length 
    : 0;

  const submitRating = async (ratingValue: number) => {
    if (!user || !seriesId) return false;
    try {
      await apiClient.rateSeries(seriesId, user.uid, ratingValue);
      return true;
    } catch (e) {
      console.error("Error submitting rating:", e);
      return false;
    }
  };

  const removeRating = async () => {
    // Unused or soft remove by setting rating as null/0
    return submitRating(0);
  };

  return { ratings, averageRating, userRating, loading, submitRating, removeRating };
}
