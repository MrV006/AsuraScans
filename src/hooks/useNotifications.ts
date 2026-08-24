import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiClient, getSocketInstance } from '../lib/apiClient';

export interface Notification {
  id: string;
  userId: string;
  type: string; // 'chapter_release' | 'bookmark' | 'wallet' | 'comment_reply' | 'ticket' | 'announcement' | 'system' | 'badge' | string
  title: string;
  body: string;
  link: string;
  createdAt: any;
  read: boolean;
}

export type NotificationFilter = 'all' | 'unread' | 'release' | 'system' | 'wallet' | 'interaction';

// Web Audio API pure synth chime
function playNotificationChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    const now = ctx.currentTime;

    // First tone: E5 (659.25Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.12, now + 0.03);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // Second tone: A5 (880Hz) - melodic gentle chime
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.09);
    gain2.gain.setValueAtTime(0, now + 0.09);
    gain2.gain.linearRampToValueAtTime(0.15, now + 0.13);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.09);
    osc2.stop(now + 0.6);
  } catch {
    // Ignore audio policy errors
  }
}

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const [latestToast, setLatestToast] = useState<Notification | null>(null);
  
  // Sound preferences persisted in localStorage
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('asura_notif_sound') !== 'false';
    } catch {
      return true;
    }
  });

  const toggleSound = useCallback(() => {
    setSoundEnabled(prev => {
      const next = !prev;
      try {
        localStorage.setItem('asura_notif_sound', String(next));
      } catch {}
      if (next) {
        playNotificationChime();
      }
      return next;
    });
  }, []);

  const fetchNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
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
  }, [user]);

  useEffect(() => {
    fetchNotifications();

    if (!user) return;

    const socket = getSocketInstance();
    socket.emit("join-room", `user:${user.uid}`);
    socket.emit("join-room", "global:notifications");

    const handleNewNotification = (notif: Notification) => {
      // Check if already in list to avoid duplicates
      setNotifications(prev => {
        if (prev.some(n => n.id === notif.id)) return prev;
        return [notif, ...prev];
      });
      setUnreadCount(prev => prev + 1);

      // Play pleasant sound chime if enabled
      if (soundEnabled) {
        playNotificationChime();
      }

      // Show real-time floating toast banner
      setLatestToast(notif);
    };

    const handleBroadcast = (data: any) => {
      const notif: Notification = {
        id: `broadcast-${Date.now()}-${Math.random()}`,
        userId: user.uid,
        type: data.type || 'announcement',
        title: data.title,
        body: data.body,
        link: data.link || '',
        read: false,
        createdAt: new Date().toISOString()
      };
      setNotifications(prev => [notif, ...prev]);
      setUnreadCount(prev => prev + 1);
      if (soundEnabled) {
        playNotificationChime();
      }
      setLatestToast(notif);
    };

    socket.on("notification:new", handleNewNotification);
    socket.on("notification:broadcast", handleBroadcast);

    return () => {
      socket.off("notification:new", handleNewNotification);
      socket.off("notification:broadcast", handleBroadcast);
      socket.emit("leave-room", `user:${user.uid}`);
      socket.emit("leave-room", "global:notifications");
    };
  }, [user, soundEnabled, fetchNotifications]);

  const markAsRead = async (notificationId: string) => {
    try {
      await apiClient.markNotificationAsRead(notificationId);
      setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
  };

  const markAsUnread = async (notificationId: string) => {
    try {
      await apiClient.markNotificationAsUnread(notificationId);
      setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, read: false } : n));
      setUnreadCount(prev => prev + 1);
    } catch (err) {
      console.error("Failed to mark notification as unread:", err);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    if (!user) return;
    try {
      const notif = notifications.find(n => n.id === notificationId);
      await apiClient.deleteNotification(notificationId, user.uid);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      if (notif && !notif.read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error("Failed to delete notification:", err);
    }
  };

  const clearAllNotifications = async () => {
    if (!user) return;
    try {
      await apiClient.clearAllNotifications(user.uid);
      setNotifications([]);
      setUnreadCount(0);
    } catch (err) {
      console.error("Failed to clear all notifications:", err);
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

  const dismissToast = useCallback(() => {
    setLatestToast(null);
  }, []);

  // Filtered notification list
  const filteredNotifications = useMemo(() => {
    if (filter === 'all') return notifications;
    if (filter === 'unread') return notifications.filter(n => !n.read);
    if (filter === 'release') {
      return notifications.filter(n => n.type === 'chapter_release' || n.type === 'release' || n.type === 'bookmark');
    }
    if (filter === 'wallet') {
      return notifications.filter(n => n.type === 'wallet' || n.type === 'coin' || n.type === 'transaction' || n.type === 'subscription');
    }
    if (filter === 'interaction') {
      return notifications.filter(n => n.type === 'comment_reply' || n.type === 'comment' || n.type === 'ticket' || n.type === 'support');
    }
    if (filter === 'system') {
      return notifications.filter(n => n.type === 'announcement' || n.type === 'system' || n.type === 'broadcast' || n.type === 'badge' || n.type === 'role_change');
    }
    return notifications;
  }, [notifications, filter]);

  return {
    notifications,
    filteredNotifications,
    unreadCount,
    filter,
    setFilter,
    soundEnabled,
    toggleSound,
    latestToast,
    dismissToast,
    markAsRead,
    markAsUnread,
    deleteNotification,
    clearAllNotifications,
    markAllAsRead,
    refreshNotifications: fetchNotifications,
    playChime: playNotificationChime
  };
}

