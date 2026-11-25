import {
  AlertCircle,
  BookMarked,
  Eraser,
  Loader2,
  MessageSquare,
  Send,
  Sparkles,
} from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { ChatMessage, PdfDocumentMeta } from '../types';
import { clearChatHistory, sendChatQuestion } from '../utils/api';
import { playSelectSound, playTransitionSound } from '../utils/sound';
import PdfUploader from './PdfUploader';

interface ChatViewProps {
  documents: PdfDocumentMeta[];
  selectedDocIds: string[];
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onUploadFiles: (files: File[]) => Promise<void>;
  onDeleteDoc: (id: string) => Promise<void>;
  uploading: boolean;
  uploadError: string | null;
  messages: ChatMessage[];
  onMessagesChange: (messages: ChatMessage[]) => void;
  onGoToQuiz: () => void;
}

const STARTER_PROMPTS = [
  'Summarize the main topics covered in the uploaded PDF.',
  'List the key definitions and formulas mentioned in these notes.',
  'What are the most important takeaways for an exam?',
];

function renderInlineFormatting(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={idx} className="font-semibold text-slate-900 dark:text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={idx}
          className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-xs text-cyan-700 dark:text-cyan-300"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={idx}>{part}</span>;
  });
}

function FormattedAnswer({ content }: { content: string }) {
  // Normalize accidental inline bullets (e.g. "intro: • Step 1... • Step 2...") into proper lines
  const normalized = content
    .replace(/\s+•\s+/g, '\n- ')
    .replace(/^•\s+/gm, '- ')
    .replace(/\s+(\d+\.\s+\*\*)/g, '\n$1')
    .trim();

  const lines = normalized.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let listItems: { ordered: boolean; text: string }[] = [];

  const flushList = (keyPrefix: string) => {
    if (listItems.length === 0) return;
    const isOrdered = listItems[0].ordered;
    const Tag = isOrdered ? 'ol' : 'ul';
    blocks.push(
      <Tag
        key={`${keyPrefix}-list-${blocks.length}`}
        className={`space-y-2 pl-5 text-sm sm:text-[15px] text-slate-800 dark:text-slate-100 leading-relaxed ${
          isOrdered ? 'list-decimal' : 'list-disc'
        }`}
      >
        {listItems.map((item, idx) => (
          <li key={idx} className="pl-1 marker:text-cyan-500">
            {renderInlineFormatting(item.text)}
          </li>
        ))}
      </Tag>,
    );
    listItems = [];
  };

  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim();
    if (!line) {
      flushList(`empty-${idx}`);
      return;
    }

    const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      flushList(`h-${idx}`);
      blocks.push(
        <h4
          key={`heading-${idx}`}
          className="font-display text-sm sm:text-base font-semibold text-cyan-700 dark:text-cyan-300 pt-1"
        >
          {renderInlineFormatting(headingMatch[2])}
        </h4>,
      );
      return;
    }

    const bulletMatch = line.match(/^[-*•]\s+(.+)$/);
    if (bulletMatch) {
      if (listItems.length > 0 && listItems[0].ordered) {
        flushList(`switch-${idx}`);
      }
      listItems.push({ ordered: false, text: bulletMatch[1] });
      return;
    }

    const orderedMatch = line.match(/^\d+[.)]\s+(.+)$/);
    if (orderedMatch) {
      if (listItems.length > 0 && !listItems[0].ordered) {
        flushList(`switch-${idx}`);
      }
      listItems.push({ ordered: true, text: orderedMatch[1] });
      return;
    }

    flushList(`p-${idx}`);
    blocks.push(
      <p
        key={`para-${idx}`}
        className="text-sm sm:text-[15px] text-slate-800 dark:text-slate-100 leading-relaxed"
      >
        {renderInlineFormatting(line)}
      </p>,
    );
  });

  flushList('end');

  return <div className="space-y-3">{blocks}</div>;
}

