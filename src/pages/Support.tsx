import React, { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { SEOHead } from '../components/SEOHead';
import { apiClient } from '../lib/apiClient';
import { 
  LifeBuoy, PlusCircle, MessageSquare, Clock, CheckCircle, XCircle, 
  RefreshCw, AlertTriangle, Send, Paperclip, ChevronLeft, Search, 
  Shield, FileText, ArrowRight, X, Check
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

const CATEGORIES = [
  { key: 'account', label: 'مشکلات حساب کاربری' },
  { key: 'payment', label: 'پرداخت و شارژ کیف‌پول' },
  { key: 'broken_image', label: 'خرابی تصاویر و چپترها' },
  { key: 'translation_team', label: 'درخواست عضویت تیم ترجمه و ادیت' },
  { key: 'bug', label: 'گزارش باگ یا پیشنهاد' },
  { key: 'other', label: 'سایر موارد' }
];

const CATEGORY_MAP: Record<string, string> = {
  account: 'حساب کاربری',
  payment: 'پرداخت و کیف‌پول',
  broken_image: 'خرابی تصویر/چپتر',
  translation_team: 'تیم ترجمه و ادیت',
  bug: 'گزارش باگ',
  other: 'سایر موارد'
};

const STATUS_MAP: Record<string, { label: string; badge: string; icon: React.ReactNode }> = {
  open: { label: 'در انتظار پاسخ پشتیبانی', badge: 'bg-amber-500/20 text-amber-300 border border-amber-500/30', icon: <Clock className="w-3.5 h-3.5" /> },
  in_progress: { label: 'در حال بررسی توسط پشتیبان', badge: 'bg-blue-500/20 text-blue-300 border border-blue-500/30', icon: <RefreshCw className="w-3.5 h-3.5 animate-spin-slow" /> },
  answered: { label: 'پاسخ پشتیبانی ارسال شد', badge: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30', icon: <CheckCircle className="w-3.5 h-3.5" /> },
  closed: { label: 'بسته شده', badge: 'bg-zinc-800 text-zinc-400 border border-zinc-700', icon: <XCircle className="w-3.5 h-3.5" /> }
};

export default function Support() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const siteName = settings?.siteName || "آسورا";
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  // New ticket modal state
  const [showNewModal, setShowNewModal] = useState(false);
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('other');
  const [priority, setPriority] = useState('medium');
  const [content, setContent] = useState('');
  const [attachment, setAttachment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Reply state
  const [replyContent, setReplyContent] = useState('');
  const [replyAttachment, setReplyAttachment] = useState('');
  const [replySubmitting, setReplySubmitting] = useState(false);

  // Filter & Search
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchUserTickets = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await apiClient.getTickets(user.id);
      if (Array.isArray(data)) {
        setTickets(data);
        if (selectedTicket) {
          const updated = data.find(t => t.id === selectedTicket.id);
          if (updated) setSelectedTicket(updated);
        }
      }
    } catch (err) {
      console.error('Failed to load user tickets:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchUserTickets();
    } else {
      setLoading(false);
    }
  }, [user]);

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !content.trim()) {
      setFormError('موضوع و متن تیکت را وارد کنید.');
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const attachments = attachment.trim() ? [attachment.trim()] : [];
      await apiClient.createTicket({
        subject: subject.trim(),
        category,
        priority,
        content: content.trim(),
        attachments
      }, user?.id);

      setShowNewModal(false);
      setSubject('');
      setContent('');
      setAttachment('');
      fetchUserTickets();
    } catch (err: any) {
      setFormError(err.message || 'خطا در ثبت تیکت');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendReply = async () => {
    if (!selectedTicket || !replyContent.trim()) return;
    setReplySubmitting(true);
    try {
      const attachments = replyAttachment.trim() ? [replyAttachment.trim()] : [];
      await apiClient.replyTicket(selectedTicket.id, replyContent.trim(), attachments, user?.id);
      setReplyContent('');
      setReplyAttachment('');
      fetchUserTickets();
    } catch (err) {
      console.error('Failed to reply ticket:', err);
    } finally {
      setReplySubmitting(false);
    }
  };

  const handleCloseTicket = async () => {
    if (!selectedTicket) return;
    if (!window.confirm('آیا مایل به بستن این تیکت هستید؟')) return;
    try {
      await apiClient.closeTicket(selectedTicket.id, user?.id);
      fetchUserTickets();
    } catch (err) {
      console.error('Failed to close ticket:', err);
    }
  };

  const filteredTickets = tickets.filter(t => {
    if (filterStatus !== 'all' && t.status !== filterStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return t.subject.toLowerCase().includes(q) || t.id.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <Layout>
      <SEOHead 
        title={`پشتیبانی آنلاین و تیکت‌ها | ${siteName}`}
        description={`پشتیبانی آنلاین، پیگیری درخواست‌ها و ارسال تیکت در ${siteName}`}
      />
      <div className="container mx-auto px-4 py-8 max-w-6xl text-zinc-100" dir="rtl">
        
        {/* Banner Section */}
        <div className="relative overflow-hidden bg-gradient-to-r from-zinc-900 via-indigo-950/40 to-zinc-900 border border-zinc-800 rounded-3xl p-6 md:p-8 mb-8 shadow-2xl">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-full text-xs font-semibold">
                <LifeBuoy className="w-3.5 h-3.5" /> مرکز پشتیبانی و تیکت‌ها
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-white">پشتیبانی آنلاین {siteName}</h1>
              <p className="text-xs md:text-sm text-zinc-400 max-w-xl leading-relaxed">
                هرگونه سؤال، مشکل در خرید، خرابی چپترها یا درخواست‌های خود را مطرح کنید. کارشناسان پشتیبانی ما در سریع‌ترین زمان ممکن پاسخگوی شما خواهند بود.
              </p>
            </div>

            {user ? (
              <button
                onClick={() => setShowNewModal(true)}
                className="px-6 py-3.5 bg-[var(--color-asura-accent)] hover:opacity-90 text-white rounded-2xl font-bold text-sm transition-all shadow-xl flex items-center justify-center gap-2 shrink-0"
              >
                <PlusCircle className="w-5 h-5" />
                ارسال تیکت جدید
              </button>
            ) : (
              <div className="p-4 bg-zinc-800/80 border border-zinc-700/80 rounded-2xl text-xs text-zinc-300">
                جهت ارسال تیکت و پیگیری پیام‌ها ابتدا وارد حساب کاربری خود شوید.
              </div>
            )}
          </div>
        </div>

        {/* Content Layout */}
        {!user ? (
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-12 text-center space-y-4">
            <Shield className="w-16 h-16 mx-auto text-indigo-400 opacity-80" />
            <h3 className="text-lg font-bold text-white">برای استفاده از سیستم پشتیبانی وارد شوید</h3>
            <p className="text-xs text-zinc-400 max-w-md mx-auto">
              تیکت‌های شما به حساب کاربریتان متصل می‌شوند تا بتوانید پاسخ‌های کارشناسان را به صورت آنلاین دریافت کنید.
            </p>
          </div>
        ) : selectedTicket ? (
          /* Single Ticket Detail View */
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl space-y-0">
            {/* Thread Header */}
            <div className="p-6 border-b border-zinc-800 bg-zinc-950/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <button
                  onClick={() => setSelectedTicket(null)}
                  className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-semibold mb-2"
                >
                  <ArrowRight className="w-4 h-4" /> بازگشت به لیست تیکت‌ها
                </button>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-indigo-400 text-sm">#{selectedTicket.id}</span>
                  <h2 className="text-xl font-bold text-white">{selectedTicket.subject}</h2>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400 pt-1">
                  <span>دسته: <strong className="text-zinc-200">{CATEGORY_MAP[selectedTicket.category] || 'سایر'}</strong></span>
                  <span>•</span>
                  <span>تاریخ ارسال: <strong className="text-zinc-200 font-mono">{new Date(selectedTicket.createdAt).toLocaleDateString('fa-IR')}</strong></span>
                </div>
              </div>

              <div className="flex items-center gap-3 self-start sm:self-auto">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
                  (STATUS_MAP[selectedTicket.status] || STATUS_MAP.open).badge
                }`}>
                  {(STATUS_MAP[selectedTicket.status] || STATUS_MAP.open).icon}
                  {(STATUS_MAP[selectedTicket.status] || STATUS_MAP.open).label}
                </span>

                {selectedTicket.status !== 'closed' && (
                  <button
                    onClick={handleCloseTicket}
                    className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-medium transition-colors"
                  >
                    بستن تیکت
                  </button>
                )}
              </div>
            </div>

            {/* Conversation Messages */}
            <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto bg-zinc-950/30">
              {selectedTicket.messages && selectedTicket.messages.map((m, i) => {
                const isStaff = m.senderRole === 'admin' || m.senderRole === 'staff';

                return (
                  <div
                    key={m.id || i}
                    className={`flex gap-3 max-w-[85%] ${isStaff ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
                  >
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 mt-1 ${
                      isStaff ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-300'
                    }`}>
                      {m.senderAvatar ? (
                        <img src={m.senderAvatar} alt="" className="w-full h-full object-cover rounded-full" />
                      ) : isStaff ? (
                        <Shield className="w-4 h-4" />
                      ) : (
                        m.senderName?.charAt(0) || 'U'
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs text-zinc-400 px-1">
                        <span className="font-bold text-zinc-200">{m.senderName}</span>
                        {isStaff && (
                          <span className="px-1.5 py-0.2 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded text-[10px] font-bold">
                            پشتیبانی
                          </span>
                        )}
                        <span className="text-[11px] text-zinc-500 font-mono">
                          {new Date(m.createdAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <div className={`p-4 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap ${
                        isStaff 
                          ? 'bg-indigo-950/40 text-indigo-100 border border-indigo-800/50 rounded-tl-none' 
                          : 'bg-zinc-800/80 text-zinc-100 border border-zinc-700/60 rounded-tr-none'
                      }`}>
                        {m.content}

                        {m.attachments && m.attachments.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-zinc-700/40 space-y-1">
                            <span className="text-[10px] text-zinc-400 block">فایل پیوست:</span>
                            {m.attachments.map((att, attIdx) => (
                              <a
                                key={attIdx}
                                href={att}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-zinc-900 text-indigo-300 border border-zinc-700 rounded-lg text-[11px]"
                              >
                                <Paperclip className="w-3.5 h-3.5" /> مشاهده پیوست
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
            {selectedTicket.status !== 'closed' ? (
              <div className="p-6 border-t border-zinc-800 bg-zinc-950/80 space-y-3">
                <textarea
                  rows={3}
                  placeholder="پاسخ خود را بنویسید..."
                  value={replyContent}
                  onChange={e => setReplyContent(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 resize-none"
                />

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <input
                    type="text"
                    placeholder="لینک فایل پیوست یا اسکرین‌شات (اختیاری)"
                    value={replyAttachment}
                    onChange={e => setReplyAttachment(e.target.value)}
                    className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 w-full sm:w-80"
                  />

                  <button
                    onClick={handleSendReply}
                    disabled={replySubmitting || !replyContent.trim()}
                    className="px-6 py-2.5 bg-[var(--color-asura-accent)] hover:opacity-90 text-white rounded-xl text-xs font-bold transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                    {replySubmitting ? 'در حال ارسال...' : 'ارسال پاسخ'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-6 border-t border-zinc-800 bg-zinc-950/80 text-center text-xs text-zinc-400">
                این تیکت بسته شده است. در صورت داشتن سؤال جدید، یک تیکت جدید ارسال نمایید.
              </div>
            )}
          </div>
        ) : (
          /* Tickets List View */
          <div className="space-y-6">
            
            {/* Filter and Search Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-900/60 border border-zinc-800 p-4 rounded-2xl">
              <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
                {[
                  { key: 'all', label: 'همه تیکت‌ها' },
                  { key: 'open', label: 'در انتظار پاسخ' },
                  { key: 'answered', label: 'پاسخ داده شده' },
                  { key: 'closed', label: 'بسته شده' }
                ].map(item => (
                  <button
                    key={item.key}
                    onClick={() => setFilterStatus(item.key)}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                      filterStatus === item.key 
                        ? 'bg-[var(--color-asura-accent)] text-white shadow-lg' 
                        : 'bg-zinc-800/60 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="relative w-full md:w-72">
                <input
                  type="text"
                  placeholder="جستجو در تیکت‌ها..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-zinc-800/80 border border-zinc-700/60 rounded-xl pr-9 pl-3 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                />
                <Search className="w-4 h-4 text-zinc-500 absolute right-3 top-2.5" />
              </div>
            </div>

            {/* Tickets Cards Grid */}
            {loading ? (
              <div className="p-12 text-center text-zinc-400 flex flex-col items-center justify-center gap-3">
                <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
                <span className="text-sm">در حال بارگذاری تیکت‌ها...</span>
              </div>
            ) : filteredTickets.length === 0 ? (
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-3xl p-12 text-center space-y-3">
                <MessageSquare className="w-12 h-12 mx-auto text-zinc-700" />
                <h3 className="text-base font-bold text-zinc-300">هیچ تیکتی یافت نشد</h3>
                <p className="text-xs text-zinc-500">اگر سوالی دارید می‌توانید تیکت جدید ارسال کنید.</p>
                <button
                  onClick={() => setShowNewModal(true)}
                  className="mt-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-2"
                >
                  <PlusCircle className="w-4 h-4" /> ارسال اولین تیکت
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredTickets.map(t => {
                  const st = STATUS_MAP[t.status] || STATUS_MAP.open;
                  const catLabel = CATEGORY_MAP[t.category] || 'سایر';
                  const msgCount = t.messages?.length || 0;

                  return (
                    <div
                      key={t.id}
                      onClick={() => setSelectedTicket(t)}
                      className="bg-zinc-900/80 hover:bg-zinc-900 border border-zinc-800 hover:border-indigo-500/40 rounded-2xl p-5 transition-all cursor-pointer shadow-lg space-y-3 flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs text-indigo-400 font-bold">#{t.id}</span>
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium ${st.badge}`}>
                            {st.icon} {st.label}
                          </span>
                        </div>

                        <h3 className="text-sm font-bold text-white line-clamp-1">{t.subject}</h3>
                      </div>

                      <div className="flex items-center justify-between text-xs text-zinc-400 pt-3 border-t border-zinc-800/60">
                        <span className="bg-zinc-800/80 px-2 py-0.5 rounded-md text-[10px] text-zinc-300">
                          {catLabel}
                        </span>

                        <span className="font-mono text-[11px] text-zinc-500">
                          {new Date(t.lastUpdated).toLocaleDateString('fa-IR')}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

          </div>
        )}

        {/* Modal: Create New Ticket */}
        {showNewModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-center items-center p-4 overflow-y-auto">
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-xl p-6 md:p-8 space-y-6 shadow-2xl dir-rtl">
              
              <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
                <div className="flex items-center gap-2">
                  <LifeBuoy className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-lg font-bold text-white">ارسال تیکت جدید</h3>
                </div>
                <button
                  onClick={() => setShowNewModal(false)}
                  className="p-1.5 text-zinc-400 hover:text-white bg-zinc-800 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {formError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {formError}
                </div>
              )}

              <form onSubmit={handleCreateTicket} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">موضوع تیکت *</label>
                  <input
                    type="text"
                    required
                    placeholder="عنوان خلاصه مشکل یا درخواست شما..."
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700/80 rounded-xl px-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5">دسته‌بندی موضوع</label>
                    <select
                      value={category}
                      onChange={e => setCategory(e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700/80 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                    >
                      {CATEGORIES.map(c => (
                        <option key={c.key} value={c.key}>{c.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5">اولویت</label>
                    <select
                      value={priority}
                      onChange={e => setPriority(e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700/80 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="low">عادی</option>
                      <option value="medium">متوسط</option>
                      <option value="high">مهم</option>
                      <option value="urgent">فوری</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">شرح پیام *</label>
                  <textarea
                    rows={5}
                    required
                    placeholder="جزئیات کامل درخواست یا مشکل خود را شرح دهید..."
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700/80 rounded-xl p-4 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">لینک تصویر یا فایل پیوست (اختیاری)</label>
                  <input
                    type="text"
                    placeholder="https://..."
                    value={attachment}
                    onChange={e => setAttachment(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700/80 rounded-xl px-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setShowNewModal(false)}
                    className="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-semibold transition-colors"
                  >
                    انصراف
                  </button>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-2.5 bg-[var(--color-asura-accent)] hover:opacity-90 text-white rounded-xl text-xs font-bold transition-all shadow-lg flex items-center gap-2 disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                    {submitting ? 'در حال ثبت...' : 'ارسال تیکت'}
                  </button>
                </div>
              </form>

            </div>
          </div>
        )}

      </div>
    </Layout>
  );
}
