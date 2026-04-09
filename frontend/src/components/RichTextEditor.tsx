import { useEffect, useMemo, useRef } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  height?: number;
}

function normalizeHtml(value: string) {
  return (value || '')
    .replace(/<p><\/p>/g, '')
    .replace(/<p>\s*<br\s*\/?><\/p>/g, '')
    .trim();
}

interface ToolbarButtonProps {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

function ToolbarButton({ label, active = false, disabled = false, onClick }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-sm border px-3 py-2 font-label text-[11px] uppercase tracking-[0.18em] transition-colors ${active
        ? 'border-primary/60 bg-primary/20 text-primary'
        : 'border-primary/20 bg-background/40 text-on-surface-variant hover:border-primary/40 hover:text-primary'} disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      {label}
    </button>
  );
}

export function RichTextEditor({ value, onChange, placeholder, height = 260 }: RichTextEditorProps) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: 'https',
        protocols: ['http', 'https', 'mailto'],
      }),
      Placeholder.configure({
        placeholder: placeholder || 'Write here...',
      }),
    ],
    content: value || '',
    editorProps: {
      attributes: {
        class: 'tiptap-editor prose prose-invert max-w-none focus:outline-none',
      },
    },
    onUpdate({ editor: activeEditor }) {
      onChangeRef.current(activeEditor.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) {
      return;
    }

    const current = normalizeHtml(editor.getHTML());
    const incoming = normalizeHtml(value);
    if (current !== incoming) {
      editor.commands.setContent(value || '', { emitUpdate: false });
    }
  }, [editor, value]);

  const minHeightStyle = useMemo(() => ({ minHeight: `${height}px` }), [height]);

  if (!editor) {
    return (
      <div className="rounded-sm border border-primary/20 bg-background/40 p-4">
        <div className="h-40 animate-pulse rounded-sm bg-primary/5" />
      </div>
    );
  }

  const setLink = () => {
    const previousUrl = editor.getAttributes('link').href || '';
    const url = window.prompt('Enter the link URL', previousUrl);

    if (url === null) {
      return;
    }

    const trimmed = url.trim();
    if (!trimmed) {
      editor.chain().focus().unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: trimmed }).run();
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 rounded-sm border border-primary/15 bg-background/35 p-3">
        <ToolbarButton label="Body" active={editor.isActive('paragraph')} onClick={() => editor.chain().focus().setParagraph().run()} />
        <ToolbarButton label="H2" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} />
        <ToolbarButton label="H3" active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} />
        <ToolbarButton label="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} />
        <ToolbarButton label="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} />
        <ToolbarButton label="Quote" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} />
        <ToolbarButton label="Bullets" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} />
        <ToolbarButton label="Numbers" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} />
        <ToolbarButton label="Link" active={editor.isActive('link')} onClick={setLink} />
        <ToolbarButton label="Clear" onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()} />
      </div>
      <div className="overflow-hidden rounded-sm border border-primary/20 bg-background/45">
        <EditorContent editor={editor} className="rich-editor-shell px-4 py-4 text-on-surface" style={minHeightStyle} />
      </div>
    </div>
  );
}
