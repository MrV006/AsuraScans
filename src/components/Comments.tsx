import React, { useState, useEffect } from 'react';
import { apiClient, getSocketInstance } from '../lib/apiClient';
import { useAuth } from '../contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { faIR } from 'date-fns/locale';
import { 
  Trash2, 
  User as UserIcon, 
  ThumbsUp, 
  ThumbsDown, 
  MessageSquare, 
  AlertTriangle, 
  Clock, 
  CornerDownLeft, 
  LogIn, 
  ShieldCheck, 
  Send,
  Eye,
  EyeOff,
  Pin
} from 'lucide-react';

interface Comment {
  id: string;
  seriesId: string;
  chapterId?: string;
  parentId?: string;
  authorId: string;
  content: string;
  status?: 'pending' | 'approved' | 'rejected';
  isPinned?: boolean;
  pinnedAt?: any;
  createdAt: any;
  updatedAt?: any;
  likes?: string[];
  dislikes?: string[];
  authorProfile?: {
    displayName: string;
    avatarUrl: string;
  };
}

function SpoilerText({ text }: { text: string; key?: React.Key }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <span 
      onClick={(e) => {
        e.stopPropagation();
        setRevealed(!revealed);
      }}
      className={`inline-flex items-center gap-1 cursor-pointer px-2 py-0.5 rounded-lg text-xs transition-all duration-300 font-medium ${
        revealed 
          ? 'bg-zinc-800 text-zinc-100 border border-zinc-700/60 shadow-sm' 
          : 'bg-zinc-900 text-zinc-600 select-none hover:bg-zinc-800 hover:text-zinc-400 border border-zinc-800'
      }`}
      title="اسپویلر - برای مشاهده کلیک کنید"
      dir="auto"
    >
      {revealed ? (
        <>
          <Eye size={12} className="text-zinc-400 shrink-0 inline" />
          <span>{text}</span>
        </>
      ) : (
        <>
          <EyeOff size={12} className="text-amber-500 shrink-0 inline" />
          <span className="font-bold text-amber-500/80">اسپویلر (کلیک برای نمایش)</span>
        </>
      )}
    </span>
  );
}

