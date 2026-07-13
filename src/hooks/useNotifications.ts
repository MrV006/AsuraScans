import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiClient, getSocketInstance } from '../lib/apiClient';

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

    const fetchNotifications = async () => {
      try {
        const data = await apiClient.getNotifications(user.uid);
        if (Array.isArray(data)) {
          setNotifications(data);
          const unreads = data.filter((n: any) => !n.read).length;
          setUnreadCount(unreads);
        }
      } catch (err) {
        console.error("Failed to load notifications:", err);
      }
    };

    fetchNotifications();

    const socket = getSocketInstance();
    socket.emit("join-room", `user:${user.uid}`);

    const handleNewNotification = (notif: Notification) => {
      setNotifications(prev => [notif, ...prev]);
      setUnreadCount(prev => prev + 1);
    };

    socket.on("notification:new", handleNewNotification);

    return () => {
      socket.off("notification:new", handleNewNotification);
      socket.emit("leave-room", `user:${user.uid}`);
    };
  }, [user]);

  const markAsRead = async (notificationId: string) => {
    try {
      await apiClient.markNotificationAsRead(notificationId);
      setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;
    try {
      await apiClient.markAllNotificationsAsRead(user.uid);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error("Failed to mark all notifications as read:", err);
    }
  };

  return { notifications, unreadCount, markAsRead, markAllAsRead };
}
