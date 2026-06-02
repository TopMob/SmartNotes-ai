import { Check, ChevronLeft, Tag } from "lucide-react";
import { Button } from "@/shared/ui/button";
import type { KeyboardEvent, MouseEvent as ReactMouseEvent } from "react";

type TagsModalProps = {
  lang: string;
  userTags: string[];
  role: string;
  tagDraftVal: string;
  setTagDraftVal: (val: string) => void;
  tagInputFocused: boolean;
  setTagInputFocused: (val: boolean) => void;
  handleTagInputBlur: () => void;
  handleTagInputKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  tagSuggestions: string[];
  selectTagSuggestion: (suggestion: string) => void;
  allExistingTags: string[];
  setUserTags: (tags: string[]) => void;
  markEditorDirty: (dirty: boolean) => void;
  setTagsModalOpen: (open: boolean) => void;
};

export function TagsModal({
  lang,
  userTags,
  role,
  tagDraftVal,
  setTagDraftVal,
  tagInputFocused,
  setTagInputFocused,
  handleTagInputBlur,
  handleTagInputKeyDown,
  tagSuggestions,
  selectTagSuggestion,
  allExistingTags,
  setUserTags,
  markEditorDirty,
  setTagsModalOpen,
}: TagsModalProps) {
  return (
    <div className="fixed inset-0 z-[100] bg-background/98 backdrop-blur-3xl animate-premium-overlay flex flex-col p-4 sm:p-8">
      <div className="mx-auto w-full max-w-2xl flex flex-col h-full">
        <header className="flex items-center justify-between border-b border-border pb-4 mb-4">
          <div className="flex items-center gap-2">
            <Tag className="h-6 w-6 text-accent" />
            <h2 className="text-xl font-black">{lang === "ru" ? "Управление тегами" : "Tag Management"}</h2>
          </div>
          <button 
            onClick={() => setTagsModalOpen(false)}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-strong hover:bg-surface-strong/80 transition-colors text-foreground/80 cursor-pointer"
            type="button"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        </header>

        {/* Input section inside modal */}
        <div className="relative mb-6">
          <div className="flex items-center gap-2 rounded-2xl bg-surface-strong px-4 py-3 border border-border focus-within:border-accent/80 focus-within:ring-2 focus-within:ring-accent/15 transition-all">
            <input 
              className="flex-1 bg-transparent text-base outline-none text-foreground placeholder:text-foreground/32" 
              value={tagDraftVal}
              onChange={(event) => setTagDraftVal(event.target.value)}
              onFocus={() => setTagInputFocused(true)}
              onBlur={handleTagInputBlur}
              onKeyDown={handleTagInputKeyDown}
              placeholder={lang === "ru" ? "Введите новый тег и нажмите Enter..." : "Enter new tag and press Enter..."} 
              autoFocus
            />
          </div>
          {tagInputFocused && tagSuggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 max-h-40 overflow-y-auto rounded-2xl border border-border bg-surface p-2 shadow-2xl z-[110]">
              <div className="flex flex-wrap gap-1.5">
                {tagSuggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    onMouseDown={(e: ReactMouseEvent<HTMLButtonElement>) => {
                      e.preventDefault();
                      selectTagSuggestion(suggestion);
                    }}
                    className="rounded-lg bg-surface-strong px-2.5 py-1.5 text-xs font-bold text-foreground/80 hover:bg-accent/15 hover:text-accent transition-colors"
                    type="button"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Current note tags section */}
        <div className="flex-1 overflow-y-auto min-h-0 mb-6">
          <h3 className="text-sm font-bold text-foreground/45 uppercase tracking-wider mb-3">
            {lang === "ru" ? `Выбранные теги (${userTags.length})` : `Selected tags (${userTags.length})`}
          </h3>
          
          {userTags.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-border rounded-2xl bg-surface/30">
              <Tag className="h-8 w-8 text-foreground/20 mb-2" />
              <p className="text-sm text-foreground/45">{lang === "ru" ? "У этой заметки пока нет тегов" : "This note has no tags yet"}</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2.5">
              {userTags.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-2 rounded-xl bg-accent/10 border border-accent/20 px-3.5 py-2 text-sm font-bold text-accent shadow-sm animate-premium-tag">
                  #{tag.replace(/^#+/, "")}
                  {role !== "viewer" && (
                    <button 
                      type="button" 
                      onClick={() => {
                        const nextTags = userTags.filter((t) => t !== tag);
                        setUserTags(nextTags);
                        markEditorDirty(true);
                      }} 
                      className="hover:text-foreground text-accent/60 transition-colors text-base font-black px-1 cursor-pointer"
                    >
                      &times;
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}

          {/* Existing other tags workspace suggestions */}
          {allExistingTags.filter(t => !userTags.includes(t)).length > 0 && (
            <div className="mt-8">
              <h3 className="text-sm font-bold text-foreground/45 uppercase tracking-wider mb-3">
                {lang === "ru" ? "Рекомендуемые / другие теги" : "Recommended / other tags"}
              </h3>
              <div className="flex flex-wrap gap-2">
                {allExistingTags
                  .filter(t => !userTags.includes(t))
                  .map((tag) => (
                    <button
                      key={tag}
                      onClick={() => {
                        if (role === "viewer") return;
                        const next = [...userTags, tag];
                        setUserTags(next);
                        markEditorDirty(true);
                      }}
                      className="inline-flex items-center gap-1 rounded-xl bg-surface-strong hover:bg-accent/10 hover:text-accent border border-transparent hover:border-accent/25 px-3.5 py-2 text-sm font-bold text-foreground/72 transition-all cursor-pointer"
                      type="button"
                    >
                      #{tag}
                    </button>
                  ))}
              </div>
            </div>
          )}
        </div>

        <footer className="border-t border-border pt-4 mt-auto">
          <Button 
            className="w-full h-12 rounded-2xl font-bold flex items-center justify-center gap-2"
            onClick={() => setTagsModalOpen(false)}
            type="button"
          >
            <Check className="h-5 w-5" />
            <span>{lang === "ru" ? "Готово" : "Done"}</span>
          </Button>
        </footer>
      </div>
    </div>
  );
}


