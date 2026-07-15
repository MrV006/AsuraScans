import React, { useState, useEffect } from 'react';
import { apiClient, getSocketInstance } from '../lib/apiClient';
import { useAuth } from '../contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { Trash2, User as UserIcon, ThumbsUp, ThumbsDown, MessageSquare, AlertTriangle } from 'lucide-react';

interface Comment {
  id: string;
  seriesId: string;
  chapterId?: string;
  parentId?: string;
  authorId: string;
  content: string;
  createdAt: any;
  updatedAt: any;
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
      className={`relative inline-block cursor-pointer px-1.5 py-0.5 rounded transition-all duration-300 ${
        revealed 
          ? 'bg-zinc-800 text-zinc-100 blur-none' 
          : 'bg-zinc-700/50 text-zinc-400 blur-[5px] select-none hover:bg-zinc-600/50'
      }`}
      title={revealed ? "برای مخفی کردن کلیک کنید" : "برای مشاهده اسپویلر کلیک کنید"}
    >
      {text}
    </span>
  );
}

export function Comments({ seriesId, chapterId }: { seriesId: string, chapterId?: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyText, setReplyText] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const { user, profile, setShowSetupModal } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);

  const fetchComments = async () => {
    try {
      const data = await apiClient.getComments(chapterId || 'general');
      // Adapt comments data
      const mappedComments: Comment[] = data.map((c: any) => ({
        id: c.id,
        seriesId,
        chapterId: c.chapterId,
        parentId: c.parentId || '',
        authorId: c.userId,
        content: c.content,
        createdAt: c.createdAt ? { toDate: () => new Date(c.createdAt) } : null,
        likes: c.likes || [],
        dislikes: c.dislikes || [],
        authorProfile: {
          displayName: c.userName || 'User',
          avatarUrl: c.userAvatar || ''
        }
      }));
      setComments(mappedComments);
    } catch (e) {
      console.error("Error fetching comments via API", e);
    }
  };

  useEffect(() => {
    if (user?.email === "amirrezaveisi45@gmail.com" || user?.email === "Mr.V@admin.com") {
      setIsAdmin(true);
    }

    fetchComments();

    const socket = getSocketInstance();
    const handleUpdate = (data: any) => {
      if (data.chapterId === (chapterId || 'general')) {
        fetchComments();
      }
    };

    socket.on("comments:updated", handleUpdate);

    return () => {
      socket.off("comments:updated", handleUpdate);
    };
  }, [seriesId, chapterId, user]);

  const handleSubmit = async (e: React.FormEvent, parentId?: string) => {
    e.preventDefault();
    if (!user) return;
    const isReply = !!parentId;
    const content = isReply ? replyText.trim() : newComment.trim();
    if (!content) return;

    try {
      const randomId = 'comment_' + Math.random().toString(36).substr(2, 9);
      await apiClient.addComment(chapterId || 'general', {
        id: randomId,
        userId: user.uid,
        userName: profile?.displayName || 'User',
        userAvatar: profile?.avatarUrl || '',
        content: content,
        parentId: parentId
      });
      if (isReply) {
        setReplyText('');
        setReplyingTo(null);
      } else {
        setNewComment('');
      }
    } catch (error) {
      console.error("Error adding comment:", error);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!window.confirm("Are you sure you want to delete this comment?")) return;
    try {
      await apiClient.deleteComment(commentId);
    } catch (error) {
      console.error("Error deleting comment:", error);
    }
  };

  const handleVote = async (comment: Comment, type: 'up' | 'down') => {
    if (!user) return alert("Log in to vote!");
    
    // Optimistic Update
    setComments(prevComments => {
      return prevComments.map(c => {
        if (c.id === comment.id) {
          let likes = [...(c.likes || [])];
          let dislikes = [...(c.dislikes || [])];
          
          if (type === 'up') {
            if (likes.includes(user.uid)) {
              likes = likes.filter(id => id !== user.uid);
            } else {
              likes.push(user.uid);
              dislikes = dislikes.filter(id => id !== user.uid);
            }
          } else {
            if (dislikes.includes(user.uid)) {
              dislikes = dislikes.filter(id => id !== user.uid);
            } else {
              dislikes.push(user.uid);
              likes = likes.filter(id => id !== user.uid);
            }
          }
          return { ...c, likes, dislikes };
        }
        return c;
      });
    });

    try {
      await apiClient.reactToComment(comment.id, user.uid, type === 'up' ? 'like' : 'dislike');
    } catch (e) {
      console.error("Error voting:", e);
      fetchComments();
    }
  };

  const renderContentWithSpoiler = (text: string) => {
    if (!text) return null;
    const parts = text.split(/(\[spoiler\].*?\[\/spoiler\])/gsi);
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
    const insertSpoilerForForm = () => {
      if (isReply) {
        setReplyText(prev => prev + "[spoiler]متن مخفی[/spoiler]");
      } else {
        setNewComment(prev => prev + "[spoiler]متن مخفی[/spoiler]");
      }
    };

    return (
      <form onSubmit={(e) => handleSubmit(e, parentId)} className="mb-8 mt-2">
        <div className="flex gap-4">
          <div className="w-10 h-10 rounded-full bg-[var(--color-asura-accent)] flex items-center justify-center shrink-0 overflow-hidden border border-[var(--color-asura-border)]">
            {profile?.avatarUrl ? (
               <img src={profile.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <UserIcon size={20} className="text-white" />
            )}
          </div>
          <div className="flex-1">
            <textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              autoFocus={autoFocus}
              placeholder={isReply ? "پاسخ خود را بنویسید..." : "دیدگاه خود را بنویسید..."}
              className="w-full bg-[var(--color-asura-card)] border border-[var(--color-asura-border)] rounded-xl p-4 text-white focus:outline-none focus:border-[var(--color-asura-accent)]/50 transition-colors resize-none h-24 text-right"
              dir="rtl"
            />
            <div className="flex flex-wrap justify-between mt-2 gap-2">
              <button 
                type="button" 
                onClick={insertSpoilerForForm}
                className="px-3 py-1 bg-white/5 hover:bg-white/10 text-zinc-400 text-xs font-bold uppercase rounded-lg border border-white/10 transition-colors text-right"
              >
                + Spoiler Tag
              </button>
              <div className="flex gap-2">
                {isReply && (
                  <button
                    type="button"
                    onClick={() => { setReplyingTo(null); setReplyText(''); }}
                    className="px-6 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg font-bold text-sm uppercase transition-colors"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  disabled={!value.trim()}
                  className="px-6 py-2 bg-[var(--color-asura-accent)] hover:bg-[var(--color-asura-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-bold text-sm uppercase transition-colors shadow-lg"
                >
                  {isReply ? 'Reply' : 'Post Comment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>
    );
  };

  const topLevelComments = comments.filter(c => !c.parentId).sort((a, b) => b.createdAt?.toDate?.()?.getTime() - a.createdAt?.toDate?.()?.getTime());

  return (
    <div className="mt-8">
      <h3 className="text-xl font-black text-white uppercase tracking-tighter flex items-center gap-2 mb-6">
        <span className="w-1.5 h-6 bg-[var(--color-asura-accent)] rounded-full"></span>
        Discussion {comments.length > 0 && `(${comments.length})`}
      </h3>

      {user ? (
        profile?.hasCompletedSetup ? (
          !replyingTo && renderCommentForm()
        ) : (
          <div className="bg-[var(--color-asura-card)] border border-[var(--color-asura-border)] rounded-2xl p-6 text-center mb-8 flex flex-col items-center gap-3" dir="rtl">
            <p className="text-zinc-300 text-sm font-bold">برای ارسال دیدگاه، ابتدا باید اطلاعات حساب کاربری خود را تکمیل کنید.</p>
            <button
              onClick={() => setShowSetupModal(true)}
              className="py-2.5 px-6 bg-[var(--color-asura-accent)] hover:bg-[var(--color-asura-accent-hover)] text-white font-black text-xs rounded-xl transition-all shadow-lg"
            >
              تکمیل اطلاعات حساب کاربری
            </button>
          </div>
        )
      ) : (
        <div className="bg-[var(--color-asura-card)] border border-[var(--color-asura-border)] rounded-xl p-6 text-center mb-8">
          <p className="text-zinc-400 mb-4">Please log in to join the discussion.</p>
        </div>
      )}

      <div className="space-y-6">
        {topLevelComments.map((comment) => {
          const replies = comments.filter(c => c.parentId === comment.id);
          return (
            <div key={comment.id} className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-[var(--color-asura-dark)] flex items-center justify-center shrink-0 overflow-hidden border border-white/5">
                 {comment.authorProfile?.avatarUrl ? (
                   <img src={comment.authorProfile.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                 ) : (
                   <UserIcon size={20} className="text-zinc-500" />
                 )}
              </div>
              <div className="flex-1 bg-white/5 border border-white/5 rounded-2xl p-4 relative group">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">
                      {comment.authorProfile?.displayName || 'Anonymous User'}
                    </span>
                    <span className="text-[10px] text-zinc-500">
                      {comment.createdAt?.toDate ? formatDistanceToNow(comment.createdAt.toDate(), { addSuffix: true }) : 'Just now'}
                    </span>
                  </div>
                  {(isAdmin || user?.uid === comment.authorId) && (
                    <button 
                      onClick={() => handleDelete(comment.id)}
                      className="text-zinc-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                      title="Delete Comment"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
                <p className="text-zinc-300 text-sm whitespace-pre-wrap leading-relaxed mb-4">
                  {renderContentWithSpoiler(comment.content)}
                </p>
                
                <div className="flex items-center gap-4 mt-2 pt-3 border-t border-white/5">
                   <button onClick={() => handleVote(comment, 'up')} className={`flex items-center gap-1 text-xs font-bold ${comment.likes?.includes(user?.uid || '') ? 'text-[var(--color-asura-accent)]' : 'text-zinc-500 hover:text-white'} transition-colors`}>
                     <ThumbsUp size={14} /> {comment.likes?.length || 0}
                   </button>
                   <button onClick={() => handleVote(comment, 'down')} className={`flex items-center gap-1 text-xs font-bold ${comment.dislikes?.includes(user?.uid || '') ? 'text-red-500' : 'text-zinc-500 hover:text-white'} transition-colors`}>
                     <ThumbsDown size={14} /> {comment.dislikes?.length || 0}
                   </button>
                   {user && (
                     <button 
                       onClick={() => {
                         if (profile?.hasCompletedSetup) {
                           setReplyingTo(comment.id);
                         } else {
                           setShowSetupModal(true);
                         }
                       }} 
                       className="flex items-center gap-1 text-xs font-bold text-zinc-500 hover:text-white transition-colors ml-auto"
                     >
                       <MessageSquare size={14} /> Reply
                     </button>
                   )}
                </div>

                {replyingTo === comment.id && (
                  <div className="mt-4 pt-4 border-t border-white/5">
                    {renderCommentForm(comment.id, true)}
                  </div>
                )}

                {replies.length > 0 && (
                  <div className="mt-4 space-y-4 pt-4 border-t border-white/5 pl-4 ml-2 border-l-2 border-white/10">
                     {replies.map(reply => (
                        <div key={reply.id} className="flex gap-3">
                           <div className="w-8 h-8 rounded-full bg-black/40 flex items-center justify-center shrink-0 overflow-hidden border border-white/5">
                             {reply.authorProfile?.avatarUrl ? (
                               <img src={reply.authorProfile.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                             ) : (
                               <UserIcon size={16} className="text-zinc-500" />
                             )}
                           </div>
                           <div className="flex-1 bg-black/20 rounded-xl p-3 relative group">
                              <div className="flex justify-between items-center mb-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-white text-xs">
                                    {reply.authorProfile?.displayName || 'Anonymous User'}
                                  </span>
                                  <span className="text-[9px] text-zinc-500">
                                    {reply.createdAt?.toDate ? formatDistanceToNow(reply.createdAt.toDate(), { addSuffix: true }) : 'Just now'}
                                  </span>
                                </div>
                                {(isAdmin || user?.uid === reply.authorId) && (
                                  <button 
                                    onClick={() => handleDelete(reply.id)}
                                    className="text-zinc-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 p-1"
                                    title="Delete Reply"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                )}
                              </div>
                              <p className="text-zinc-400 text-xs whitespace-pre-wrap leading-relaxed">
                                {renderContentWithSpoiler(reply.content)}
                              </p>
                              
                              <div className="flex items-center gap-3 mt-2 pt-2 border-t border-white/5">
                                 <button onClick={() => handleVote(reply, 'up')} className={`flex items-center gap-1 text-[10px] font-bold ${reply.likes?.includes(user?.uid || '') ? 'text-[var(--color-asura-accent)]' : 'text-zinc-500 hover:text-white'} transition-colors`}>
                                   <ThumbsUp size={12} /> {reply.likes?.length || 0}
                                 </button>
                                 <button onClick={() => handleVote(reply, 'down')} className={`flex items-center gap-1 text-[10px] font-bold ${reply.dislikes?.includes(user?.uid || '') ? 'text-red-500' : 'text-zinc-500 hover:text-white'} transition-colors`}>
                                   <ThumbsDown size={12} /> {reply.dislikes?.length || 0}
                                 </button>
                              </div>
                           </div>
                        </div>
                     ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {comments.length === 0 && (
          <div className="text-center text-zinc-500 py-8">
            Be the first to share your thoughts!
          </div>
        )}
      </div>
    </div>
  );
}
