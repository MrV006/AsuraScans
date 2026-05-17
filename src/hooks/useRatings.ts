import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
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

  // User's rating for the specific series
  const [userRating, setUserRating] = useState<number | null>(null);

  useEffect(() => {
    if (!seriesId) {
      setRatings([]);
      setLoading(false);
      return;
    }

    const q = query(collection(db, 'ratings'), where('seriesId', '==', seriesId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(d => d.data() as Rating);
      setRatings(list);
      
      if (user) {
        const myRating = list.find(r => r.userId === user.uid);
        setUserRating(myRating ? myRating.rating : null);
      } else {
        setUserRating(null);
      }
      
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [seriesId, user]);

  const averageRating = ratings.length > 0 
    ? ratings.reduce((acc, curr) => acc + curr.rating, 0) / ratings.length 
    : 0;

  const submitRating = async (ratingValue: number) => {
    if (!user || !seriesId) return false;
    try {
      const ratingId = `${seriesId}_${user.uid}`;
      await setDoc(doc(db, 'ratings', ratingId), {
        seriesId,
        userId: user.uid,
        rating: ratingValue,
        updatedAt: serverTimestamp()
      });
      return true;
    } catch (e) {
      console.error("Error submitting rating:", e);
      return false;
    }
  };

  const removeRating = async () => {
    if (!user || !seriesId) return false;
    try {
      const ratingId = `${seriesId}_${user.uid}`;
      await deleteDoc(doc(db, 'ratings', ratingId));
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  return { ratings, averageRating, userRating, loading, submitRating, removeRating };
}
