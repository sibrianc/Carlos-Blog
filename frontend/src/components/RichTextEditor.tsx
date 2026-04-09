import { useEffect, useRef } from 'react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  height?: number;
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

  onChangeRef.current = onChange;

  useEffect(() => {
    const textarea = textareaRef.current;
    const CKEDITOR = window.CKEDITOR;

    if (!textarea || !CKEDITOR || editorRef.current) {
      return;
    }

    const instance = CKEDITOR.replace(textarea, {
      height,
      removePlugins: 'elementspath',
      resize_enabled: true,
    });

    instance.on('instanceReady', () => {
      instance.setData(value || '');
    });
    instance.on('change', () => {
      onChangeRef.current(instance.getData());
    });

    editorRef.current = instance;

    return () => {
      if (editorRef.current) {
        editorRef.current.destroy(true);
        editorRef.current = null;
      }
    };
  }, [height]);

  useEffect(() => {
    if (!editorRef.current) {
      return;
    }

    if (editorRef.current.getData() !== value) {
      editorRef.current.setData(value || '');
    }
  }, [value]);

  return (
    <textarea
      ref={textareaRef}
      defaultValue={value}
      placeholder={placeholder}
      className="w-full min-h-[220px] bg-background/50 border border-primary/30 rounded-sm px-4 py-3 text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
    />
  );
}
