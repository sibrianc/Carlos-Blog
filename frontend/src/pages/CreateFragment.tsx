import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppSession, getApiErrorMessage } from '../context/AppSessionContext';
import { api, imageUploadsEnabled } from '../lib/api';
import { RichTextEditor } from '../components/RichTextEditor';

const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=800&auto=format&fit=crop';

export function CreateFragment() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);
  const redirectPath = useMemo(() => (id ? `/create-fragment/${id}/edit` : '/create-fragment'), [id]);
  const { authenticated, csrfToken, loading: sessionLoading, user } = useAppSession();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loreText, setLoreText] = useState('');
  const [imageSrc, setImageSrc] = useState('');
  const [imageAlt, setImageAlt] = useState('');
  const [loading, setLoading] = useState(isEditing);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState('');
  const [uploadError, setUploadError] = useState('');

  useEffect(() => {
    if (sessionLoading) {
      return;
    }

    if (!authenticated) {
      navigate(`/login?next=${encodeURIComponent(redirectPath)}`, { replace: true });
      return;
    }

    if (!user?.isAdmin) {
      navigate('/', { replace: true });
    }
  }, [authenticated, navigate, redirectPath, sessionLoading, user]);

  useEffect(() => {
    if (!id || !authenticated || !user?.isAdmin) {
      if (!id) {
        setLoading(false);
      }
      return;
    }

    let active = true;

    const loadFragment = async () => {
      try {
        const payload = await api.fetchFragment(id);
        if (!active) {
          return;
        }
        const { chronicle } = payload;
        setTitle(chronicle.title);
        setDescription(chronicle.description);
        setLoreText(chronicle.bodyHtml);
        setImageSrc(chronicle.imageSrc);
        setImageAlt(chronicle.imageAlt);
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

    void loadFragment();

    return () => {
      active = false;
    };
  }, [authenticated, id, user]);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setUploadError('');
    setUploadingImage(true);

    try {
      const result = await api.uploadImage(file);
      setImageSrc(result.imageUrl);
      setImageAlt((current) => current.trim() || result.imageAlt);
    } catch (err) {
      setUploadError(getApiErrorMessage(err));
    } finally {
      setUploadingImage(false);
      event.target.value = '';
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!user?.isAdmin) {
      setError('Only the admin can inscribe or edit fragments.');
      return;
    }

    setSubmitting(true);
    setError('');

    const payload = {
      title,
      description,
      loreText,
      imageSrc: imageSrc.trim() || DEFAULT_IMAGE,
    };

    try {
      if (id) {
        const response = await api.updateFragment(id, payload, csrfToken);
        navigate(`/chronicle/${response.chronicle.id}`, { replace: true });
      } else {
        const response = await api.createFragment(payload, csrfToken);
        navigate(`/chronicle/${response.chronicle.id}`, { replace: true });
      }
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (sessionLoading || loading) {
    return <div className="flex justify-center items-center min-h-[50vh]"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div></div>;
  }

  if (!authenticated || !user?.isAdmin) {
    return null;
  }

  return (
    <div className="container mx-auto px-6 md:px-8 max-w-3xl">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-12">
        <h1 className="font-headline text-4xl md:text-5xl italic text-glow text-primary mb-4">{isEditing ? 'Rewrite the Fragment' : 'Inscribe a Fragment'}</h1>
        <p className="font-body text-on-surface-variant font-light">{isEditing ? 'Update the chronicle without losing its existing record in the database.' : 'Add your own chronicle to the living codex. Share a myth, a place, or a memory.'}</p>
      </motion.div>
      <motion.form initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} onSubmit={handleSubmit} className="space-y-6 bg-surface-container-low/30 backdrop-blur-sm p-8 border border-primary/20 rounded-sm">
        {error && <div className="p-4 bg-red-900/50 border border-red-500 text-red-200 rounded-sm">{error}</div>}
        <div>
          <label className="block font-label text-xs uppercase tracking-widest text-secondary mb-2">Title</label>
          <input type="text" required value={title} onChange={(event) => setTitle(event.target.value)} className="w-full bg-background/50 border border-primary/30 rounded-sm px-4 py-3 text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors" placeholder="e.g., The Whispering Cave" />
        </div>
        <div>
          <label className="block font-label text-xs uppercase tracking-widest text-secondary mb-2">Short Description</label>
          <textarea required value={description} onChange={(event) => setDescription(event.target.value)} className="w-full bg-background/50 border border-primary/30 rounded-sm px-4 py-3 text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors h-24 resize-none" placeholder="A brief summary of the fragment..." />
        </div>
        <div>
          <label className="block font-label text-xs uppercase tracking-widest text-secondary mb-2">Hidden Lore (Full Chronicle)</label>
          <RichTextEditor value={loreText} onChange={setLoreText} placeholder="The deep history, the myth, the full story..." height={320} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <label className="block font-label text-xs uppercase tracking-widest text-secondary">Image URL (Optional)</label>
            <input type="url" value={imageSrc} onChange={(event) => setImageSrc(event.target.value)} className="w-full bg-background/50 border border-primary/30 rounded-sm px-4 py-3 text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors" placeholder="https://..." />
            <div className="space-y-2">
              <label className="block font-label text-xs uppercase tracking-widest text-secondary">Upload Image From Your Device</label>
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif" onChange={handleImageUpload} disabled={uploadingImage || !imageUploadsEnabled} className="block w-full text-sm text-on-surface file:mr-4 file:rounded-sm file:border file:border-primary/20 file:bg-primary-container/40 file:px-4 file:py-2 file:text-xs file:uppercase file:tracking-[0.18em] file:text-primary hover:file:bg-primary-container/60 disabled:opacity-50" />
              <p className="font-body text-xs text-on-surface-variant">
                {imageUploadsEnabled
                  ? (uploadingImage ? 'Uploading image...' : 'Choose a file from your computer and it will be uploaded for this fragment.')
                  : 'Image uploads are not configured in production yet. Add Cloudinary env vars in Render or paste an image URL above.'}
              </p>
              {uploadError ? <p className="font-body text-xs text-red-300">{uploadError}</p> : null}
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block font-label text-xs uppercase tracking-widest text-secondary mb-2">Image Alt Text</label>
              <input type="text" value={imageAlt} onChange={(event) => setImageAlt(event.target.value)} className="w-full bg-background/50 border border-primary/30 rounded-sm px-4 py-3 text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors" placeholder="Description of the image" />
            </div>
            {imageSrc ? (
              <div className="overflow-hidden rounded-sm border border-primary/20 bg-background/40">
                <img src={imageSrc} alt={imageAlt || title || 'Fragment image preview'} className="h-48 w-full object-cover" />
              </div>
            ) : null}
          </div>
        </div>
        <button type="submit" disabled={submitting || uploadingImage} className="w-full mt-8 py-4 bg-primary-container/50 hover:bg-primary-container text-primary font-label text-sm uppercase tracking-[0.2em] rounded-md transition-all duration-500 shadow-[inset_0_0_12px_rgba(113,215,205,0.1)] hover:shadow-[inset_0_0_20px_rgba(113,215,205,0.3)] border border-primary/20 disabled:opacity-50 disabled:cursor-not-allowed">{submitting ? (isEditing ? 'Reinscribing...' : 'Inscribing...') : isEditing ? 'Update Fragment' : 'Inscribe Fragment'}</button>
      </motion.form>
    </div>
  );
}
