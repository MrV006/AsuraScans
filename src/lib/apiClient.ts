import { io, Socket } from 'socket.io-client';

// Simple API url pointing to current host
const API_URL = '';

// Setup real-time listeners utilizing Socket.io
let socket: Socket | null = null;

export function getSocketInstance(): Socket {
  if (!socket) {
    socket = io(window.location.origin, {
      transports: ['websocket', 'polling']
    });
  }
  return socket;
}

// Complete set of wrapper functions around the Express server endpoints
export const apiClient = {
  // Generic HTTP requests for dynamic routes
  async get(url: string) {
    const res = await fetch(`${API_URL}${url}`, { headers: this.getHeaders() });
    return res.json();
  },

  async post(url: string, data?: any, options?: any) {
    const res = await fetch(`${API_URL}${url}`, {
      method: 'POST',
      headers: {
        ...this.getHeaders(),
        ...(options?.headers || {})
      },
      body: data ? JSON.stringify(data) : undefined,
      ...options
    });
    return res.json();
  },

  async put(url: string, data?: any, options?: any) {
    const res = await fetch(`${API_URL}${url}`, {
      method: 'PUT',
      headers: {
        ...this.getHeaders(),
        ...(options?.headers || {})
      },
      body: data ? JSON.stringify(data) : undefined,
      ...options
    });
    return res.json();
  },

  // Utility header builder for admin requests
  getHeaders(userId?: string) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    const savedUid = localStorage.getItem('asura_user_uid');
    const uid = userId || savedUid;
    if (uid) {
      headers['x-admin-uid'] = uid;
      headers['x-user-uid'] = uid;
    }
    return headers;
  },

  // Database Seeding
  async seedDatabase(data: { series: any[]; admins: string[] }) {
    const res = await fetch(`${API_URL}/api/seed`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data)
    });
    return res.json();
  },

  // USERS / AUTH API
  async register(data: { email: string; displayName: string; password?: string }) {
    const res = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'خطا در ثبت نام.');
    }
    return res.json();
  },

  async login(data: { identifier: string; password?: string }) {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'نام کاربری/ایمیل یا رمز عبور اشتباه است.');
    }
    return res.json();
  },

  async googleLogin(data: { email: string; displayName: string; avatarUrl: string; firstName?: string; lastName?: string; phoneNumber?: string }) {
    const res = await fetch(`${API_URL}/api/auth/google`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'خطا در ورود با گوگل.');
    }
    return res.json();
  },

  async getUsers() {
    const res = await fetch(`${API_URL}/api/users`, { headers: this.getHeaders() });
    return res.json();
  },

  async getUser(id: string) {
    const res = await fetch(`${API_URL}/api/users/${id}`, { headers: this.getHeaders() });
    if (!res.ok) return null;
    return res.json();
  },

  async saveUser(user: { id: string; email: string; displayName: string; avatarUrl: string; firstName?: string; lastName?: string; phoneNumber?: string; role?: 'admin' | 'staff' | 'user'; hasCompletedSetup?: boolean }) {
    const res = await fetch(`${API_URL}/api/users`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(user)
    });
    return res.json();
  },

  async toggleBanUser(id: string, adminUid: string) {
    const res = await fetch(`${API_URL}/api/users/${id}/ban`, {
      method: 'PUT',
      headers: this.getHeaders(adminUid),
      body: JSON.stringify({})
    });
    return res.json();
  },

  // SERIES (MANGA / MANHWA) API
  async getSeries(filters?: {
    q?: string;
    genres?: string[];
    tags?: string[];
    status?: string;
    type?: string;
    sortBy?: string;
    limit?: number;
    offset?: number;
  }) {
    let url = `${API_URL}/api/series`;
    if (filters) {
      const params = new URLSearchParams();
      if (filters.q) params.append('q', filters.q);
      if (filters.genres && filters.genres.length > 0) params.append('genres', filters.genres.join(','));
      if (filters.tags && filters.tags.length > 0) params.append('tags', filters.tags.join(','));
      if (filters.status) params.append('status', filters.status);
      if (filters.type) params.append('type', filters.type);
      if (filters.sortBy) params.append('sortBy', filters.sortBy);
      if (filters.limit !== undefined) params.append('limit', String(filters.limit));
      if (filters.offset !== undefined) params.append('offset', String(filters.offset));
      
      const queryStr = params.toString();
      if (queryStr) {
        url += `?${queryStr}`;
      }
    }
    const res = await fetch(url, { headers: this.getHeaders() });
    return res.json();
  },

  async getSeriesById(id: string) {
    const res = await fetch(`${API_URL}/api/series/${id}`, { headers: this.getHeaders() });
    if (!res.ok) return null;
    return res.json();
  },

  async saveSeries(series: any) {
    const res = await fetch(`${API_URL}/api/series`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(series)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'خطا در ثبت اطلاعات مانهوا.');
    }
    return res.json();
  },

  async deleteSeries(id: string, adminUid: string) {
    const res = await fetch(`${API_URL}/api/series/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(adminUid)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'خطا در حذف مانهوا.');
    }
    return res.json();
  },

  async incrementSeriesViews(id: string) {
    const res = await fetch(`${API_URL}/api/series/${id}/view`, {
      method: 'POST',
      headers: this.getHeaders()
    });
    return res.json();
  },

  // CHAPTERS API
  async getChapters(seriesId: string) {
    const res = await fetch(`${API_URL}/api/series/${seriesId}/chapters`, { headers: this.getHeaders() });
    return res.json();
  },

  async getChapterById(seriesId: string, id: string) {
    const res = await fetch(`${API_URL}/api/series/${seriesId}/chapters/${id}`, { headers: this.getHeaders() });
    if (!res.ok) return null;
    return res.json();
  },

  async saveChapter(seriesId: string, chapter: any) {
    const res = await fetch(`${API_URL}/api/series/${seriesId}/chapters`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ seriesId, ...chapter })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'خطا در ثبت چپتر.');
    }
    return res.json();
  },

  async deleteChapter(seriesId: string, id: string, adminUid: string) {
    const res = await fetch(`${API_URL}/api/series/${seriesId}/chapters/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(adminUid)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'خطا در حذف چپتر.');
    }
    return res.json();
  },

  async incrementChapterViews(seriesId: string, id: string) {
    const res = await fetch(`${API_URL}/api/series/${seriesId}/chapters/${id}/view`, {
      method: 'POST',
      headers: this.getHeaders()
    });
    return res.json();
  },

  // COMMENTS API
  async getComments(chapterId: string) {
    const res = await fetch(`${API_URL}/api/chapters/${chapterId}/comments`, { headers: this.getHeaders() });
    return res.json();
  },

  async addComment(chapterId: string, comment: { id: string; userId: string; userName: string; userAvatar: string; content: string; parentId?: string }) {
    const res = await fetch(`${API_URL}/api/chapters/${chapterId}/comments`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ chapterId, ...comment })
    });
    return res.json();
  },

  async reactToComment(commentId: string, userId: string, type: 'like' | 'dislike') {
    const res = await fetch(`${API_URL}/api/comments/${commentId}/react`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ userId, type })
    });
    return res.json();
  },

  async deleteComment(commentId: string) {
    const res = await fetch(`${API_URL}/api/comments/${commentId}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });
    return res.json();
  },

  // BOOKMARKS API
  async getBookmarks(userId: string) {
    const res = await fetch(`${API_URL}/api/users/${userId}/bookmarks`, { headers: this.getHeaders() });
    return res.json();
  },

  async toggleBookmark(userId: string, seriesId: string) {
    const res = await fetch(`${API_URL}/api/users/${userId}/bookmarks/${seriesId}`, {
      method: 'POST',
      headers: this.getHeaders()
    });
    return res.json();
  },

  // HISTORY API
  async getHistory(userId: string) {
    const res = await fetch(`${API_URL}/api/users/${userId}/history`, { headers: this.getHeaders() });
    return res.json();
  },

  async updateHistory(userId: string, historyItem: { seriesId: string; chapterId: string; chapterNumber: number }) {
    const res = await fetch(`${API_URL}/api/users/${userId}/history`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(historyItem)
    });
    return res.json();
  },

  // RATINGS API
  async getRatings(seriesId: string) {
    const res = await fetch(`${API_URL}/api/series/${seriesId}/ratings`, { headers: this.getHeaders() });
    return res.json();
  },

  async rateSeries(seriesId: string, userId: string, score: number) {
    const res = await fetch(`${API_URL}/api/series/${seriesId}/ratings`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ userId, score })
    });
    return res.json();
  },

  // SETTINGS API
  async getSettings(id: string) {
    const res = await fetch(`${API_URL}/api/settings/${id}`, { headers: this.getHeaders() });
    if (!res.ok) return null;
    const text = await res.text();
    try {
      return text ? JSON.parse(text) : null;
    } catch (e) {
      console.warn("Failed to parse settings JSON:", text, e);
      return null;
    }
  },

  async saveSettings(id: string, settings: any) {
    const res = await fetch(`${API_URL}/api/settings/${id}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(settings)
    });
    return res.json();
  },

  // ADMIN HELPER METHODS
  async getAdminStats(adminUid: string) {
    const res = await fetch(`${API_URL}/api/admin/stats`, {
      headers: this.getHeaders(adminUid)
    });
    return res.json();
  },

  async getAllCommentsAdmin(adminUid: string) {
    const res = await fetch(`${API_URL}/api/admin/comments`, {
      headers: this.getHeaders(adminUid)
    });
    return res.json();
  },

  async changeUserRole(userId: string, role: 'admin' | 'user', adminUid: string) {
    const res = await fetch(`${API_URL}/api/users/${userId}/role`, {
      method: 'PUT',
      headers: this.getHeaders(adminUid),
      body: JSON.stringify({ role })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'خطا در تغییر نقش کاربر.');
    }
    return res.json();
  },

  async updateUserRolesAndPermissions(userId: string, roles: string[], permissions: string[], adminUid: string, melliCode?: string) {
    const res = await fetch(`${API_URL}/api/users/${userId}/roles-permissions`, {
      method: 'PUT',
      headers: this.getHeaders(adminUid),
      body: JSON.stringify({ roles, permissions, melliCode })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'خطا در بروزرسانی دسترسی‌های کاربر.');
    }
    return res.json();
  },

  async deleteUser(userId: string, adminUid: string) {
    const res = await fetch(`${API_URL}/api/users/${userId}/delete`, {
      method: 'POST',
      headers: this.getHeaders(adminUid)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'خطا در حذف دائم حساب کاربری.');
    }
    return res.json();
  },

  async getReportsAdmin(adminUid: string) {
    const res = await fetch(`${API_URL}/api/admin/reports`, {
      headers: this.getHeaders(adminUid)
    });
    return res.json();
  },

  async submitReport(report: { id: string; userId: string; userName: string; title: string; content: string }) {
    const res = await fetch(`${API_URL}/api/reports`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(report)
    });
    return res.json();
  },

  async resolveReport(reportId: string, status: string, adminUid: string) {
    const res = await fetch(`${API_URL}/api/reports/${reportId}`, {
      method: 'PUT',
      headers: this.getHeaders(adminUid),
      body: JSON.stringify({ status })
    });
    return res.json();
  },

  async deleteReportAdmin(reportId: string, adminUid: string) {
    const res = await fetch(`${API_URL}/api/reports/${reportId}`, {
      method: 'DELETE',
      headers: this.getHeaders(adminUid)
    });
    return res.json();
  },

  async uploadImages(files: File[], uid: string) {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files[]', file);
    });
    const res = await fetch(`${API_URL}/api/admin/upload`, {
      method: 'POST',
      headers: {
        'x-admin-uid': uid,
        'x-user-uid': uid
      },
      body: formData
    });
    return res.json();
  },

  // NOTIFICATIONS API
  async getNotifications(userId: string) {
    const res = await fetch(`${API_URL}/api/users/${userId}/notifications`, { headers: this.getHeaders() });
    return res.json();
  },

  async markNotificationAsRead(id: string) {
    const res = await fetch(`${API_URL}/api/notifications/${id}/read`, {
      method: 'POST',
      headers: this.getHeaders()
    });
    return res.json();
  },

  async markAllNotificationsAsRead(userId: string) {
    const res = await fetch(`${API_URL}/api/users/${userId}/notifications/read-all`, {
      method: 'POST',
      headers: this.getHeaders()
    });
    return res.json();
  },

  async setUserCanCreateSeries(userId: string, canCreateSeries: boolean, adminUid: string) {
    const res = await fetch(`${API_URL}/api/users/${userId}/can-create-series`, {
      method: 'PUT',
      headers: this.getHeaders(adminUid),
      body: JSON.stringify({ canCreateSeries })
    });
    return res.json();
  },

  async requestContributor(seriesId: string, data: { userId: string; email: string; displayName: string; role: string; melliCode: string }) {
    const res = await fetch(`${API_URL}/api/series/${seriesId}/request-contributor`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async approveContributor(seriesId: string, userId: string, action: 'approve' | 'reject', adminUid: string) {
    const res = await fetch(`${API_URL}/api/series/${seriesId}/approve-contributor`, {
      method: 'POST',
      headers: this.getHeaders(adminUid),
      body: JSON.stringify({ userId, action })
    });
    return res.json();
  },

  async adjustRatings(seriesId: string, score: number, action: 'increment' | 'decrement', adminUid: string) {
    const res = await fetch(`${API_URL}/api/series/${seriesId}/adjust-ratings`, {
      method: 'POST',
      headers: this.getHeaders(adminUid),
      body: JSON.stringify({ score, action })
    });
    return res.json();
  },

  async updateCommentContent(commentId: string, content: string) {
    const res = await fetch(`${API_URL}/api/comments/${commentId}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({ content })
    });
    return res.json();
  },

  async approveChapter(seriesId: string, chapterId: string, adminUid: string) {
    const res = await fetch(`${API_URL}/api/series/${seriesId}/chapters/${chapterId}/approve`, {
      method: 'PUT',
      headers: this.getHeaders(adminUid)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'خطا در تایید چپتر.');
    }
    return res.json();
  },

  async getWalletTransactions(userId?: string) {
    const url = userId ? `${API_URL}/api/wallet/transactions?userId=${userId}` : `${API_URL}/api/wallet/transactions`;
    const res = await fetch(url, { headers: this.getHeaders() });
    return res.json();
  },

  async chargeWallet(userId: string, amount: number, type: string, description: string) {
    const res = await fetch(`${API_URL}/api/wallet/charge`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ userId, amount, type, description })
    });
    return res.json();
  },

  async checkChapterPurchase(userId: string, seriesId: string, chapterId: string) {
    const res = await fetch(`${API_URL}/api/users/${userId}/purchases/${seriesId}/${chapterId}`, { headers: this.getHeaders() });
    return res.json();
  },

  async purchaseChapter(userId: string, seriesId: string, chapterId: string) {
    const res = await fetch(`${API_URL}/api/chapters/purchase`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ userId, seriesId, chapterId })
    });
    return res.json();
  }
};
