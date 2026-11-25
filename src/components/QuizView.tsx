import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Clock,
  Download,
  Loader2,
  RotateCcw,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  GeneratedQuiz,
  PdfDocumentMeta,
  QuizAttempt,
  QuizDifficulty,
} from '../types';
import {
  downloadQuizReport,
  formatDuration,
  generateQuiz,
  submitQuizAttempt,
} from '../utils/api';
import {
  playAlertSound,
  playQuizCompleteSound,
  playSelectSound,
  playTransitionSound,
} from '../utils/sound';
import PdfUploader from './PdfUploader';

interface QuizViewProps {
  documents: PdfDocumentMeta[];
  selectedDocIds: string[];
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onUploadFiles: (files: File[]) => Promise<void>;
  onDeleteDoc: (id: string) => Promise<void>;
  uploading: boolean;
  uploadError: string | null;
  onAttemptSaved: (attempt: QuizAttempt) => void;
}

const QUESTION_COUNTS = [5, 10, 15, 20, 25];
const DIFFICULTIES: Array<{
  level: QuizDifficulty;
  detail: string;
  secPerQ: number;
}> = [
  { level: 'Easy', detail: 'Core facts & definitions · 30s/question', secPerQ: 30 },
  { level: 'Medium', detail: 'Concept links & application · 45s/question', secPerQ: 45 },
  { level: 'Hard', detail: 'Synthesis & deep reasoning · 60s/question', secPerQ: 60 },
];

const OPTION_LETTERS = ['A', 'B', 'C', 'D'];