export default function ChatView({
  documents,
  selectedDocIds,
  onToggleSelect,
  onSelectAll,
  onUploadFiles,
  onDeleteDoc,
  uploading,
  uploadError,
  messages,
  onMessagesChange,
  onGoToQuiz,
}: ChatViewProps) {
  const [question, setQuestion] = useState('');
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const scrollEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, sending]);

  const activeIds = selectedDocIds.length > 0 ? selectedDocIds : documents.map((d) => d.id);

  const handleSubmit = async (e?: FormEvent, presetQuestion?: string) => {
    e?.preventDefault();
    const text = (presetQuestion ?? question).trim();
    if (!text || sending || documents.length === 0) return;

    setChatError(null);
    setSending(true);
    playSelectSound();
    if (!presetQuestion) setQuestion('');

    const optimisticUser: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };
    onMessagesChange([...messages, optimisticUser]);

    try {
      const { userMessage, assistantMessage } = await sendChatQuestion(text, activeIds);
      onMessagesChange([...messages, userMessage, assistantMessage]);
      playTransitionSound();
    } catch (err) {
      setChatError((err as Error).message || 'Failed to get an answer.');
      onMessagesChange(messages);
    } finally {
      setSending(false);
    }
  };

  const handleClear = async () => {
    await clearChatHistory();
    onMessagesChange([]);
    playSelectSound();
  };

  return (
    <section className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
      <div className="text-center space-y-2">
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
          Chat with PDF
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300">
          Upload one or multiple PDFs and ask questions grounded strictly in your notes
        </p>
      </div>

      {/* Uploader Area */}
      <PdfUploader
        documents={documents}
        selectedDocIds={selectedDocIds}
        onToggleSelect={onToggleSelect}
        onSelectAll={onSelectAll}
        onUploadFiles={onUploadFiles}
        onDeleteDoc={onDeleteDoc}
        uploading={uploading}
        error={uploadError}
      />

      {/* Bottom Area: Empty State or Interactive Chat Box */}
      {documents.length === 0 ? (
        <div className="py-10 flex flex-col items-center justify-center text-center gap-3 text-slate-400 dark:text-slate-500">
          <MessageSquare className="w-10 h-10 stroke-[1.5]" />
          <p className="text-sm font-medium">Upload a PDF to start chatting</p>
        </div>
      ) : (
        <div className="glass-panel rounded-2xl overflow-hidden flex flex-col">
          {/* Chat Toolbar */}
          <div className="px-4 sm:px-6 py-3.5 border-b border-slate-200/80 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-medium">
              Answering from{' '}
              <span className="font-mono tabular-nums text-cyan-600 dark:text-cyan-400">
                {activeIds.length}
              </span>{' '}
              {activeIds.length === 1 ? 'PDF' : 'PDFs'} · Strict document-only mode
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onGoToQuiz}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 transition-colors inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Generate quiz</span>
              </button>

              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={() => void handleClear()}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-rose-500 hover:bg-rose-500/10 transition-colors inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <Eraser className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>
              )}
            </div>
          </div>

          {/* Messages Stream */}
          <div className="p-4 sm:p-6 space-y-5 max-h-[600px] overflow-y-auto">
            {messages.length === 0 ? (
              <div className="py-6 space-y-4">
                <p className="text-sm text-slate-500 dark:text-slate-400 text-center">
                  Ask anything about your uploaded PDFs. Every answer includes the exact PDF
                  section it came from.
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {STARTER_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => void handleSubmit(undefined, prompt)}
                      className="px-3.5 py-2 rounded-xl text-xs sm:text-sm text-left border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-900/70 text-slate-700 dark:text-slate-200 hover:border-cyan-500/50 hover:text-cyan-600 dark:hover:text-cyan-300 transition-colors cursor-pointer"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    msg.role === 'user' ? 'items-end' : 'items-start'
                  }`}
                >
                  {msg.role === 'user' ? (
                    <div className="max-w-[85%] rounded-2xl rounded-br-sm px-4 py-3 bg-cyan-600 text-white text-sm sm:text-base shadow-sm">
                      {msg.content}
                    </div>
                  ) : (
                    <div className="max-w-[96%] sm:max-w-[90%] rounded-2xl rounded-bl-sm p-5 sm:p-6 border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/85 space-y-4">
                      {msg.notFound ? (
                        <div className="flex items-start gap-3 text-amber-700 dark:text-amber-300">
                          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-semibold text-sm sm:text-base">
                              Not Found in the document
                            </p>
                            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
                              No passage in your selected PDF(s) directly answers this question.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <>
                          <FormattedAnswer content={msg.content} />

                          {msg.citations && msg.citations.length > 0 && (
                            <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800 space-y-2">
                              <div className="flex items-center gap-1.5 text-xs font-semibold text-cyan-600 dark:text-cyan-400">
                                <BookMarked className="w-3.5 h-3.5" />
                                <span>Source from PDF</span>
                              </div>
                              <div className="space-y-2">
                                {msg.citations.map((cit, idx) => (
                                  <div
                                    key={`${cit.documentName}-${cit.pageNumber}-${idx}`}
                                    className="rounded-xl p-3 bg-slate-50 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800/90 text-xs space-y-1"
                                  >
                                    <div className="font-mono text-slate-500 dark:text-slate-400">
                                      {cit.documentName} · Page {cit.pageNumber}
                                    </div>
                                    <p className="text-slate-700 dark:text-slate-300 italic leading-relaxed">
                                      &ldquo;{cit.excerpt}&rdquo;
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}

            {sending && (
              <div className="flex items-start">
                <div className="rounded-2xl px-4 py-3 border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 text-sm text-slate-500 dark:text-slate-400 inline-flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-cyan-500" />
                  <span>Scanning PDF pages for grounded evidence...</span>
                </div>
              </div>
            )}
            <div ref={scrollEndRef} />
          </div>

          {chatError && (
            <div
              role="alert"
              className="mx-4 sm:mx-6 mb-3 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-xs sm:text-sm text-rose-700 dark:text-rose-300 flex items-start gap-2.5 break-words"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="min-w-0 break-words">{chatError}</span>
            </div>
          )}

          {/* Input Box */}
          <form
            onSubmit={handleSubmit}
            className="p-3 sm:p-4 border-t border-slate-200/80 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-950/60 flex items-center gap-2.5"
          >
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask a question about your uploaded PDF(s)..."
              disabled={sending}
              className="flex-1 min-w-0 h-11 px-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-cyan-500"
            />
            <button
              type="submit"
              disabled={sending || !question.trim()}
              className="h-11 px-4 sm:px-5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors inline-flex items-center gap-2 shrink-0 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">Ask</span>
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
