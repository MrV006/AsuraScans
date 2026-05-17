import React, { useState, useEffect } from 'react';
import { collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { Trash2, User as UserIcon } from 'lucide-react';

interface Comment {
  id: string;
  seriesId: string;
  chapterId?: string;
  authorId: string;
  content: string;
  createdAt: any;
  updatedAt: any;
  authorProfile?: {
    displayName: string;
    avatarUrl: string;
  };
}

export function Comments({ seriesId, chapterId }: { seriesId: string, chapterId?: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const { user, profile } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Check if user is admin (using mock logic for frontend display, real security is in rules)
    // Normally we'd fetch from admins collection, we'll assume basic mock here if email ends in specific domain or just basic boolean
    if (user?.email === "admin@example.com") setIsAdmin(true);

    const q = query(
      collection(db, 'comments'),
      where('seriesId', '==', seriesId),
      where('chapterId', '==', chapterId || ''),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const commentsData: Comment[] = [];
      snapshot.forEach((doc) => {
        commentsData.push({ id: doc.id, ...doc.data() } as Comment);
      });
      // In a real app we would join with users collection, but for now we'll just display authorId or mock displayName
      setComments(commentsData);
    });

    return () => unsubscribe();
  }, [seriesId, chapterId, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newComment.trim()) return;

    try {
      await addDoc(collection(db, 'comments'), {
        seriesId,
        chapterId: chapterId || '',
        authorId: user.uid,
        content: newComment.trim(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        authorProfile: {
          displayName: profile?.displayName || 'User',
          avatarUrl: profile?.avatarUrl || ''
        }
      });
      setNewComment('');
    } catch (error) {
      console.error("Error adding comment:", error);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!window.confirm("Are you sure you want to delete this comment?")) return;
    try {
      await deleteDoc(doc(db, 'comments', commentId));
    } catch (error) {
      console.error("Error deleting comment:", error);
    }
  };

  return (
    <div className="mt-8">
      <h3 className="text-xl font-black text-white uppercase tracking-tighter flex items-center gap-2 mb-6">
        <span className="w-1.5 h-6 bg-[var(--color-asura-accent)] rounded-full"></span>
        Discussion {comments.length > 0 && `(${comments.length})`}
      </h3>

      {user ? (
        <form onSubmit={handleSubmit} className="mb-8">
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
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="What are your thoughts?"
                className="w-full bg-[var(--color-asura-card)] border border-[var(--color-asura-border)] rounded-xl p-4 text-white focus:outline-none focus:border-[var(--color-asura-accent)]/50 transition-colors resize-none h-24"
              />
              <div className="flex justify-end mt-2">
                <button
                  type="submit"
                  disabled={!newComment.trim()}
                  className="px-6 py-2 bg-[var(--color-asura-accent)] hover:bg-[var(--color-asura-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-bold text-sm uppercase transition-colors shadow-lg"
                >
                  Post Comment
                </button>
              </div>
            </div>
          </div>
        </form>
      ) : (
        <div className="bg-[var(--color-asura-card)] border border-[var(--color-asura-border)] rounded-xl p-6 text-center mb-8">
          <p className="text-zinc-400 mb-4">Please log in to join the discussion.</p>
        </div>
      )}

      <div className="space-y-6">
        {comments.map((comment) => (
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
                {user && user.uid !== comment.authorId && (
                  <button 
                    onClick={async () => {
                      const reason = window.prompt("Why are you reporting this comment? (e.g. Spam, Offensive)");
                      if (!reason || !reason.trim()) return;
                      try {
                        const { addDoc, collection, serverTimestamp } = await import('firebase/firestore');
                        await addDoc(collection(db, 'reports'), {
                          type: 'comment',
                          commentId: comment.id,
                          commentContent: comment.content,
                          seriesId,
                          reason: reason.trim(),
                          reporterId: user.uid,
                          reportedUserId: comment.authorId,
                          status: 'pending',
                          createdAt: serverTimestamp(),
                        });
                        alert('Comment reported successfully.');
                      } catch (e: any) {
                        alert('Failed to report: ' + e.message);
                      }
                    }}
                    className="text-zinc-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 ml-2"
                    title="Report Comment"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/></svg>
                  </button>
                )}
              </div>
              <p className="text-zinc-300 text-sm whitespace-pre-wrap leading-relaxed">{comment.content}</p>
            </div>
          </div>
        ))}
        {comments.length === 0 && (
          <div className="text-center text-zinc-500 py-8">
            Be the first to share your thoughts!
          </div>
        )}
      </div>
    </div>
  );
}
