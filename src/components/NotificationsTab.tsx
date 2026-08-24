import React, { useState, useEffect } from 'react';
import { 
  Bell, Send, Trash2, RefreshCw, Radio, User, Volume2, 
  CheckCircle, AlertCircle, Sparkles, Clock, ShieldCheck, 
  Database, Layers, MessageSquare, Zap, BarChart2 
} from 'lucide-react';
import { apiClient } from '../lib/apiClient';

interface NotificationsTabProps {
  adminUid: string;
  usersList?: any[];
}

export default function NotificationsTab({ adminUid, usersList = [] }: NotificationsTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<'broadcast' | 'direct' | 'maintenance' | 'stats'>('broadcast');
  
  // Stats
  const [stats, setStats] = useState<{ total: number; unread: number; read: number; system: number; releases: number; lastCleanup?: string } | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Broadcast Form
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastBody, setBroadcastBody] = useState('');
  const [broadcastLink, setBroadcastLink] = useState('');
  const [broadcastType, setBroadcastType] = useState('announcement');
  const [targetRole, setTargetRole] = useState('all');
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [broadcastSuccess, setBroadcastSuccess] = useState('');

  // Direct Send Form
  const [directUserId, setDirectUserId] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [directTitle, setDirectTitle] = useState('');
  const [directBody, setDirectBody] = useState('');
  const [directLink, setDirectLink] = useState('');
  const [directType, setDirectType] = useState('system');
  const [sendingDirect, setSendingDirect] = useState(false);
  const [directSuccess, setDirectSuccess] = useState('');

  // Maintenance & Cleanup
  const [cleaningUp, setCleaningUp] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<any>(null);

  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const res = await apiClient.getNotificationStats(adminUid);
      if (res && res.stats) {
        setStats(res.stats);
      }
    } catch (err) {
      console.error("Failed to load notification stats:", err);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [adminUid]);

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTitle.trim() || !broadcastBody.trim()) return;
    setSendingBroadcast(true);
    setBroadcastSuccess('');
    try {
      const res = await apiClient.broadcastNotification({
        title: broadcastTitle.trim(),
        body: broadcastBody.trim(),
        link: broadcastLink.trim(),
        type: broadcastType,
        targetRole
      }, adminUid);

      if (res.success) {
        setBroadcastSuccess(`اعلان همگانی با موفقیت برای ${res.recipientCount || 'تمامی'} کاربر ارسال شد!`);
        setBroadcastTitle('');
        setBroadcastBody('');
        setBroadcastLink('');
        fetchStats();
      } else {
        alert(res.error || 'خطا در ارسال اعلان همگانی');
      }
    } catch (err: any) {
      alert(err.message || 'خطا در برقراری ارتباط');
    } finally {
      setSendingBroadcast(false);
    }
  };

  const handleSendDirect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directUserId || !directTitle.trim() || !directBody.trim()) {
      alert('لطفاً کاربر، عنوان و متن اعلان را وارد کنید.');
      return;
    }
    setSendingDirect(true);
    setDirectSuccess('');
    try {
      const res = await apiClient.sendDirectNotification({
        userId: directUserId,
        title: directTitle.trim(),
        body: directBody.trim(),
        link: directLink.trim(),
        type: directType
      }, adminUid);

      if (res.success) {
        setDirectSuccess('اعلان اختصاصی به صورت آنی برای کاربر ارسال شد!');
        setDirectTitle('');
        setDirectBody('');
        setDirectLink('');
        fetchStats();
      } else {
        alert(res.error || 'خطا در ارسال اعلان');
      }
    } catch (err: any) {
      alert(err.message || 'خطا در ارتباط با سرور');
    } finally {
      setSendingDirect(false);
    }
  };

  const handleManualCleanup = async () => {
    if (!confirm('آیا از اجرای پاکسازی خودکار اطمینان دارید؟ (اعلان‌های خوانده شده بیش از ۲۴ ساعت و اعلان‌های خوانده نشده بیش از ۷ روز حذف می‌شوند)')) {
      return;
    }
    setCleaningUp(true);
    setCleanupResult(null);
    try {
      const res = await apiClient.cleanupNotifications(adminUid);
      setCleanupResult(res);
      fetchStats();
    } catch (err: any) {
      alert(err.message || 'خطا در پاکسازی');
    } finally {
      setCleaningUp(false);
    }
  };

  const filteredUsers = usersList.filter(u => {
    if (!userSearch) return true;
    const q = userSearch.toLowerCase();
    return (
      u.displayName?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.id?.toLowerCase().includes(q)
    );
  }).slice(0, 15);

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* Header Banner */}
      <div className="bg-gradient-to-l from-indigo-950/40 via-[var(--color-asura-card)] to-black/40 border border-indigo-500/20 rounded-2xl p-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
              <Bell size={24} />
            </div>
            <div>
              <h2 className="text-lg font-black text-white">مدیریت جامع اعلان‌ها و پاکسازی حافظه</h2>
              <p className="text-xs text-zinc-400 mt-1">
                ارسال اطلاعیه‌های همگانی، ارسال پیام مستقیم به کاربران و مدیریت چرخه عمر داده‌های اعلان
              </p>
            </div>
          </div>

          {/* Quick Stats Pill */}
          <div className="flex items-center gap-3">
            <button
              onClick={fetchStats}
              disabled={loadingStats}
              className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-zinc-300 transition-colors text-xs flex items-center gap-1.5"
            >
              <RefreshCw size={14} className={loadingStats ? "animate-spin" : ""} />
              بروزرسانی آمار
            </button>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-4 border-t border-white/5">
          <div className="bg-black/30 border border-white/5 p-3 rounded-xl">
            <span className="text-[10px] text-zinc-400 font-bold block">کل اعلان‌های فعال</span>
            <span className="text-xl font-black text-white mt-1 block font-mono">{stats?.total ?? '-'}</span>
          </div>
          <div className="bg-black/30 border border-white/5 p-3 rounded-xl">
            <span className="text-[10px] text-zinc-400 font-bold block">اعلان‌های خوانده نشده</span>
            <span className="text-xl font-black text-amber-400 mt-1 block font-mono">{stats?.unread ?? '-'}</span>
          </div>
          <div className="bg-black/30 border border-white/5 p-3 rounded-xl">
            <span className="text-[10px] text-zinc-400 font-bold block">اعلان‌های خوانده شده</span>
            <span className="text-xl font-black text-emerald-400 mt-1 block font-mono">{stats?.read ?? '-'}</span>
          </div>
          <div className="bg-black/30 border border-white/5 p-3 rounded-xl">
            <span className="text-[10px] text-zinc-400 font-bold block">سرویس پاکسازی خودکار</span>
            <span className="text-xs font-black text-indigo-400 mt-1 flex items-center gap-1">
              <CheckCircle size={13} /> فعال (هر ۳۰ دقیقه)
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-3 overflow-x-auto">
        <button
          onClick={() => setActiveSubTab('broadcast')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
            activeSubTab === 'broadcast'
              ? 'bg-[var(--color-asura-accent)] text-white shadow-md'
              : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10'
          }`}
        >
          <Radio size={15} />
          ارسال همگانی (Broadcast)
        </button>

        <button
          onClick={() => setActiveSubTab('direct')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
            activeSubTab === 'direct'
              ? 'bg-[var(--color-asura-accent)] text-white shadow-md'
              : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10'
          }`}
        >
          <User size={15} />
          ارسال مستقیم به کاربر
        </button>

        <button
          onClick={() => setActiveSubTab('maintenance')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
            activeSubTab === 'maintenance'
              ? 'bg-[var(--color-asura-accent)] text-white shadow-md'
              : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10'
          }`}
        >
          <Database size={15} />
          پاکسازی و چرخه عمر حافظه
        </button>
      </div>

      {/* SUB-TAB 1: Broadcast */}
      {activeSubTab === 'broadcast' && (
        <form onSubmit={handleSendBroadcast} className="bg-[var(--color-asura-card)] border border-[var(--color-asura-border)] rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <Radio size={16} className="text-[var(--color-asura-accent-light)]" />
              ارسال اعلان سراسری برای همه کاربران
            </h3>
            <span className="text-[11px] text-zinc-400">به صورت Live Socket و ذخیره در دیتابیس</span>
          </div>

          {broadcastSuccess && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle size={16} />
              {broadcastSuccess}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-zinc-400 block mb-1 font-bold">نوع اعلان</label>
              <select
                value={broadcastType}
                onChange={(e) => setBroadcastType(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[var(--color-asura-accent)]"
              >
                <option value="announcement" className="bg-zinc-900">اطلاعیه همگانی (Announcement)</option>
                <option value="system" className="bg-zinc-900">پیام سیستمی (System)</option>
                <option value="event" className="bg-zinc-900">رویداد و جشنواره (Event / Festival)</option>
                <option value="maintenance" className="bg-zinc-900">بروزرسانی و سرور (Maintenance)</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-zinc-400 block mb-1 font-bold">گروه هدف</label>
              <select
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[var(--color-asura-accent)]"
              >
                <option value="all" className="bg-zinc-900">همه کاربران سایت</option>
                <option value="vip" className="bg-zinc-900">فقط کاربران VIP</option>
                <option value="translators" className="bg-zinc-900">تیم ترجمه و ادیتورها</option>
                <option value="staff" className="bg-zinc-900">کل اعضای کادر (Staff)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-zinc-400 block mb-1 font-bold">عنوان اعلان *</label>
            <input
              type="text"
              required
              value={broadcastTitle}
              onChange={(e) => setBroadcastTitle(e.target.value)}
              placeholder="مثال: جشنواره ویژه عیدانه با سکه‌های دوبرابر!"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[var(--color-asura-accent)]"
            />
          </div>

          <div>
            <label className="text-xs text-zinc-400 block mb-1 font-bold">متن پیام *</label>
            <textarea
              required
              rows={3}
              value={broadcastBody}
              onChange={(e) => setBroadcastBody(e.target.value)}
              placeholder="توضیحات و متن اصلی اعلان که در مرکز اعلان‌های کاربران ظاهر می‌شود..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[var(--color-asura-accent)] resize-none"
            />
          </div>

          <div>
            <label className="text-xs text-zinc-400 block mb-1 font-bold">لینک هدایت (اختیاری)</label>
            <input
              type="text"
              value={broadcastLink}
              onChange={(e) => setBroadcastLink(e.target.value)}
              placeholder="مثال: /vip یا /series/solo-leveling"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[var(--color-asura-accent)] text-left"
              dir="ltr"
            />
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={sendingBroadcast}
              className="btn-asura-primary px-6 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2"
            >
              <Send size={14} className={sendingBroadcast ? "animate-pulse" : ""} />
              {sendingBroadcast ? 'در حال ارسال سراسری...' : 'ارسال اعلان به همه'}
            </button>
          </div>
        </form>
      )}

      {/* SUB-TAB 2: Direct Notification */}
      {activeSubTab === 'direct' && (
        <form onSubmit={handleSendDirect} className="bg-[var(--color-asura-card)] border border-[var(--color-asura-border)] rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <User size={16} className="text-[var(--color-asura-accent-light)]" />
              ارسال پیام مستقیم به یک کاربر خاص
            </h3>
            <span className="text-[11px] text-zinc-400">اعلان اختصاصی در پنل کاربری شخص</span>
          </div>

          {directSuccess && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle size={16} />
              {directSuccess}
            </div>
          )}

          <div>
            <label className="text-xs text-zinc-400 block mb-1 font-bold">جستجو و انتخاب کاربر *</label>
            <input
              type="text"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="نام کاربری، ایمیل یا شناسه کاربر را تایپ کنید..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[var(--color-asura-accent)] mb-2"
            />

            {filteredUsers.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-40 overflow-y-auto custom-scrollbar p-1 bg-black/20 rounded-xl border border-white/5">
                {filteredUsers.map(u => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setDirectUserId(u.id)}
                    className={`p-2 rounded-lg border text-right transition-all flex items-center justify-between ${
                      directUserId === u.id
                        ? 'bg-[var(--color-asura-accent)]/20 border-[var(--color-asura-accent)] text-white'
                        : 'bg-white/5 border-white/5 text-zinc-300 hover:bg-white/10'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold truncate">{u.displayName || u.email?.split('@')[0]}</div>
                      <div className="text-[10px] text-zinc-500 truncate" dir="ltr">{u.email}</div>
                    </div>
                    {directUserId === u.id && <CheckCircle size={14} className="text-[var(--color-asura-accent-light)] flex-shrink-0 mr-1" />}
                  </button>
                ))}
              </div>
            )}

            {directUserId && (
              <div className="mt-2 text-xs text-indigo-400 flex items-center gap-1 font-mono">
                <span>شناسه کاربر انتخاب‌شده:</span>
                <span className="bg-indigo-500/20 px-2 py-0.5 rounded">{directUserId}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-zinc-400 block mb-1 font-bold">نوع پیام</label>
              <select
                value={directType}
                onChange={(e) => setDirectType(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[var(--color-asura-accent)]"
              >
                <option value="system" className="bg-zinc-900">پیام مدیریت و پشتیبانی (System)</option>
                <option value="wallet" className="bg-zinc-900">تراکنش و شارژ کیف پول (Wallet)</option>
                <option value="badge" className="bg-zinc-900">اهدای نشان و افتخار (Badge)</option>
                <option value="ticket" className="bg-zinc-900">پاسخ به تیکت پشتیبانی (Ticket)</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-zinc-400 block mb-1 font-bold">عنوان اعلان *</label>
              <input
                type="text"
                required
                value={directTitle}
                onChange={(e) => setDirectTitle(e.target.value)}
                placeholder="مثال: جایزه ویژه فعالیت شما در سایت"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[var(--color-asura-accent)]"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-zinc-400 block mb-1 font-bold">متن پیام *</label>
            <textarea
              required
              rows={3}
              value={directBody}
              onChange={(e) => setDirectBody(e.target.value)}
              placeholder="متن پیام خصوصی برای کاربر..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[var(--color-asura-accent)] resize-none"
            />
          </div>

          <div>
            <label className="text-xs text-zinc-400 block mb-1 font-bold">لینک ارجاع (اختیاری)</label>
            <input
              type="text"
              value={directLink}
              onChange={(e) => setDirectLink(e.target.value)}
              placeholder="مثال: /profile یا /wallet"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[var(--color-asura-accent)] text-left"
              dir="ltr"
            />
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={sendingDirect || !directUserId}
              className="btn-asura-primary px-6 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 disabled:opacity-50"
            >
              <Send size={14} className={sendingDirect ? "animate-pulse" : ""} />
              {sendingDirect ? 'در حال ارسال...' : 'ارسال به کاربر'}
            </button>
          </div>
        </form>
      )}

      {/* SUB-TAB 3: Maintenance & Auto-Cleanup Rules */}
      {activeSubTab === 'maintenance' && (
        <div className="bg-[var(--color-asura-card)] border border-[var(--color-asura-border)] rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <div>
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Database size={16} className="text-amber-400" />
                سیاست‌های پاکسازی خودکار و بهینه‌سازی هاست
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                جلوگیری از انباشت میلیون‌ها رکورد تاریخ گذشته در دیتابیس و پر شدن فضای ذخیره‌سازی سرور
              </p>
            </div>

            <button
              onClick={handleManualCleanup}
              disabled={cleaningUp}
              className="bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors"
            >
              <Trash2 size={14} className={cleaningUp ? "animate-spin" : ""} />
              {cleaningUp ? 'در حال اجرای پاکسازی...' : 'اجرای دستی پاکسازی دیتابیس'}
            </button>
          </div>

          {cleanupResult && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle size={16} />
                <span>عملیات پاکسازی با موفقیت انجام شد:</span>
                <span className="font-mono font-bold">
                  {cleanupResult.deletedCount ?? 0} اعلان قدیمی حذف گردید.
                </span>
              </div>
              <span className="text-[10px] text-zinc-500">{new Date().toLocaleTimeString('fa-IR')}</span>
            </div>
          )}

          {/* Rules Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-black/30 border border-white/5 p-4 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                <Clock size={16} />
                <span>۱. پاکسازی روزانه اعلان‌های خوانده‌شده</span>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed">
                تمام اعلان‌هایی که توسط کاربر باز شده و خوانده شده‌اند (<code className="text-indigo-300">read: true</code>)، پس از سپری شدن <strong>۲۴ ساعت</strong> به صورت اتوماتیک از دیتابیس سرور حذف می‌شوند.
              </p>
              <div className="text-[10px] text-zinc-500 pt-1">دوره اجرا: هر ۳۰ دقیقه توسط ورکر پس‌زمینه</div>
            </div>

            <div className="bg-black/30 border border-white/5 p-4 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                <Clock size={16} />
                <span>۲. پاکسازی هفتگی اعلان‌های خوانده‌نشده</span>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed">
                اعلان‌های قدیمی که کاربر حتی پس از <strong>۷ روز</strong> آن‌ها را باز نکرده است، به عنوان نوتیفیکیشن منقضی‌شده تلقی شده و از حافظه هاست پاک می‌شوند تا عملکرد سریع دیتابیس حفظ شود.
              </p>
              <div className="text-[10px] text-zinc-500 pt-1">دوره اجرا: هر ۳۰ دقیقه توسط ورکر پس‌زمینه</div>
            </div>
          </div>

          <div className="p-4 bg-white/5 border border-white/5 rounded-xl text-xs text-zinc-400 flex items-start gap-3">
            <ShieldCheck size={18} className="text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-white block mb-1">سازگاری دوگانه سرور (MySQL & Local DB Engine)</span>
              این سیستم به صورت بومی با هر دو موتور پایگاه داده دپلوی (MySQL) و داده‌های توسعه محلی سازگار است و نیازی به پیکربندی دستی کرون‌جاب لینوکس ندارد.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
