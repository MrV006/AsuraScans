import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string;
  createdAt: any;
  read: boolean;
}

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    const q = query(
      collection(db, `users/${user.uid}/notifications`),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Notification);
      setNotifications(list);
      setUnreadCount(list.filter(n => !n.read).length);
    });

    return () => unsubscribe();
  }, [user]);

  const markAsRead = async (notificationId: string) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, `users/${user.uid}/notifications`, notificationId), {
        read: true
      });
    } catch (e) {
      console.error("Error marking notification as read", e);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;
    try {
      const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
      const promises = unreadIds.map(id => 
        updateDoc(doc(db, `users/${user.uid}/notifications`, id), { read: true })
      );
      await Promise.all(promises);
    } catch (e) {
      console.error("Error marking all notifications as read", e);
    }
  };

  return { notifications, unreadCount, markAsRead, markAllAsRead };
}