export function Comments({ seriesId, chapterId }: { seriesId: string; chapterId?: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyText, setReplyText] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [isMainSpoiler, setIsMainSpoiler] = useState(false);
  const [isReplySpoiler, setIsReplySpoiler] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user, profile, setShowSetupModal } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);

  const commentScopeId = chapterId || (seriesId.startsWith('series-') ? seriesId : `series-${seriesId}`);

  const [pendingNotice, setPendingNotice] = useState<string | null>(null);

  const fetchComments = async () => {
    try {
      const data = await apiClient.getComments(commentScopeId, user?.uid || user?.id);
      if (Array.isArray(data)) {
        const mappedComments: Comment[] = data.map((c: any) => ({
          id: c.id,
          seriesId,
          chapterId: c.chapterId,
          parentId: c.parentId || '',
          authorId: c.userId || c.authorId,
          content: c.content,
          status: c.status || 'approved',
          isPinned: !!c.isPinned,
          pinnedAt: c.pinnedAt || null,
          createdAt: c.createdAt ? { toDate: () => new Date(c.createdAt) } : null,
          likes: Array.isArray(c.likes) ? c.likes : (typeof c.likes === 'string' ? JSON.parse(c.likes || '[]') : []),
          dislikes: Array.isArray(c.dislikes) ? c.dislikes : (typeof c.dislikes === 'string' ? JSON.parse(c.dislikes || '[]') : []),
          authorProfile: {
            displayName: c.userName || c.authorName || 'کاربر مانگا',
            avatarUrl: c.userAvatar || c.authorAvatar || ''
          }
        }));
        setComments(mappedComments);
      }
    } catch (e) {
      console.error("Error fetching comments via API", e);
    }
  };

  useEffect(() => {
    const isSuperOrAdmin = user?.email === "amirrezaveisi45@gmail.com" || 
                           user?.email === "Mr.V@admin.com" || 
                           profile?.role === "admin" ||
                           (profile?.roles && profile.roles.includes('super_admin'));
    setIsAdmin(!!isSuperOrAdmin);

    fetchComments();

    const socket = getSocketInstance();
    const handleUpdate = (data: any) => {
      if (!data || !data.chapterId || data.chapterId === commentScopeId) {
        fetchComments();
      }
    };

    socket.on("comments:updated", handleUpdate);

    return () => {
      socket.off("comments:updated", handleUpdate);
    };
  }, [seriesId, chapterId, user, profile, commentScopeId]);

  const handleSubmit = async (e: React.FormEvent, parentId?: string) => {
    e.preventDefault();
    if (!user || isSubmitting) return;
    const isReply = !!parentId;
    let rawContent = isReply ? replyText.trim() : newComment.trim();
    if (!rawContent) return;

    const shouldSpoiler = isReply ? isReplySpoiler : isMainSpoiler;
    const finalContent = shouldSpoiler ? `[spoiler]${rawContent}[/spoiler]` : rawContent;

    setIsSubmitting(true);
    try {
      const randomId = 'comment_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
      const res = await apiClient.addComment(commentScopeId, {
        id: randomId,
        userId: user.uid || user.id,
        userName: profile?.displayName || user.displayName || user.email?.split('@')[0] || 'کاربر مانگا',
        userAvatar: profile?.avatarUrl || user.photoURL || '',
        content: finalContent,
        parentId: parentId
      });

      if (res && res.status === 'pending') {
        setPendingNotice('دیدگاه شما با موفقیت ثبت شد و پس از بررسی و تایید توسط مدیریت در وبسایت منتشر خواهد شد.');
        setTimeout(() => setPendingNotice(null), 7000);
      } else {
        setPendingNotice(null);
      }

      if (isReply) {
        setReplyText('');
        setReplyingTo(null);
        setIsReplySpoiler(false);
      } else {
        setNewComment('');
        setIsMainSpoiler(false);
      }

      await fetchComments();
    } catch (error) {
      console.error("Error adding comment:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!window.confirm("آیا از حذف این دیدگاه اطمینان دارید؟")) return;
    try {
      await apiClient.deleteComment(commentId, user?.uid || user?.id);
      setComments(prev => prev.filter(c => c.id !== commentId && c.parentId !== commentId));
      fetchComments();
    } catch (error) {
      console.error("Error deleting comment:", error);
    }
  };

  const handleTogglePin = async (commentId: string) => {
    if (!isAdmin) return;
    try {
      setComments(prev => prev.map(c => {
        if (c.id === commentId) {
          return { ...c, isPinned: !c.isPinned };
        }
        return c;
      }));
      await apiClient.togglePinComment(commentId, user?.uid || user?.id);
      fetchComments();
    } catch (error) {
      console.error("Error pinning comment:", error);
      fetchComments();
    }
  };

  const handleVote = async (comment: Comment, type: 'up' | 'down') => {
    if (!user) {
      alert("لطفاً برای ثبت رای، ابتدا وارد حساب کاربری خود شوید.");
      return;
    }
    
    const currentUid = user.uid || user.id;

    setComments(prevComments => {
      return prevComments.map(c => {
        if (c.id === comment.id) {
          let likes = [...(c.likes || [])];
          let dislikes = [...(c.dislikes || [])];
          
          if (type === 'up') {
            if (likes.includes(currentUid)) {
              likes = likes.filter(id => id !== currentUid);
            } else {
              likes.push(currentUid);
              dislikes = dislikes.filter(id => id !== currentUid);
            }
          } else {
            if (dislikes.includes(currentUid)) {
              dislikes = dislikes.filter(id => id !== currentUid);
            } else {
              dislikes.push(currentUid);
              likes = likes.filter(id => id !== currentUid);
            }
          }
          return { ...c, likes, dislikes };
        }
        return c;
      });
    });

    try {
      await apiClient.reactToComment(comment.id, currentUid, type === 'up' ? 'like' : 'dislike');
    } catch (e) {
      console.error("Error voting:", e);
      fetchComments();
    }
  };

  const renderContentWithSpoiler = (text: string) => {
    if (!text) return null;
    const parts = text.split(/(\[spoiler\][\s\S]*?\[\/spoiler\])/gi);
    return parts.map((part, i) => {
      if (/^\[spoiler\]([\s\S]*?)\[\/spoiler\]$/i.test(part)) {
        const match = part.match(/^\[spoiler\]([\s\S]*?)\[\/spoiler\]$/i);
        const innerText = match ? match[1] : '';
        return <SpoilerText key={i} text={innerText} />;
      }
      return <span key={i}>{part}</span>;
    });
  };

  const renderCommentForm = (parentId?: string, autoFocus: boolean = false) => {
    const isReply = !!parentId;
    const value = isReply ? replyText : newComment;
    const onChange = (val: string) => isReply ? setReplyText(val) : setNewComment(val);
    const textareaId = isReply ? `reply-textarea-${parentId || 'new'}` : 'comment-textarea-main';
    const isSpoilerActive = isReply ? isReplySpoiler : isMainSpoiler;
    const toggleSpoiler = () => {
      if (isReply) setIsReplySpoiler(!isReplySpoiler);
      else setIsMainSpoiler(!isMainSpoiler);
    };

    const userAvatar = profile?.avatarUrl || user?.photoURL;
    const userName = profile?.displayName || user?.displayName || 'کاربر';

    return (
      <form onSubmit={(e) => handleSubmit(e, parentId)} className="mb-6 mt-2" dir="rtl">
        <div className="flex gap-3 sm:gap-4 items-start">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center shrink-0 overflow-hidden border border-white/10 shadow-md">
            {userAvatar ? (
               <img src={userAvatar} alt={userName} className="w-full h-full object-cover" />
            ) : (
              <UserIcon size={18} className="text-zinc-400" />
            )}
          </div>
          <div className="flex-1">
            <div className="relative">
              <textarea
                id={textareaId}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                autoFocus={autoFocus}
                placeholder={isReply ? "پاسخ خود را بنویسید..." : "دیدگاه یا نظر خود را درباره این اثر بنویسید..."}
                className={`w-full bg-[var(--color-asura-card)]/80 border rounded-2xl p-4 text-white text-xs sm:text-sm focus:outline-none transition-all resize-none min-h-[90px] placeholder:text-zinc-500 leading-relaxed ${
                  isSpoilerActive 
                    ? 'border-amber-500/60 ring-2 ring-amber-500/20' 
                    : 'border-[var(--color-asura-border)] focus:border-[var(--color-asura-accent)]/60 focus:ring-2 focus:ring-[var(--color-asura-accent)]/20'
                }`}
                dir="auto"
              />
            </div>
            
            <div className="flex flex-wrap justify-between mt-2.5 gap-2 items-center">
              <button 
                type="button" 
                onClick={toggleSpoiler}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all flex items-center gap-1.5 ${
                  isSpoilerActive 
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-md' 
                    : 'bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white border-white/5'
                }`}
              >
                <AlertTriangle size={13} className={isSpoilerActive ? 'text-amber-400' : 'text-zinc-500'} />
                <span>{isSpoilerActive ? 'علامت اسپویلر (فعال)' : 'اسپویلر'}</span>
              </button>

              <div className="flex items-center gap-2">
                {isReply && (
                  <button
                    type="button"
                    onClick={() => { setReplyingTo(null); setReplyText(''); setIsReplySpoiler(false); }}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 text-zinc-300 rounded-xl font-bold text-xs transition-colors"
                  >
                    انصراف
                  </button>
                )}
                <button
                  type="submit"
                  disabled={!value.trim() || isSubmitting}
                  className="px-5 py-2 bg-[var(--color-asura-accent)] hover:bg-[var(--color-asura-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-black text-xs transition-all shadow-lg flex items-center gap-1.5"
                >
                  <Send size={13} className="shrink-0" />
                  <span>{isSubmitting ? 'در حال ارسال...' : isReply ? 'ارسال پاسخ' : 'ثبت دیدگاه'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>
    );
  };

  const topLevelComments = comments
    .filter(c => !c.parentId)
    .sort((a, b) => {
      const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
      const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
      return timeB - timeA;
    });

  return (
    <div className="mt-8" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6 border-b border-white/10 pb-4">
        <h3 className="text-lg sm:text-xl font-black text-white flex items-center gap-2.5">
          <span className="w-2 h-6 bg-[var(--color-asura-accent)] rounded-full shadow-[0_0_12px_var(--color-asura-accent)]"></span>
          <span>نظرات و دیدگاه‌های کاربران</span>
          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-white/5 text-[var(--color-asura-accent-light)] border border-white/10">
            {comments.length}
          </span>
        </h3>
      </div>

      {/* Notice Banner */}
      {pendingNotice && (
        <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center gap-3 text-amber-300 text-xs font-bold animate-fadeIn">
          <AlertTriangle size={18} className="shrink-0 text-amber-400" />
          <span className="leading-relaxed">{pendingNotice}</span>
        </div>
      )}

      {/* Main Form or Auth Prompt */}
      {user ? (
        !replyingTo && renderCommentForm()
      ) : (
        <div className="bg-[var(--color-asura-card)]/80 border border-white/10 rounded-2xl p-6 text-center mb-8 flex flex-col items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-zinc-400 mb-1">
            <LogIn size={22} className="text-[var(--color-asura-accent)]" />
          </div>
          <p className="text-zinc-300 text-sm font-bold">برای ارسال دیدگاه یا شرکت در گفتگو، لطفاً وارد حساب خود شوید.</p>
          <button
            onClick={() => {
              const loginBtn = document.querySelector('[data-auth-trigger="login"]') as HTMLButtonElement;
              if (loginBtn) {
                loginBtn.click();
              } else {
                window.location.href = '/login';
              }
            }}
            className="mt-1 px-6 py-2.5 bg-[var(--color-asura-accent)] hover:bg-[var(--color-asura-accent-hover)] text-white font-black text-xs rounded-xl transition-all shadow-lg flex items-center gap-2"
          >
            <LogIn size={15} />
            <span>ورود / ثبت‌نام سریع</span>
          </button>
        </div>
      )}

      {/* Comments Feed */}
      <div className="space-y-4">
        {topLevelComments.map((comment) => {
          const replies = comments
            .filter(c => c.parentId === comment.id)
            .sort((a, b) => {
              const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
              const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
              return timeA - timeB;
            });

          const isPending = comment.status === 'pending';
          const isRejected = comment.status === 'rejected';
          const currentUid = user?.uid || user?.id;
          const isAuthor = currentUid && currentUid === comment.authorId;
          const canDelete = isAdmin || isAuthor;

          return (
            <div key={comment.id} className="flex gap-3 sm:gap-4 items-start">
              {/* Avatar */}
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center shrink-0 overflow-hidden border border-white/10 shadow-md">
                {comment.authorProfile?.avatarUrl ? (
                  <img src={comment.authorProfile.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <UserIcon size={18} className="text-zinc-400" />
                )}
              </div>

              {/* Body */}
              <div className={`flex-1 border rounded-2xl p-4 sm:p-5 relative transition-all duration-200 ${
                comment.isPinned
                  ? 'bg-amber-500/[0.04] border-amber-500/40 shadow-sm shadow-amber-500/5 ring-1 ring-amber-500/20'
                  : isPending 
                  ? 'bg-amber-500/5 border-amber-500/30' 
                  : isRejected
                  ? 'bg-red-500/5 border-red-500/30'
                  : 'bg-white/[0.03] hover:bg-white/[0.05] border-white/5'
              }`}>
                {/* Top Info */}
                <div className="flex justify-between items-center mb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-white text-xs sm:text-sm">
                      {comment.authorProfile?.displayName || 'کاربر مانگا'}
                    </span>
                    
                    {comment.createdAt?.toDate && (
                      <span className="text-[11px] text-zinc-500 flex items-center gap-1 font-medium">
                        <Clock size={11} className="text-zinc-600" />
                        {formatDistanceToNow(comment.createdAt.toDate(), { addSuffix: true, locale: faIR })}
                      </span>
                    )}

                    {comment.isPinned && (
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1 shadow-sm">
                        <Pin size={11} className="fill-amber-400 text-amber-400" />
                        سنجاق شده
                      </span>
                    )}

                    {isPending && (
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                        ⏳ در انتظار تایید مدیریت
                      </span>
                    )}

                    {isRejected && (
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-lg bg-red-500/20 text-red-300 border border-red-500/40 flex items-center gap-1">
                        ❌ رد شده توسط مدیریت
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {isAdmin && (
                      <button 
                        onClick={() => handleTogglePin(comment.id)}
                        className={`p-1.5 rounded-lg transition-all ${
                          comment.isPinned 
                            ? 'text-amber-400 bg-amber-500/20 hover:bg-amber-500/30' 
                            : 'text-zinc-500 hover:text-amber-400 hover:bg-amber-500/10'
                        }`}
                        title={comment.isPinned ? "برداشتن سنجاق" : "سنجاق کردن دیدگاه"}
                      >
                        <Pin size={15} className={comment.isPinned ? "fill-amber-400" : ""} />
                      </button>
                    )}

                    {canDelete && (
                      <button 
                        onClick={() => handleDelete(comment.id)}
                        className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                        title="حذف دیدگاه"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="text-zinc-300 text-xs sm:text-sm whitespace-pre-wrap leading-relaxed mb-3.5" dir="auto">
                  {renderContentWithSpoiler(comment.content)}
                </div>
                
                {/* Actions */}
                <div className="flex items-center gap-4 pt-3 border-t border-white/5 text-xs">
                  <button 
                    onClick={() => handleVote(comment, 'up')} 
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold transition-all ${
                      comment.likes?.includes(currentUid || '') 
                        ? 'bg-[var(--color-asura-accent)]/20 text-[var(--color-asura-accent-light)] border border-[var(--color-asura-accent)]/40 shadow-sm' 
                        : 'text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    <ThumbsUp size={13} /> 
                    <span>{comment.likes?.length || 0}</span>
                  </button>

                  <button 
                    onClick={() => handleVote(comment, 'down')} 
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold transition-all ${
                      comment.dislikes?.includes(currentUid || '') 
                        ? 'bg-red-500/20 text-red-400 border border-red-500/40 shadow-sm' 
                        : 'text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    <ThumbsDown size={13} /> 
                    <span>{comment.dislikes?.length || 0}</span>
                  </button>

                  {user && (
                    <button 
                      onClick={() => {
                        setReplyingTo(replyingTo === comment.id ? null : comment.id);
                        setReplyText('');
                        setIsReplySpoiler(false);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-lg font-bold text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 transition-all mr-auto"
                    >
                      <CornerDownLeft size={13} /> 
                      <span>پاسخ</span>
                    </button>
                  )}
                </div>

                {/* Reply Form */}
                {replyingTo === comment.id && (
                  <div className="mt-4 pt-4 border-t border-white/10">
                    {renderCommentForm(comment.id, true)}
                  </div>
                )}

                {/* Nested Replies */}
                {replies.length > 0 && (
                  <div className="mt-4 space-y-3 pt-3 border-t border-white/5 pr-3 sm:pr-4 border-r-2 border-[var(--color-asura-accent)]/40">
                    {replies.map(reply => {
                      const isReplyPending = reply.status === 'pending';
                      const isReplyRejected = reply.status === 'rejected';
                      const canDeleteReply = isAdmin || (currentUid && currentUid === reply.authorId);

                      return (
                        <div key={reply.id} className="flex gap-2.5 sm:gap-3 items-start">
                          <div className="w-8 h-8 rounded-xl bg-zinc-800 flex items-center justify-center shrink-0 overflow-hidden border border-white/10 shadow-sm">
                            {reply.authorProfile?.avatarUrl ? (
                              <img src={reply.authorProfile.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                              <UserIcon size={14} className="text-zinc-400" />
                            )}
                          </div>
                          <div className={`flex-1 rounded-xl p-3 sm:p-3.5 relative border ${
                            isReplyPending 
                              ? 'bg-amber-500/5 border-amber-500/30' 
                              : isReplyRejected
                              ? 'bg-red-500/5 border-red-500/30'
                              : 'bg-black/30 border-white/5'
                          }`}>
                            <div className="flex justify-between items-center mb-1.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-bold text-white text-xs">
                                  {reply.authorProfile?.displayName || 'کاربر مانگا'}
                                </span>
                                {reply.createdAt?.toDate && (
                                  <span className="text-[10px] text-zinc-500">
                                    {formatDistanceToNow(reply.createdAt.toDate(), { addSuffix: true, locale: faIR })}
                                  </span>
                                )}
                                {isReplyPending && (
                                  <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                    ⏳ در انتظار تایید
                                  </span>
                                )}
                                {isReplyRejected && (
                                  <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-red-500/20 text-red-300 border border-red-500/40">
                                    ❌ رد شده
                                  </span>
                                )}
                              </div>
                              {canDeleteReply && (
                                <button 
                                  onClick={() => handleDelete(reply.id)}
                                  className="p-1 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-all"
                                  title="حذف پاسخ"
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                            
                            <div className="text-zinc-300 text-xs whitespace-pre-wrap leading-relaxed mb-2" dir="auto">
                              {renderContentWithSpoiler(reply.content)}
                            </div>
                            
                            <div className="flex items-center gap-3 pt-2 border-t border-white/5 text-[11px]">
                              <button 
                                onClick={() => handleVote(reply, 'up')} 
                                className={`flex items-center gap-1 font-bold ${
                                  reply.likes?.includes(currentUid || '') ? 'text-[var(--color-asura-accent)]' : 'text-zinc-500 hover:text-white'
                                } transition-colors`}
                              >
                                <ThumbsUp size={12} /> {reply.likes?.length || 0}
                              </button>
                              <button 
                                onClick={() => handleVote(reply, 'down')} 
                                className={`flex items-center gap-1 font-bold ${
                                  reply.dislikes?.includes(currentUid || '') ? 'text-red-400' : 'text-zinc-500 hover:text-white'
                                } transition-colors`}
                              >
                                <ThumbsDown size={12} /> {reply.dislikes?.length || 0}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {comments.length === 0 && (
          <div className="text-center text-zinc-500 py-12 bg-white/[0.02] border border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center gap-2">
            <MessageSquare size={32} className="text-zinc-600 mb-1 opacity-50" />
            <p className="text-xs font-bold text-zinc-400">هنوز دیدگاهی برای این بخش ثبت نشده است.</p>
            <p className="text-[11px] text-zinc-600">اولین نفری باشید که نظر خود را به اشتراک می‌گذارد!</p>
          </div>
        )}
      </div>
    </div>
  );
}
