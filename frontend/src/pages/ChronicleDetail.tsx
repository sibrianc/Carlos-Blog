import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { api } from '../lib/api';
import { useAppSession, getApiErrorMessage } from '../context/AppSessionContext';
import type { ChronicleDetail as ChronicleDetailType } from '../types';
import { RichTextEditor } from '../components/RichTextEditor';

export function ChronicleDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { authenticated, csrfToken, user } = useAppSession();
  const [chronicle, setChronicle] = useState<ChronicleDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newComment, setNewComment] = useState('');
  const [commentError, setCommentError] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  useEffect(() => {
    if (!id) {
      navigate('/chronicles', { replace: true });
      return;
    }

    let active = true;

    const loadChronicle = async () => {
      try {
        const payload = await api.fetchChronicle(id);
        if (!active) {
          return;
        }
        setChronicle(payload.chronicle);
        setError('');
      } catch (err) {
        if (!active) {
          return;
        }
        setError(getApiErrorMessage(err));
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadChronicle();

    return () => {
      active = false;
    };
  }, [id, navigate]);

  const reloadChronicle = async () => {
    if (!id) {
      return;
    }

    const payload = await api.fetchChronicle(id);
    setChronicle(payload.chronicle);
  };

  const handleAddComment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!id) {
      return;
    }

    if (!authenticated) {
      navigate('/login');
      return;
    }

    setCommentSubmitting(true);
    setCommentError('');

    try {
      await api.createComment(id, newComment, csrfToken);
      setNewComment('');
      await reloadChronicle();
    } catch (err) {
      setCommentError(getApiErrorMessage(err));
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!id || !chronicle) {
      return;
    }

    const confirmed = window.confirm(`Delete "${chronicle.title}"? This cannot be undone.`);
    if (!confirmed) {
      return;
    }

    setDeleteSubmitting(true);
    setError('');

    try {
      await api.deleteFragment(id, csrfToken);
      navigate('/chronicles', { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setDeleteSubmitting(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center min-h-[50vh]"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div></div>;
  }

  if (error && !chronicle) {
    return (
      <div className="container mx-auto px-6 md:px-8 max-w-4xl text-center py-24">
        <p className="font-body text-red-300 font-light italic">{error}</p>
      </div>
    );
  }

  if (!chronicle) {
    return null;
  }

  const canManage = Boolean(user?.isAdmin && chronicle.canEdit);

  return (
    <div className="container mx-auto px-6 md:px-8 max-w-4xl">
      <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={() => navigate(-1)} className="flex items-center gap-2 text-secondary hover:text-primary transition-colors mb-8 font-label text-xs uppercase tracking-widest" type="button">
        <span className="material-symbols-outlined text-sm">arrow_back</span>
        Return
      </motion.button>

      {error && <div className="mb-8 p-4 bg-red-900/50 border border-red-500 text-red-200 rounded-sm">{error}</div>}

      <motion.article initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-12">
        <div className="space-y-6">
          <span className="font-label text-secondary text-[10px] uppercase tracking-[0.4em]">Chronicle #{chronicle.id.slice(0, 5)}</span>
          <h1 className="font-headline text-5xl md:text-6xl italic text-glow text-primary">{chronicle.title}</h1>
          <div className="flex items-center gap-4 text-on-surface-variant text-sm font-light flex-wrap">
            <span>Inscribed by {chronicle.authorName}</span>
            <span className="hidden sm:inline">*</span>
            <span>{chronicle.publishedLabel}</span>
          </div>
        </div>

        {chronicle.imageSrc && (
          <div className="w-full aspect-video rounded-sm overflow-hidden border border-primary/20 relative group">
            <div className="absolute inset-0 bg-primary/20 mix-blend-overlay z-10 pointer-events-none"></div>
            <img src={chronicle.imageSrc} alt={chronicle.imageAlt} className="w-full h-full object-cover filter sepia-[0.3] hue-rotate-180" />
          </div>
        )}

        <div className="space-y-8">
          <p className="text-xl italic text-on-surface border-l-2 border-secondary pl-6">{chronicle.description}</p>
          <div className="article-content text-on-surface-variant font-light leading-relaxed" dangerouslySetInnerHTML={{ __html: chronicle.bodyHtml }} />
        </div>

        {canManage && (
          <div className="flex flex-wrap gap-4">
            <button type="button" onClick={() => navigate(`/create-fragment/${chronicle.id}/edit`)} className="px-6 py-3 bg-primary-container/50 hover:bg-primary-container text-primary font-label text-xs uppercase tracking-[0.2em] rounded-md transition-all duration-300 border border-primary/20">Edit Chronicle</button>
            <button type="button" onClick={() => void handleDelete()} disabled={deleteSubmitting} className="px-6 py-3 bg-red-900/20 hover:bg-red-900/40 text-red-300 font-label text-xs uppercase tracking-[0.2em] rounded-md transition-all duration-300 border border-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed">{deleteSubmitting ? 'Deleting...' : 'Delete Chronicle'}</button>
          </div>
        )}
      </motion.article>

      <div className="mt-24 border-t border-primary/20 pt-12">
        <h3 className="font-headline text-3xl italic text-secondary mb-8">Echoes in the Void</h3>
        <div className="space-y-8 mb-12">
          {chronicle.comments.length === 0 ? (
            <p className="text-on-surface-variant font-light italic">No echoes yet. Be the first to speak.</p>
          ) : (
            chronicle.comments.map((comment) => (
              <div key={comment.id} className="flex gap-4 bg-surface-container-low/30 p-6 rounded-sm border border-white/5">
                <img src={comment.avatarUrl} alt={comment.authorName} className="w-10 h-10 rounded-full border border-primary/30 shrink-0" />
                <div className="space-y-2 min-w-0">
                  <div className="flex items-baseline gap-3 flex-wrap">
                    <span className="font-label text-xs uppercase tracking-widest text-primary">{comment.authorName}</span>
                    {comment.timestampLabel && <span className="text-[10px] text-on-surface-variant">{comment.timestampLabel}</span>}
                  </div>
                  <div className="article-content text-sm text-on-surface-variant font-light" dangerouslySetInnerHTML={{ __html: comment.textHtml }} />
                </div>
              </div>
            ))
          )}
        </div>

        {authenticated ? (
          <form onSubmit={handleAddComment} className="space-y-4">
            {commentError && <div className="p-4 bg-red-900/50 border border-red-500 text-red-200 rounded-sm">{commentError}</div>}
            <RichTextEditor value={newComment} onChange={setNewComment} placeholder="Leave an echo..." height={180} />
            <button type="submit" disabled={commentSubmitting} className="px-8 py-3 bg-primary-container/50 hover:bg-primary-container text-primary font-label text-xs uppercase tracking-[0.2em] rounded-md transition-all duration-300 border border-primary/20 disabled:opacity-50 disabled:cursor-not-allowed">{commentSubmitting ? 'Adding Echo...' : 'Add Echo'}</button>
          </form>
        ) : (
          <div className="p-6 border border-secondary/30 bg-secondary/5 rounded-sm text-center">
            <p className="font-body text-on-surface-variant mb-4">You must be logged in to leave an echo.</p>
            <button type="button" onClick={() => navigate('/login')} className="px-8 py-3 bg-primary-container/50 hover:bg-primary-container text-primary font-label text-xs uppercase tracking-[0.2em] rounded-md transition-all duration-300 border border-primary/20">Enter the Void</button>
          </div>
        )}
      </div>
    </div>
  );
}
