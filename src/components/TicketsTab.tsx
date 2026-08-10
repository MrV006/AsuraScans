import React, { useState, useEffect } from 'react';
import { apiClient } from '../lib/apiClient';
import { 
  LifeBuoy, Search, Filter, RefreshCw, MessageSquare, Clock, AlertTriangle, 
  CheckCircle, XCircle, User, Shield, Send, Paperclip, ChevronRight, 
  Trash2, UserCheck, Tag, ArrowUpRight, Check, X
} from 'lucide-react';

interface TicketMessage {
  id: string;
  ticketId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  senderRole: 'user' | 'admin' | 'staff';
  content: string;
  attachments?: string[];
  createdAt: string;
}

interface Ticket {
  id: string;
  userId: string;
  userName: string;
  userEmail?: string;
  userAvatar?: string;
  subject: string;
  category: string;
  priority: string;
  status: 'open' | 'in_progress' | 'answered' | 'closed';
  assignedTo?: string;
  assignedToName?: string;
  messages: TicketMessage[];
  lastUpdated: string;
  createdAt: string;
}

const CATEGORY_MAP: Record<string, { label: string; color: string }> = {
  account: { label: 'حساب کاربری', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  payment: { label: 'پرداخت و کیف‌پول', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  broken_image: { label: 'خرابی تصویر/چپتر', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  translation_team: { label: 'تیم ترجمه و ادیت', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  bug: { label: 'گزارش باگ', color: 'bg-red-500/10 text-red-400 border-red-500/20' },
  other: { label: 'سایر موارد', color: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20' }
};

const PRIORITY_MAP: Record<string, { label: string; bg: string; text: string }> = {
  low: { label: 'عادی', bg: 'bg-zinc-800', text: 'text-zinc-300' },
  medium: { label: 'متوسط', bg: 'bg-blue-900/40', text: 'text-blue-400' },
  high: { label: 'مهم', bg: 'bg-amber-900/40', text: 'text-amber-400' },
  urgent: { label: 'فوری', bg: 'bg-red-900/50', text: 'text-red-400 font-bold' }
};

const STATUS_MAP: Record<string, { label: string; badge: string; icon: React.ReactNode }> = {
  open: { label: 'باز (نیازمند پاسخ)', badge: 'bg-amber-500/20 text-amber-300 border border-amber-500/30', icon: <Clock className="w-3.5 h-3.5" /> },
  in_progress: { label: 'در حال بررسی', badge: 'bg-blue-500/20 text-blue-300 border border-blue-500/30', icon: <RefreshCw className="w-3.5 h-3.5 animate-spin-slow" /> },
  answered: { label: 'پاسخ داده شده', badge: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30', icon: <CheckCircle className="w-3.5 h-3.5" /> },
  closed: { label: 'بسته شده', badge: 'bg-zinc-800 text-zinc-400 border border-zinc-700', icon: <XCircle className="w-3.5 h-3.5" /> }
};

const CANNED_RESPONSES = [
  'سلام وقت بخیر، درخواست شما بررسی گردید و مشکل مرتفع شد. لطفاً مجدداً تست کنید.',
  'سلام، لطفاً تصویر خطای ایجاد شده یا شناسه تراکنش را جهت پیگیری دقیق‌تر ارسال نمایید.',
  'سلام، درخواست شارژ حساب شما تایید و به کیف پول شما اضافه گردید.',
  'سلام، موضوع به بخش فنی ارجاع داده شد. به محض برطرف شدن اطلاع‌رسانی می‌گردد.',
  'با تشکر از ارسال درخواست همکاری، رزومه شما جهت بررسی به مدیر تیم ترجمه ارسال گردید.',
  'تیکت شما به علت عدم پاسخ‌دهی یا کامل بودن توضیحات بسته شد.'
];

export const TicketsTab: React.FC<{ adminUid?: string }> = ({ adminUid }) => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Reply form state
  const [replyText, setReplyText] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  // Status/Priority/Assign update state
  const [editingStatus, setEditingStatus] = useState<string>('open');
  const [editingPriority, setEditingPriority] = useState<string>('medium');
  const [editingAssignedTo, setEditingAssignedTo] = useState<string>('');
  const [isUpdatingDetails, setIsUpdatingDetails] = useState(false);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const data = await apiClient.getAdminTickets({
        status: statusFilter,
        priority: priorityFilter,
        category: categoryFilter,
        search: searchQuery
      }, adminUid);
      if (Array.isArray(data)) {
        setTickets(data);
        // If a ticket is open, update its selection
        if (selectedTicket) {
          const fresh = data.find(t => t.id === selectedTicket.id);
          if (fresh) setSelectedTicket(fresh);
        }
      }
    } catch (err) {
      console.error('Error loading admin tickets:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [statusFilter, priorityFilter, categoryFilter, searchQuery]);

  useEffect(() => {
    if (selectedTicket) {
      setEditingStatus(selectedTicket.status);
      setEditingPriority(selectedTicket.priority);
      setEditingAssignedTo(selectedTicket.assignedToName || '');
    }
  }, [selectedTicket]);

  const handleSendReply = async () => {
    if (!selectedTicket || !replyText.trim()) return;
    setIsSubmittingReply(true);
    setReplyError(null);
    try {
      const attachments = attachmentUrl.trim() ? [attachmentUrl.trim()] : [];
      await apiClient.replyTicket(selectedTicket.id, replyText.trim(), attachments, adminUid);
      setReplyText('');
      setAttachmentUrl('');
      // Reload tickets
      await fetchTickets();
    } catch (err: any) {
      setReplyError(err.message || 'خطا در ارسال پاسخ');
    } finally {
      setIsSubmittingReply(false);
    }
  };

  const handleUpdateTicketDetails = async () => {
    if (!selectedTicket) return;
    setIsUpdatingDetails(true);
    try {
      await apiClient.updateAdminTicket(selectedTicket.id, {
        status: editingStatus,
        priority: editingPriority,
        assignedToName: editingAssignedTo
      }, adminUid);
      await fetchTickets();
    } catch (err) {
      console.error('Failed to update ticket details:', err);
    } finally {
      setIsUpdatingDetails(false);
    }
  };

  const handleDeleteTicket = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm('آیا از حذف این تیکت اطمینان دارید؟ تمامی پیام‌های آن حذف خواهد شد.')) return;
    try {
      await apiClient.deleteAdminTicket(id, adminUid);
      if (selectedTicket?.id === id) setSelectedTicket(null);
      fetchTickets();
    } catch (err) {
      console.error('Error deleting ticket:', err);
    }
  };

  // Stats calculation
  const totalCount = tickets.length;
  const openCount = tickets.filter(t => t.status === 'open').length;
  const inProgressCount = tickets.filter(t => t.status === 'in_progress').length;
  const answeredCount = tickets.filter(t => t.status === 'answered').length;
  const closedCount = tickets.filter(t => t.status === 'closed').length;

  return (
    <div className="space-y-6 text-zinc-100" dir="rtl">
      {/* Top Header & Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-900/80 border border-zinc-800 p-6 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <LifeBuoy className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">مدیریت تیکت‌های پشتیبانی</h2>
            <p className="text-xs text-zinc-400 mt-0.5">پاسخ‌دهی به درخواست‌ها، مشکلات کاربران و مدیریت تیم پشتیبانی</p>
          </div>
        </div>
        
        <button
          onClick={fetchTickets}
          className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-medium transition-colors border border-zinc-700/50 self-start md:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          بروزرسانی لیست
        </button>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4">
          <span className="text-xs font-medium text-zinc-400">کل تیکت‌ها</span>
          <div className="text-2xl font-black text-white mt-1">{totalCount}</div>
        </div>

        <div className="bg-amber-950/20 border border-amber-500/20 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-amber-300">نیازمند پاسخ (باز)</span>
            {openCount > 0 && <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />}
          </div>
          <div className="text-2xl font-black text-amber-400 mt-1">{openCount}</div>
        </div>

        <div className="bg-blue-950/20 border border-blue-500/20 rounded-xl p-4">
          <span className="text-xs font-medium text-blue-300">در حال بررسی</span>
          <div className="text-2xl font-black text-blue-400 mt-1">{inProgressCount}</div>
        </div>

        <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-xl p-4">
          <span className="text-xs font-medium text-emerald-300">پاسخ داده شده</span>
          <div className="text-2xl font-black text-emerald-400 mt-1">{answeredCount}</div>
        </div>

        <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-4 col-span-2 md:col-span-1">
          <span className="text-xs font-medium text-zinc-400">بسته شده</span>
          <div className="text-2xl font-black text-zinc-500 mt-1">{closedCount}</div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-zinc-900/60 border border-zinc-800/80 p-4 rounded-xl space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-zinc-400 font-semibold flex items-center gap-1 ml-2">
            <Filter className="w-3.5 h-3.5" /> وضعیت:
          </span>
          {[
            { key: 'all', label: 'همه' },
            { key: 'open', label: 'باز (نیازمند پاسخ)' },
            { key: 'in_progress', label: 'در حال بررسی' },
            { key: 'answered', label: 'پاسخ داده شده' },
            { key: 'closed', label: 'بسته شده' }
          ].map(item => (
            <button
              key={item.key}
              onClick={() => setStatusFilter(item.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                statusFilter === item.key 
                  ? 'bg-[var(--color-asura-accent)] text-white shadow-lg' 
                  : 'bg-zinc-800/60 text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-zinc-800/60">
          {/* Priority filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400 whitespace-nowrap">اولویت:</span>
            <select
              value={priorityFilter}
              onChange={e => setPriorityFilter(e.target.value)}
              className="w-full bg-zinc-800/80 border border-zinc-700/60 rounded-lg px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">همه اولویت‌ها</option>
              <option value="low">عادی</option>
              <option value="medium">متوسط</option>
              <option value="high">مهم</option>
              <option value="urgent">فوری</option>
            </select>
          </div>

          {/* Category filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400 whitespace-nowrap">دسته‌بندی:</span>
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="w-full bg-zinc-800/80 border border-zinc-700/60 rounded-lg px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">همه دسته‌ها</option>
              <option value="account">حساب کاربری</option>
              <option value="payment">پرداخت و کیف‌پول</option>
              <option value="broken_image">خرابی تصویر/چپتر</option>
              <option value="translation_team">تیم ترجمه و ادیت</option>
              <option value="bug">گزارش باگ</option>
              <option value="other">سایر موارد</option>
            </select>
          </div>

          {/* Search box */}
          <div className="relative">
            <input
              type="text"
              placeholder="جستجو در موضوع، نام کاربر یا شناسه تیکت..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-800/80 border border-zinc-700/60 rounded-lg pr-9 pl-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
            />
            <Search className="w-4 h-4 text-zinc-500 absolute right-3 top-2.5" />
          </div>
        </div>
      </div>

      {/* Main Content: Tickets Table or List */}
      <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-zinc-400 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
            <span className="text-sm">در حال بارگذاری تیکت‌ها...</span>
          </div>
        ) : tickets.length === 0 ? (
          <div className="p-12 text-center text-zinc-500 space-y-2">
            <LifeBuoy className="w-12 h-12 mx-auto text-zinc-700 stroke-[1.5]" />
            <p className="text-sm font-medium text-zinc-400">هیچ تیکتی با این فیلترها یافت نشد.</p>
            <p className="text-xs">تیکت‌های جدید کاربران در این قسمت نمایش داده می‌شوند.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-950/40 text-xs font-semibold text-zinc-400">
                  <th className="p-4">شناسه تیکت</th>
                  <th className="p-4">کاربر ارسال‌کننده</th>
                  <th className="p-4">موضوع و دسته</th>
                  <th className="p-4">اولویت</th>
                  <th className="p-4">وضعیت</th>
                  <th className="p-4">مسئول پیگیری</th>
                  <th className="p-4">آخرین بروزرسانی</th>
                  <th className="p-4 text-center">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 text-xs">
                {tickets.map(t => {
                  const cat = CATEGORY_MAP[t.category] || CATEGORY_MAP.other;
                  const prio = PRIORITY_MAP[t.priority] || PRIORITY_MAP.medium;
                  const st = STATUS_MAP[t.status] || STATUS_MAP.open;
                  const messageCount = t.messages?.length || 0;

                  return (
                    <tr 
                      key={t.id} 
                      onClick={() => setSelectedTicket(t)}
                      className={`hover:bg-zinc-800/40 transition-colors cursor-pointer ${
                        t.status === 'open' ? 'bg-amber-500/[0.02]' : ''
                      }`}
                    >
                      <td className="p-4 font-mono font-bold text-indigo-400 dir-ltr text-right">
                        #{t.id}
                      </td>

                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-zinc-300 text-xs shrink-0 overflow-hidden">
                            {t.userAvatar ? (
                              <img src={t.userAvatar} alt="" className="w-full h-full object-cover" />
                            ) : (
                              t.userName?.charAt(0) || 'U'
                            )}
                          </div>
                          <div>
                            <span className="font-semibold text-zinc-200 block">{t.userName}</span>
                            {t.userEmail && <span className="text-[10px] text-zinc-500 block font-mono">{t.userEmail}</span>}
                          </div>
                        </div>
                      </td>

                      <td className="p-4">
                        <div className="font-semibold text-white mb-1 line-clamp-1">{t.subject}</div>
                        <span className={`inline-block px-2 py-0.5 text-[10px] rounded-md border ${cat.color}`}>
                          {cat.label}
                        </span>
                      </td>

                      <td className="p-4">
                        <span className={`px-2 py-1 rounded-md text-[10px] ${prio.bg} ${prio.text}`}>
                          {prio.label}
                        </span>
                      </td>

                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium ${st.badge}`}>
                          {st.icon}
                          {st.label}
                        </span>
                      </td>

                      <td className="p-4 text-zinc-400">
                        {t.assignedToName ? (
                          <span className="flex items-center gap-1 text-zinc-300">
                            <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
                            {t.assignedToName}
                          </span>
                        ) : (
                          <span className="text-zinc-600">تخصیص نیافته</span>
                        )}
                      </td>

                      <td className="p-4 text-zinc-400 dir-ltr text-right font-mono text-[11px]">
                        {new Date(t.lastUpdated).toLocaleDateString('fa-IR')} {new Date(t.lastUpdated).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}
                      </td>

                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-2" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => setSelectedTicket(t)}
                            className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 rounded-lg font-medium transition-colors flex items-center gap-1"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            پاسخ ({messageCount})
                          </button>
                          
                          <button
                            onClick={e => handleDeleteTicket(t.id, e)}
                            className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                            title="حذف تیکت"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Ticket Details & Reply Modal / Drawer */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-center items-center p-3 md:p-6 overflow-y-auto">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden dir-rtl">
            
            {/* Modal Header */}
            <div className="p-4 md:p-6 border-b border-zinc-800 bg-zinc-950/60 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold font-mono text-sm">
                  #{selectedTicket.id.slice(-4)}
                </div>
                <div>
                  <h3 className="text-base md:text-lg font-bold text-white flex items-center gap-2">
                    {selectedTicket.subject}
                  </h3>
                  <div className="flex items-center gap-2 mt-1 text-xs text-zinc-400">
                    <span>ارسال توسط: <strong className="text-zinc-200">{selectedTicket.userName}</strong></span>
                    <span>•</span>
                    <span>دسته‌بندی: <strong className="text-indigo-400">{CATEGORY_MAP[selectedTicket.category]?.label || 'سایر'}</strong></span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedTicket(null)}
                className="p-2 text-zinc-400 hover:text-white bg-zinc-800/80 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Status & Assignment Bar */}
            <div className="bg-zinc-950/40 p-3 md:p-4 border-b border-zinc-800/80 grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-400 whitespace-nowrap">وضعیت تیکت:</span>
                <select
                  value={editingStatus}
                  onChange={e => setEditingStatus(e.target.value)}
                  className="bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-indigo-500 w-full"
                >
                  <option value="open">باز (نیازمند پاسخ)</option>
                  <option value="in_progress">در حال بررسی</option>
                  <option value="answered">پاسخ داده شده</option>
                  <option value="closed">بسته شده</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-400 whitespace-nowrap">اولویت:</span>
                <select
                  value={editingPriority}
                  onChange={e => setEditingPriority(e.target.value)}
                  className="bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-indigo-500 w-full"
                >
                  <option value="low">عادی</option>
                  <option value="medium">متوسط</option>
                  <option value="high">مهم</option>
                  <option value="urgent">فوری</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-400 whitespace-nowrap">مسئول:</span>
                <input
                  type="text"
                  placeholder="نام پشتیبان..."
                  value={editingAssignedTo}
                  onChange={e => setEditingAssignedTo(e.target.value)}
                  className="bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-indigo-500 w-full"
                />
                <button
                  onClick={handleUpdateTicketDetails}
                  disabled={isUpdatingDetails}
                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold whitespace-nowrap transition-colors shrink-0 disabled:opacity-50"
                >
                  {isUpdatingDetails ? 'ثبت...' : 'بروزرسانی'}
                </button>
              </div>
            </div>

            {/* Conversation Thread */}
            <div className="flex-1 p-4 md:p-6 overflow-y-auto space-y-4 bg-zinc-950/20">
              {selectedTicket.messages && selectedTicket.messages.map((msg, idx) => {
                const isStaff = msg.senderRole === 'admin' || msg.senderRole === 'staff';

                return (
                  <div 
                    key={msg.id || idx}
                    className={`flex gap-3 max-w-[85%] ${isStaff ? 'mr-auto flex-row-reverse' : 'ml-auto'}`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 mt-1 border ${
                      isStaff ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-300'
                    }`}>
                      {msg.senderAvatar ? (
                        <img src={msg.senderAvatar} alt="" className="w-full h-full object-cover rounded-full" />
                      ) : isStaff ? (
                        <Shield className="w-4 h-4" />
                      ) : (
                        msg.senderName?.charAt(0) || 'U'
                      )}
                    </div>

                    <div className={`space-y-1 ${isStaff ? 'items-end text-left' : 'items-start'}`}>
                      <div className="flex items-center gap-2 text-[11px] text-zinc-400 px-1">
                        <span className="font-bold text-zinc-200">{msg.senderName}</span>
                        {isStaff && (
                          <span className="px-1.5 py-0.2 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded text-[9px] font-bold">
                            پشتیبانی
                          </span>
                        )}
                        <span className="text-zinc-500 font-mono dir-ltr">
                          {new Date(msg.createdAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <div className={`p-4 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap ${
                        isStaff 
                          ? 'bg-indigo-950/40 text-indigo-100 border border-indigo-800/50 rounded-tl-none' 
                          : 'bg-zinc-800/80 text-zinc-100 border border-zinc-700/60 rounded-tr-none'
                      }`}>
                        {msg.content}

                        {/* Attachments if any */}
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-zinc-700/40 space-y-2">
                            <span className="text-[10px] text-zinc-400 block font-semibold">پیوست‌ها:</span>
                            {msg.attachments.map((att, attIdx) => (
                              <a
                                key={attIdx}
                                href={att}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-zinc-900/80 hover:bg-zinc-900 text-indigo-300 border border-zinc-700 rounded-lg text-[11px] transition-colors"
                              >
                                <Paperclip className="w-3.5 h-3.5" />
                                مشاهده یا دانلود پیوست
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Reply Input Box */}
            <div className="p-4 md:p-6 border-t border-zinc-800 bg-zinc-950/80 space-y-3">
              {replyError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {replyError}
                </div>
              )}

              {/* Canned Responses selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-400 whitespace-nowrap flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5" /> پاسخ‌های آماده:
                </span>
                <select
                  onChange={e => {
                    if (e.target.value) {
                      setReplyText(prev => prev ? `${prev}\n${e.target.value}` : e.target.value);
                      e.target.value = '';
                    }
                  }}
                  className="bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-indigo-500 w-full"
                >
                  <option value="">انتخاب پاسخ پیش‌فرض...</option>
                  {CANNED_RESPONSES.map((resp, i) => (
                    <option key={i} value={resp}>
                      {resp.substring(0, 50)}...
                    </option>
                  ))}
                </select>
              </div>

              {/* Textarea */}
              <textarea
                rows={3}
                placeholder="پاسخ خود را بنویسید..."
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700/80 rounded-xl p-3 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 resize-none"
              />

              {/* Optional attachment link and submit button */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <input
                  type="text"
                  placeholder="لینک فایل پیوست یا تصویر (اختیاری)"
                  value={attachmentUrl}
                  onChange={e => setAttachmentUrl(e.target.value)}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 w-full sm:w-80"
                />

                <div className="flex items-center gap-2 justify-end">
                  <button
                    onClick={() => setSelectedTicket(null)}
                    className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-semibold transition-colors"
                  >
                    انصراف
                  </button>

                  <button
                    onClick={handleSendReply}
                    disabled={isSubmittingReply || !replyText.trim()}
                    className="px-5 py-2 bg-[var(--color-asura-accent)] hover:opacity-90 text-white rounded-xl text-xs font-bold transition-all shadow-lg flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                    {isSubmittingReply ? 'در حال ارسال...' : 'ارسال پاسخ'}
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default TicketsTab;