export default function QuizView({
  documents,
  selectedDocIds,
  onToggleSelect,
  onSelectAll,
  onUploadFiles,
  onDeleteDoc,
  uploading,
  uploadError,
  onAttemptSaved,
}: QuizViewProps) {
  const [numQuestions, setNumQuestions] = useState<number>(5);
  const [difficulty, setDifficulty] = useState<QuizDifficulty>('Medium');
  const [generating, setGenerating] = useState(false);
  const [quizError, setQuizError] = useState<string | null>(null);

  const [activeQuiz, setActiveQuiz] = useState<GeneratedQuiz | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [direction, setDirection] = useState(1);
  const [userAnswers, setUserAnswers] = useState<number[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [completedAttempt, setCompletedAttempt] = useState<QuizAttempt | null>(null);

  const lowTimeAlertedRef = useRef(false);
  const submittingRef = useRef(false);

  const activeIds = selectedDocIds.length > 0 ? selectedDocIds : documents.map((d) => d.id);

  const finalizeQuiz = useCallback(
    async (quiz: GeneratedQuiz, answers: number[], remainingSec: number) => {
      if (submittingRef.current) return;
      submittingRef.current = true;
      setSubmitting(true);

      const timeSpent = Math.max(1, quiz.timeLimitSeconds - remainingSec);
      try {
        const attempt = await submitQuizAttempt({
          title: quiz.title,
          difficulty: quiz.difficulty,
          documentNames: quiz.documentNames,
          timeLimitSeconds: quiz.timeLimitSeconds,
          timeSpentSeconds: timeSpent,
          questions: quiz.questions,
          userAnswers: answers,
        });
        setCompletedAttempt(attempt);
        setActiveQuiz(null);
        onAttemptSaved(attempt);
        playQuizCompleteSound(attempt.scorePercent >= 60);
      } catch (err) {
        setQuizError((err as Error).message || 'Failed to save quiz results.');
      } finally {
        setSubmitting(false);
        submittingRef.current = false;
      }
    },
    [onAttemptSaved],
  );

  // Countdown timer
  useEffect(() => {
    if (!activeQuiz || completedAttempt) return;

    const timer = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          void finalizeQuiz(activeQuiz, userAnswers, 0);
          return 0;
        }
        const next = prev - 1;
        if (
          !lowTimeAlertedRef.current &&
          next <= Math.max(10, Math.floor(activeQuiz.timeLimitSeconds * 0.2))
        ) {
          lowTimeAlertedRef.current = true;
          playAlertSound();
        }
        return next;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [activeQuiz, completedAttempt, finalizeQuiz, userAnswers]);

  const handleGenerate = async () => {
    if (documents.length === 0 || generating) return;
    setQuizError(null);
    setGenerating(true);
    setCompletedAttempt(null);
    lowTimeAlertedRef.current = false;

    try {
      const quiz = await generateQuiz(numQuestions, difficulty, activeIds);
      setActiveQuiz(quiz);
      setCurrentIdx(0);
      setDirection(1);
      setUserAnswers(new Array(quiz.questions.length).fill(-1));
      setTimeLeft(quiz.timeLimitSeconds);
      playTransitionSound();
    } catch (err) {
      setQuizError((err as Error).message || 'Failed to generate quiz.');
    } finally {
      setGenerating(false);
    }
  };

  const handleSelectOption = (optionIdx: number) => {
    playSelectSound();
    setUserAnswers((prev) => {
      const copy = [...prev];
      copy[currentIdx] = optionIdx;
      return copy;
    });
  };

  const goToQuestion = (nextIdx: number) => {
    if (!activeQuiz) return;
    if (nextIdx < 0 || nextIdx >= activeQuiz.questions.length) return;
    setDirection(nextIdx > currentIdx ? 1 : -1);
    setCurrentIdx(nextIdx);
    playTransitionSound();
  };

  // Stage 3: Quiz Result & PDF Explanations
  if (completedAttempt) {
    return (
      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
        <div className="glass-panel rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800 pb-6">
            <div>
              <p className="text-xs font-medium text-cyan-600 dark:text-cyan-400">
                Quiz Completed · {completedAttempt.difficulty}
              </p>
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mt-1">
                {completedAttempt.title}
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                Sources: {completedAttempt.documentNames.join(', ')}
              </p>
            </div>

            <div className="flex flex-col sm:items-end">
              <div className="font-display text-4xl font-bold tabular-nums text-cyan-600 dark:text-cyan-300">
                {completedAttempt.scorePercent}%
              </div>
              <p className="text-xs sm:text-sm font-mono tabular-nums text-slate-600 dark:text-slate-300">
                {completedAttempt.correctCount} / {completedAttempt.totalQuestions} correct ·{' '}
                {formatDuration(completedAttempt.timeSpentSeconds)} spent
              </p>
            </div>
          </div>

          <div className="no-print flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => downloadQuizReport(completedAttempt)}
              className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold neon-glow-cyan inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Download className="w-4 h-4" />
              <span>Download PDF</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setCompletedAttempt(null);
                setActiveQuiz(null);
              }}
              className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-cyan-500/50 text-sm font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Create New Quiz</span>
            </button>
          </div>
        </div>

        <div className="space-y-5">
          <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
            Answer Review & PDF Explanations
          </h2>

          {completedAttempt.questions.map((q, idx) => {
            const userIdx = completedAttempt.userAnswers[idx];
            const isCorrect = userIdx === q.correctIndex;
            const isUnanswered = userIdx === -1 || userIdx === undefined;

            return (
              <article key={q.id} className="glass-panel rounded-2xl p-5 sm:p-6 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h3 className="font-display text-base sm:text-lg font-semibold text-slate-900 dark:text-white flex-1">
                    {idx + 1}. {q.question}
                  </h3>

                  <span
                    className={`inline-flex items-center gap-1.5 text-xs font-semibold shrink-0 ${
                      isCorrect
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : isUnanswered
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {isCorrect ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Correct</span>
                      </>
                    ) : isUnanswered ? (
                      <>
                        <AlertTriangle className="w-4 h-4" />
                        <span>Unanswered</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4" />
                        <span>Incorrect</span>
                      </>
                    )}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {q.options.map((opt, optIdx) => {
                    const isRightOpt = optIdx === q.correctIndex;
                    const isUserPick = optIdx === userIdx;

                    let styleClass =
                      'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/50 text-slate-700 dark:text-slate-300';
                    if (isRightOpt) {
                      styleClass =
                        'border-emerald-500/60 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200 font-medium';
                    } else if (isUserPick && !isRightOpt) {
                      styleClass =
                        'border-rose-500/60 bg-rose-500/10 text-rose-900 dark:text-rose-200';
                    }

                    return (
                      <div
                        key={optIdx}
                        className={`rounded-xl border px-3.5 py-2.5 text-sm flex items-center justify-between gap-2 ${styleClass}`}
                      >
                        <span>
                          <strong className="font-mono mr-2">{OPTION_LETTERS[optIdx]}.</strong>
                          {opt}
                        </span>
                        {isRightOpt && (
                          <span className="text-[11px] font-semibold uppercase tracking-wide shrink-0">
                            Correct
                          </span>
                        )}
                        {isUserPick && !isRightOpt && (
                          <span className="text-[11px] font-semibold uppercase tracking-wide shrink-0">
                            Your Pick
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4 space-y-2 text-xs sm:text-sm">
                  <div className="flex items-center gap-2 font-semibold text-cyan-700 dark:text-cyan-300">
                    <BookOpen className="w-4 h-4 shrink-0" />
                    <span>
                      PDF Explanation ({q.sourceDocument} · Page {q.sourcePage})
                    </span>
                  </div>
                  <p className="text-slate-700 dark:text-slate-200 leading-relaxed">
                    {q.explanation}
                  </p>
                  {q.sourceExcerpt && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 italic border-t border-slate-200/70 dark:border-slate-800 pt-2">
                      &ldquo;{q.sourceExcerpt}&rdquo;
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    );
  }

  // Stage 2: Active Timed Quiz (Inspired by attached Image 2)
  if (activeQuiz) {
    const currentQ = activeQuiz.questions[currentIdx];
    const answeredCount = userAnswers.filter((a) => a !== -1).length;
    const timePercent = Math.max(
      0,
      Math.min(100, (timeLeft / activeQuiz.timeLimitSeconds) * 100),
    );
    const isLowTime = timePercent <= 20;
    const questionProgressPercent = ((currentIdx + 1) / activeQuiz.totalQuestions) * 100;

    return (
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6">
        <div className="glass-panel rounded-2xl overflow-hidden shadow-xl">
          {/* Top Blue/Cyan Header Bar matching Image 2 */}
          <div className="bg-gradient-to-r from-sky-600 via-cyan-600 to-blue-600 dark:from-cyan-900/90 dark:via-sky-900/90 dark:to-indigo-900/90 px-5 sm:px-6 py-4 text-white flex flex-wrap items-center justify-between gap-3 border-b border-cyan-400/30">
            <div className="min-w-0">
              <h1 className="font-display text-lg sm:text-xl font-bold truncate">
                {activeQuiz.title} · {activeQuiz.difficulty}
              </h1>
            </div>
            <div className="flex items-center gap-4 text-xs sm:text-sm font-mono tabular-nums shrink-0">
              <span>Total Questions: {activeQuiz.totalQuestions}</span>
              <span className="inline-flex items-center gap-1.5 font-semibold">
                <Clock className="w-4 h-4" />
                {formatDuration(timeLeft)}
              </span>
            </div>
          </div>

          {/* Remaining Time & Question Progress Bars */}
          <div className="px-5 sm:px-6 pt-4 space-y-2.5 bg-white/60 dark:bg-slate-900/40">
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                <span
                  className={
                    isLowTime
                      ? 'text-rose-600 dark:text-rose-400 font-semibold'
                      : 'text-slate-600 dark:text-slate-300'
                  }
                >
                  {isLowTime ? 'Low Time Remaining' : 'Remaining Time'}
                </span>
                <span
                  className={
                    isLowTime
                      ? 'text-rose-600 dark:text-rose-400 font-semibold'
                      : 'text-cyan-600 dark:text-cyan-400'
                  }
                >
                  {formatDuration(timeLeft)} ({Math.round(timePercent)}%)
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isLowTime
                      ? 'bg-gradient-to-r from-amber-500 to-rose-500'
                      : 'bg-gradient-to-r from-cyan-500 to-emerald-400'
                  }`}
                  style={{ width: `${timePercent}%` }}
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                <span>
                  Question {currentIdx + 1} of {activeQuiz.totalQuestions}
                </span>
                <span>
                  {answeredCount}/{activeQuiz.totalQuestions} answered
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-sky-500 transition-all duration-300"
                  style={{ width: `${questionProgressPercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Animated Question & Options Card */}
          <div className="p-5 sm:p-7">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={currentQ.id}
                custom={direction}
                initial={{ opacity: 0, x: direction * 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: direction * -24 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-5"
              >
                <h2 className="font-display text-xl sm:text-2xl font-bold text-slate-900 dark:text-white leading-snug">
                  {currentIdx + 1}. {currentQ.question}
                </h2>

                <div className="space-y-3" role="radiogroup" aria-label="Answer options">
                  {currentQ.options.map((opt, optIdx) => {
                    const isSelected = userAnswers[currentIdx] === optIdx;
                    return (
                      <button
                        key={optIdx}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        onClick={() => handleSelectOption(optIdx)}
                        className={`w-full text-left rounded-xl border px-4 py-3.5 flex items-center gap-3.5 transition-all cursor-pointer ${
                          isSelected
                            ? 'border-cyan-500 bg-cyan-500/12 dark:bg-cyan-500/15 text-slate-900 dark:text-white shadow-[0_0_20px_rgba(34,211,238,0.18)]'
                            : 'border-sky-200 dark:border-slate-700/90 bg-sky-50/70 dark:bg-slate-900/65 text-slate-800 dark:text-slate-200 hover:border-cyan-400/70'
                        }`}
                      >
                        <span
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                            isSelected
                              ? 'border-cyan-500 bg-cyan-500'
                              : 'border-slate-400 dark:border-slate-500 bg-white dark:bg-slate-950'
                          }`}
                        >
                          {isSelected && <span className="w-2 h-2 rounded-full bg-white" />}
                        </span>
                        <span className="text-sm sm:text-base leading-snug">
                          <span className="font-mono text-xs text-slate-500 dark:text-slate-400 mr-2">
                            {OPTION_LETTERS[optIdx]}.
                          </span>
                          {opt}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Bottom Navigation Matching Image 2 */}
            <div className="mt-7 pt-5 border-t border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={currentIdx === 0}
                  onClick={() => goToQuestion(currentIdx - 1)}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 border border-emerald-500/30 hover:bg-emerald-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  Previous
                </button>

                {currentIdx < activeQuiz.totalQuestions - 1 ? (
                  <button
                    type="button"
                    onClick={() => goToQuestion(currentIdx + 1)}
                    className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-colors cursor-pointer"
                  >
                    Next
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => void finalizeQuiz(activeQuiz, userAnswers, timeLeft)}
                    className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-cyan-600 hover:bg-cyan-500 text-white neon-glow-cyan disabled:opacity-60 transition-colors cursor-pointer"
                  >
                    {submitting ? 'Submitting...' : 'Finish Quiz'}
                  </button>
                )}
              </div>

              <button
                type="button"
                disabled={submitting}
                onClick={() => void finalizeQuiz(activeQuiz, userAnswers, timeLeft)}
                className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-300 transition-colors cursor-pointer"
              >
                Submit early ({answeredCount}/{activeQuiz.totalQuestions})
              </button>
            </div>

            {/* Question jump strip */}
            <div className="mt-5 flex flex-wrap gap-1.5">
              {activeQuiz.questions.map((q, idx) => {
                const isCurrent = idx === currentIdx;
                const isAnswered = userAnswers[idx] !== -1;
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => goToQuestion(idx)}
                    className={`w-8 h-8 rounded-lg text-xs font-mono tabular-nums font-semibold transition-colors cursor-pointer ${
                      isCurrent
                        ? 'bg-cyan-600 text-white'
                        : isAnswered
                          ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    );
  }

  // Stage 1: Quiz Configuration
  return (
    <section className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
      <div className="text-center space-y-2">
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
          Quiz Studio
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300">
          Choose your question count and difficulty level, then generate a timed quiz from your PDFs
        </p>
      </div>

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

      <div className="glass-panel rounded-2xl p-6 sm:p-8 space-y-7">
        {/* Number of questions selector */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="question-count-range"
              className="font-display text-base sm:text-lg font-semibold text-slate-900 dark:text-white"
            >
              Number of Questions
            </label>
            <span className="font-mono tabular-nums text-sm font-semibold text-cyan-600 dark:text-cyan-300">
              {numQuestions} questions
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {QUESTION_COUNTS.map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => {
                  setNumQuestions(count);
                  playSelectSound();
                }}
                className={`px-4 py-2 rounded-xl text-sm font-mono tabular-nums font-semibold border transition-all cursor-pointer ${
                  numQuestions === count
                    ? 'border-cyan-500 bg-cyan-600 text-white neon-glow-cyan'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/70 text-slate-700 dark:text-slate-300 hover:border-cyan-500/50'
                }`}
              >
                {count}
              </button>
            ))}
          </div>

          <input
            id="question-count-range"
            type="range"
            min={5}
            max={25}
            step={1}
            value={numQuestions}
            onChange={(e) => setNumQuestions(Number(e.target.value))}
            className="w-full accent-cyan-500 cursor-pointer"
          />
        </div>

        {/* Difficulty selector */}
        <div className="space-y-3">
          <p className="font-display text-base sm:text-lg font-semibold text-slate-900 dark:text-white">
            Difficulty Level
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {DIFFICULTIES.map((d) => {
              const active = difficulty === d.level;
              return (
                <button
                  key={d.level}
                  type="button"
                  onClick={() => {
                    setDifficulty(d.level);
                    playSelectSound();
                  }}
                  className={`rounded-xl border p-4 text-left transition-all cursor-pointer ${
                    active
                      ? 'border-cyan-500 bg-cyan-500/12 dark:bg-cyan-500/15 shadow-[0_0_20px_rgba(34,211,238,0.16)]'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 hover:border-cyan-500/40'
                  }`}
                >
                  <p className="font-display text-base font-semibold text-slate-900 dark:text-white">
                    {d.level}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{d.detail}</p>
                </button>
              );
            })}
          </div>
        </div>

        {quizError && (
          <div
            role="alert"
            className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-300 flex items-start gap-2.5 break-words"
          >
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="min-w-0 break-words">{quizError}</span>
          </div>
        )}

        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-slate-200/80 dark:border-slate-800">
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            {documents.length === 0
              ? 'Upload at least 1 PDF above to unlock quiz generation'
              : `Using ${activeIds.length} active PDF(s) · Timer: ${formatDuration(
                  numQuestions *
                    (DIFFICULTIES.find((d) => d.level === difficulty)?.secPerQ ?? 45),
                )}`}
          </p>

          <button
            type="button"
            disabled={documents.length === 0 || generating}
            onClick={() => void handleGenerate()}
            className="px-6 py-3.5 rounded-xl text-sm sm:text-base font-semibold text-white bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all neon-glow-cyan inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Generating Quiz...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Generate quiz</span>
              </>
            )}
          </button>
        </div>
      </div>
    </section>
  );
}
