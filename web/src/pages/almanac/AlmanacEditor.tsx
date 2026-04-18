import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import {
  MDXEditor,
  type MDXEditorMethods,
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  markdownShortcutPlugin,
  linkPlugin,
  linkDialogPlugin,
  imagePlugin,
  tablePlugin,
  codeBlockPlugin,
  codeMirrorPlugin,
  toolbarPlugin,
  BoldItalicUnderlineToggles,
  UndoRedo,
  BlockTypeSelect,
  CreateLink,
  InsertImage,
  InsertTable,
  InsertCodeBlock,
  InsertThematicBreak,
  ListsToggle,
  Separator,
} from "@mdxeditor/editor";
import "@mdxeditor/editor/style.css";
import Button from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import ConfirmModal from "../../components/ui/ConfirmModal";
import PlantSprite from "../../components/sprites/PlantSprite";
import {
  useAlmanacEntry,
  useDeleteAlmanacEntry,
  useUpdateAlmanacEntry,
} from "../../api/hooks";
import { uploadAlmanacImage } from "../../api";

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function AlmanacEditor() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { data: entry, isLoading, error } = useAlmanacEntry(slug);
  const updateEntry = useUpdateAlmanacEntry();
  const deleteEntry = useDeleteAlmanacEntry();
  const editorRef = useRef<MDXEditorMethods>(null);

  const [title, setTitle] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Seed form when entry loads (once; the MDXEditor manages its own content after that)
  const seededRef = useRef(false);
  useEffect(() => {
    if (!entry || seededRef.current) return;
    seededRef.current = true;
    setTitle(entry.title);
    setTagsInput(entry.tags.join(", "));
    setExcerpt(entry.excerpt ?? "");
  }, [entry]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <PlantSprite type="flower" mood="sleeping" size={48} className="animate-pulse" />
      </div>
    );
  }

  if (error || !entry) {
    return (
      <div className="max-w-3xl space-y-4">
        <Link
          to="/almanac"
          className="inline-flex items-center gap-1.5 text-sm text-stone-400 hover:text-emerald-400 transition-colors"
        >
          <ArrowLeft size={14} />
          Back to Almanac
        </Link>
        <div className="text-center py-16 bg-stone-900/50 border border-dashed border-stone-800 rounded-xl">
          <p className="text-stone-400 font-display">Entry not found.</p>
        </div>
      </div>
    );
  }

  const parsedTags = tagsInput
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  async function handleSave() {
    if (!entry) return;
    setSaveError(null);
    const content = editorRef.current?.getMarkdown() ?? entry.content;
    try {
      const updated = await updateEntry.mutateAsync({
        id: entry.id,
        data: {
          title: title || "Untitled",
          excerpt: excerpt.trim() || null,
          content,
          tags: parsedTags,
        },
      });
      setDirty(false);
      if (updated.slug !== entry.slug) {
        navigate(`/almanac/${updated.slug}/edit`, { replace: true });
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function handleDelete() {
    if (!entry) return;
    deleteEntry.mutate(entry.id, {
      onSuccess: () => navigate("/almanac"),
    });
  }

  async function handleImageUpload(file: File): Promise<string> {
    if (!entry) throw new Error("Entry not ready");
    const dataUrl = await fileToDataUrl(file);
    const result = await uploadAlmanacImage(entry.id, dataUrl);
    return result.url;
  }

  return (
    <div className="max-w-4xl space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Link
          to={`/almanac/${entry.slug}`}
          className="inline-flex items-center gap-1.5 text-sm text-stone-400 hover:text-emerald-400 transition-colors"
        >
          <ArrowLeft size={14} />
          Back to entry
        </Link>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirmOpen(true)}
            className="text-red-400 hover:text-red-300"
          >
            <Trash2 size={14} />
          </Button>
          <Button
            onClick={handleSave}
            disabled={updateEntry.isPending}
            size="sm"
          >
            <Save size={14} />
            {updateEntry.isPending ? "Saving…" : dirty ? "Save" : "Saved"}
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <Input
          label="Title"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setDirty(true);
          }}
          placeholder="Untitled"
        />

        <Input
          label="Tags"
          value={tagsInput}
          onChange={(e) => {
            setTagsInput(e.target.value);
            setDirty(true);
          }}
          placeholder="soil, composting, amendments"
        />

        <Input
          label="Excerpt (optional)"
          value={excerpt}
          onChange={(e) => {
            setExcerpt(e.target.value);
            setDirty(true);
          }}
          placeholder="Short summary shown on the index card"
        />
      </div>

      <div className="almanac-editor rounded-lg border border-stone-800 bg-stone-900">
        <MDXEditor
          ref={editorRef}
          markdown={entry.content}
          onChange={() => setDirty(true)}
          contentEditableClassName="almanac-editor__content prose prose-invert max-w-none px-4 py-3 min-h-[400px] focus:outline-none"
          plugins={[
            headingsPlugin(),
            listsPlugin(),
            quotePlugin(),
            thematicBreakPlugin(),
            linkPlugin(),
            linkDialogPlugin(),
            imagePlugin({ imageUploadHandler: handleImageUpload }),
            tablePlugin(),
            codeBlockPlugin({ defaultCodeBlockLanguage: "txt" }),
            codeMirrorPlugin({
              codeBlockLanguages: {
                txt: "Plain text",
                js: "JavaScript",
                ts: "TypeScript",
                bash: "Shell",
                json: "JSON",
                md: "Markdown",
              },
            }),
            markdownShortcutPlugin(),
            toolbarPlugin({
              toolbarClassName: "almanac-editor__toolbar",
              toolbarContents: () => (
                <>
                  <UndoRedo />
                  <Separator />
                  <BlockTypeSelect />
                  <Separator />
                  <BoldItalicUnderlineToggles />
                  <Separator />
                  <ListsToggle />
                  <Separator />
                  <CreateLink />
                  <InsertImage />
                  <InsertTable />
                  <InsertCodeBlock />
                  <InsertThematicBreak />
                </>
              ),
            }),
          ]}
        />
      </div>

      {saveError && (
        <p className="text-sm text-red-400">Save failed: {saveError}</p>
      )}

      <ConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Delete this entry?"
        message={`"${entry.title}" will be permanently deleted, along with any images uploaded to it.`}
        confirmLabel="Delete"
        variant="destructive"
      />
    </div>
  );
}
