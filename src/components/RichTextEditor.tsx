import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Color from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import { useEffect, useCallback } from "react";
import { Bold, Italic, Type, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
}

const FONT_SIZES = [
  { label: "Pequeno", size: "12px" },
  { label: "Normal", size: "14px" },
  { label: "Médio", size: "16px" },
  { label: "Grande", size: "18px" },
  { label: "Extra grande", size: "22px" },
];

const TEXT_COLORS = [
  { label: "Preto", color: "#000000" },
  { label: "Cinza", color: "#64748b" },
  { label: "Azul", color: "#2563eb" },
  { label: "Verde", color: "#16a34a" },
  { label: "Vermelho", color: "#dc2626" },
  { label: "Roxo", color: "#7c3aed" },
  { label: "Laranja", color: "#ea580c" },
];

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  className,
  minHeight = "200px",
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
        listItem: false,
        bulletList: false,
        orderedList: false,
      }),
      TextStyle,
      Color,
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm max-w-none focus:outline-none text-sm text-foreground leading-relaxed",
          "[&_p]:my-1"
        ),
        style: `min-height: ${minHeight}; padding: 12px;`,
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  // Sync external value changes
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
  }, [value, editor]);

  const insertHTML = useCallback(
    (html: string) => {
      if (!editor) return;
      editor.chain().focus().insertContent(html).run();
    },
    [editor]
  );

  // Expose insertHTML for parent components
  useEffect(() => {
    if (editor) {
      (editor as any).__insertHTML = insertHTML;
    }
  }, [editor, insertHTML]);

  if (!editor) return null;

  return (
    <div className={cn("border border-border rounded-md overflow-hidden bg-background", className)}>
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-border bg-muted/30 flex-wrap">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn("h-7 w-7 p-0", editor.isActive("bold") && "bg-accent")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Negrito"
        >
          <Bold className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn("h-7 w-7 p-0", editor.isActive("italic") && "bg-accent")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Itálico"
        >
          <Italic className="h-3.5 w-3.5" />
        </Button>

        <div className="w-px h-4 bg-border mx-1" />

        {/* Font size */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1">
              <Type className="h-3.5 w-3.5" />
              Tamanho
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[120px]">
            {FONT_SIZES.map((fs) => (
              <DropdownMenuItem
                key={fs.size}
                className="text-xs"
                onClick={() => {
                  editor.chain().focus().setMark("textStyle", { fontSize: fs.size } as any).run();
                }}
              >
                <span style={{ fontSize: fs.size }}>{fs.label}</span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem
              className="text-xs text-muted-foreground"
              onClick={() => {
                editor.chain().focus().unsetMark("textStyle").run();
              }}
            >
              Remover tamanho
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Text color */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1">
              <Palette className="h-3.5 w-3.5" />
              Cor
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[120px]">
            {TEXT_COLORS.map((tc) => (
              <DropdownMenuItem
                key={tc.color}
                className="text-xs gap-2"
                onClick={() => editor.chain().focus().setColor(tc.color).run()}
              >
                <div className="h-3 w-3 rounded-full border border-border" style={{ backgroundColor: tc.color }} />
                {tc.label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem
              className="text-xs text-muted-foreground"
              onClick={() => editor.chain().focus().unsetColor().run()}
            >
              Remover cor
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Editor area */}
      <EditorContent
        editor={editor}
        className="[&_.tiptap]:min-h-0 [&_.tiptap_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.tiptap_p.is-editor-empty:first-child::before]:text-muted-foreground [&_.tiptap_p.is-editor-empty:first-child::before]:opacity-50 [&_.tiptap_p.is-editor-empty:first-child::before]:float-left [&_.tiptap_p.is-editor-empty:first-child::before]:pointer-events-none"
      />
    </div>
  );
}
