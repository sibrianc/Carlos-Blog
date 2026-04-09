import { useEffect, useRef, useState } from 'react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  height?: number;
}

type EditorMode = 'loading' | 'rich' | 'plain';

const CKEDITOR_SCRIPT_SRC = 'https://cdn.ckeditor.com/4.22.1/standard-all/ckeditor.js';
let ckeditorLoader: Promise<typeof window.CKEDITOR | null> | null = null;

function loadCkeditor() {
  if (typeof window === 'undefined') {
    return Promise.resolve(null);
  }

  if (window.CKEDITOR) {
    return Promise.resolve(window.CKEDITOR);
  }

  if (ckeditorLoader) {
    return ckeditorLoader;
  }

  ckeditorLoader = new Promise((resolve) => {
    const existingScript = document.querySelector(`script[src="${CKEDITOR_SCRIPT_SRC}"]`) as HTMLScriptElement | null;
    const handleLoad = () => resolve(window.CKEDITOR ?? null);
    const handleError = () => resolve(null);

    if (existingScript) {
      if (window.CKEDITOR) {
        resolve(window.CKEDITOR);
        return;
      }
      existingScript.addEventListener('load', handleLoad, { once: true });
      existingScript.addEventListener('error', handleError, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = CKEDITOR_SCRIPT_SRC;
    script.async = true;
    script.addEventListener('load', handleLoad, { once: true });
    script.addEventListener('error', handleError, { once: true });
    document.head.appendChild(script);
  });

  return ckeditorLoader;
}

export function RichTextEditor({ value, onChange, placeholder, height = 260 }: RichTextEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const editorRef = useRef<{
    on: (eventName: string, handler: () => void) => void;
    setData: (value: string) => void;
    getData: () => string;
    destroy: (noUpdate?: boolean) => void;
  } | null>(null);
  const onChangeRef = useRef(onChange);
  const [editorMode, setEditorMode] = useState<EditorMode>('loading');

  onChangeRef.current = onChange;

  useEffect(() => {
    const textarea = textareaRef.current;
    let cancelled = false;

    if (!textarea || editorRef.current) {
      return;
    }

    void loadCkeditor().then((ckeditor) => {
      if (cancelled || !textarea) {
        return;
      }

      if (!ckeditor) {
        setEditorMode('plain');
        return;
      }

      const instance = ckeditor.replace(textarea, {
        height,
        removePlugins: 'elementspath',
        resize_enabled: true,
      });

      instance.on('instanceReady', () => {
        instance.setData(value || '');
        if (!cancelled) {
          setEditorMode('rich');
        }
      });
      instance.on('change', () => {
        onChangeRef.current(instance.getData());
      });

      editorRef.current = instance;
    });

    return () => {
      cancelled = true;
      if (editorRef.current) {
        editorRef.current.destroy(true);
        editorRef.current = null;
      }
    };
  }, [height]);

  useEffect(() => {
    if (editorRef.current) {
      if (editorRef.current.getData() !== value) {
        editorRef.current.setData(value || '');
      }
      return;
    }

    if (textareaRef.current && textareaRef.current.value !== value) {
      textareaRef.current.value = value || '';
    }
  }, [value]);

  const isPlainFallback = editorMode === 'plain';

  return (
    <div className="space-y-3">
      {isPlainFallback ? (
        <p className="font-body text-xs text-on-surface-variant">
          Rich text toolbar unavailable right now. Plain text editing is still active so you can keep writing safely.
        </p>
      ) : null}
      <textarea
        ref={textareaRef}
        defaultValue={value}
        placeholder={placeholder}
        onChange={editorMode === 'plain' ? (event) => onChangeRef.current(event.target.value) : undefined}
        className="w-full min-h-[220px] bg-background/50 border border-primary/30 rounded-sm px-4 py-3 text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
      />
    </div>
  );
}

