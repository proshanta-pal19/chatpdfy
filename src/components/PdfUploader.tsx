import { CheckSquare, CloudUpload, FileText, Loader2, Square, Trash2 } from 'lucide-react';
import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import type { PdfDocumentMeta } from '../types';
import { formatBytes } from '../utils/api';

interface PdfUploaderProps {
  documents: PdfDocumentMeta[];
  selectedDocIds: string[];
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onUploadFiles: (files: File[]) => Promise<void>;
  onDeleteDoc: (id: string) => Promise<void>;
  uploading: boolean;
  error: string | null;
}

export default function PdfUploader({
  documents,
  selectedDocIds,
  onToggleSelect,
  onSelectAll,
  onUploadFiles,
  onDeleteDoc,
  uploading,
  error,
}: PdfUploaderProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setLocalError(null);
    const all = Array.from(fileList);
    const pdfs = all.filter(
      (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'),
    );
    if (pdfs.length === 0) {
      setLocalError('Please select valid PDF (.pdf) files.');
      return;
    }
    await onUploadFiles(pdfs);
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    await handleFiles(e.dataTransfer.files);
  };

  const handleChange = async (e: ChangeEvent<HTMLInputElement>) => {
    await handleFiles(e.target.files);
    e.target.value = '';
  };

  const displayError = error || localError;

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        className={`glass-panel rounded-2xl border-2 border-dashed p-8 sm:p-10 text-center transition-all cursor-pointer ${
          isDragging
            ? 'border-cyan-400 bg-cyan-500/10 shadow-[0_0_32px_rgba(34,211,238,0.2)]'
            : 'border-slate-300 dark:border-slate-700/90 hover:border-cyan-500/60 dark:hover:border-cyan-400/50'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          onChange={handleChange}
          className="hidden"
        />

        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-cyan-500/20 flex items-center justify-center text-cyan-600 dark:text-cyan-300">
            {uploading ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <CloudUpload className="w-6 h-6" />
            )}
          </div>

          <div className="space-y-1">
            <p className="text-sm sm:text-base font-medium text-slate-700 dark:text-slate-200">
              <span className="text-cyan-600 dark:text-cyan-400 font-semibold">Click to upload</span>{' '}
              or drag and drop
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              PDF files only · Upload 1 or multiple study documents (max 25 MB each)
            </p>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              inputRef.current?.click();
            }}
            className="mt-1 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-cyan-600 hover:bg-cyan-500 transition-all neon-glow-cyan cursor-pointer whitespace-nowrap"
          >
            {uploading ? 'Processing PDF...' : 'Select PDF'}
          </button>
        </div>
      </div>

      {displayError && (
        <div
          role="alert"
          className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-300 break-words"
        >
          {displayError}
        </div>
      )}

      {documents.length > 0 && (
        <div className="glass-panel rounded-2xl p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-medium">
              <span>Uploaded Documents ({documents.length})</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums text-cyan-600 dark:text-cyan-400">
                {selectedDocIds.length} active
              </span>
            </div>
            {documents.length > 1 && (
              <button
                type="button"
                onClick={onSelectAll}
                className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
              >
                {selectedDocIds.length === documents.length ? 'All selected' : 'Select all PDFs'}
              </button>
            )}
          </div>

          <div className="divide-y divide-slate-200/80 dark:divide-slate-800/80">
            {documents.map((doc) => {
              const isSelected = selectedDocIds.includes(doc.id);
              return (
                <div
                  key={doc.id}
                  className="py-2.5 flex items-center justify-between gap-3"
                >
                  <button
                    type="button"
                    onClick={() => onToggleSelect(doc.id)}
                    className="flex items-center gap-3 min-w-0 text-left flex-1 cursor-pointer group"
                  >
                    <span className="text-cyan-600 dark:text-cyan-400 shrink-0">
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400" />
                      )}
                    </span>
                    <FileText className="w-4 h-4 text-slate-400 group-hover:text-cyan-400 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                        {doc.fileName}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                        {doc.pageCount} {doc.pageCount === 1 ? 'page' : 'pages'} · {formatBytes(doc.fileSize)} · {(doc.charCount / 1000).toFixed(1)}k chars
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => void onDeleteDoc(doc.id)}
                    aria-label={`Remove ${doc.fileName}`}
                    className="p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors shrink-0 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
