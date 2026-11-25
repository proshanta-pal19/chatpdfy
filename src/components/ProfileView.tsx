import {
  Award,
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  Edit3,
  Trash2,
  User,
} from 'lucide-react';
import { useState, type FormEvent } from 'react';
import type { QuizAttempt, StudentProfile } from '../types';
import {
  deleteQuizAttempt,
  downloadQuizReport,
  formatDuration,
  updateProfile,
} from '../utils/api';
import { playSelectSound } from '../utils/sound';

interface ProfileViewProps {
  profile: StudentProfile;
  attempts: QuizAttempt[];
  onProfileUpdated: (profile: StudentProfile) => void;
  onAttemptDeleted: (id: string) => void;
  onStartQuiz: () => void;
}

export default function ProfileView({
  profile,
  attempts,
  onProfileUpdated,
  onAttemptDeleted,
  onStartQuiz,
}: ProfileViewProps) {
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [studyGoal, setStudyGoal] = useState(profile.studyGoal);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const totalQuizzes = attempts.length;
  const averageScore =
    totalQuizzes > 0
      ? Math.round(attempts.reduce((acc, a) => acc + a.scorePercent, 0) / totalQuizzes)
      : 0;
  const bestScore =
    totalQuizzes > 0 ? Math.max(...attempts.map((a) => a.scorePercent)) : 0;
  const totalQuestionsAnswered = attempts.reduce((acc, a) => acc + a.totalQuestions, 0);

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await updateProfile({ displayName, studyGoal });
      onProfileUpdated(updated);
      setEditing(false);
      playSelectSound();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteQuizAttempt(id);
    onAttemptDeleted(id);
    playSelectSound();
  };

  return (
    <section className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
      {/* Profile Header */}
      <div className="glass-panel rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex items-start gap-4 flex-1">
          <div className="w-14 h-14 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-600 dark:text-cyan-300 shrink-0">
            <User className="w-7 h-7" />
          </div>

          {!editing ? (
            <div className="space-y-1">
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
                {profile.displayName}
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-300">{profile.studyGoal}</p>
            </div>
          ) : (
            <form onSubmit={handleSaveProfile} className="space-y-3 flex-1 max-w-lg">
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                className="w-full h-10 px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white"
              />
              <input
                type="text"
                value={studyGoal}
                onChange={(e) => setStudyGoal(e.target.value)}
                placeholder="Your study goal"
                className="w-full h-10 px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white"
              />
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{saving ? 'Saving...' : 'Save'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>

        {!editing && (
          <button
            type="button"
            onClick={() => {
              setDisplayName(profile.displayName);
              setStudyGoal(profile.studyGoal);
              setEditing(true);
            }}
            className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200 hover:border-cyan-500/50 inline-flex items-center gap-2 shrink-0 cursor-pointer"
          >
            <Edit3 className="w-4 h-4" />
            <span>Edit Profile</span>
          </button>
        )}
      </div>

      {/* KPI Metrics Strip */}
      <div className="glass-panel rounded-2xl grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-200/80 dark:divide-slate-800/80">
        <div className="p-5 sm:p-6">
          <p className="text-xs text-slate-500 dark:text-slate-400">Quizzes Completed</p>
          <p className="mt-2 font-display text-3xl font-bold tabular-nums text-slate-900 dark:text-white">
            {totalQuizzes}
          </p>
        </div>
        <div className="p-5 sm:p-6">
          <p className="text-xs text-slate-500 dark:text-slate-400">Average Score</p>
          <p className="mt-2 font-display text-3xl font-bold tabular-nums text-cyan-600 dark:text-cyan-300">
            {averageScore}%
          </p>
        </div>
        <div className="p-5 sm:p-6">
          <p className="text-xs text-slate-500 dark:text-slate-400">Best Score</p>
          <p className="mt-2 font-display text-3xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
            {bestScore}%
          </p>
        </div>
        <div className="p-5 sm:p-6">
          <p className="text-xs text-slate-500 dark:text-slate-400">Questions Answered</p>
          <p className="mt-2 font-display text-3xl font-bold tabular-nums text-slate-900 dark:text-white">
            {totalQuestionsAnswered}
          </p>
        </div>
      </div>

      {/* Recent Performance Trend Bar Chart */}
      {attempts.length > 0 && (
        <div className="glass-panel rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
              Recent Score Trend
            </h2>
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
              Last {Math.min(10, attempts.length)} quizzes
            </span>
          </div>

          <div className="h-36 flex items-end gap-3 pt-4">
            {attempts
              .slice(0, 10)
              .reverse()
              .map((a) => (
                <div key={a.id} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
                  <span className="text-[11px] font-mono tabular-nums text-slate-600 dark:text-slate-300">
                    {a.scorePercent}%
                  </span>
                  <div className="w-full h-24 rounded-lg bg-slate-200/70 dark:bg-slate-800/80 flex items-end overflow-hidden">
                    <div
                      className={`w-full rounded-t-md transition-all duration-300 ${
                        a.scorePercent >= 75
                          ? 'bg-gradient-to-t from-emerald-600 to-cyan-400'
                          : a.scorePercent >= 50
                            ? 'bg-gradient-to-t from-cyan-600 to-sky-400'
                            : 'bg-gradient-to-t from-rose-600 to-amber-400'
                      }`}
                      style={{ height: `${Math.max(8, a.scorePercent)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate w-full text-center">
                    {a.difficulty}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Past Quiz Attempts List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
            Past Quiz Performance
          </h2>
          <button
            type="button"
            onClick={onStartQuiz}
            className="text-sm font-semibold text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
          >
            Take another quiz
          </button>
        </div>

        {attempts.length === 0 ? (
          <div className="glass-panel rounded-2xl p-10 text-center space-y-4">
            <Award className="w-10 h-10 text-slate-400 mx-auto" />
            <div className="space-y-1">
              <p className="font-display text-lg font-semibold text-slate-900 dark:text-white">
                No quizzes completed yet
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Upload a study PDF and complete a quiz to track your scores and review explanations
                here.
              </p>
            </div>
            <button
              type="button"
              onClick={onStartQuiz}
              className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold cursor-pointer"
            >
              Go to Quiz Studio
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {attempts.map((attempt) => {
              const isExpanded = expandedId === attempt.id;
              return (
                <article key={attempt.id} className="glass-panel rounded-2xl overflow-hidden">
                  <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                      <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white truncate">
                        {attempt.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                        {attempt.difficulty} · {attempt.correctCount}/{attempt.totalQuestions}{' '}
                        correct · {formatDuration(attempt.timeSpentSeconds)} ·{' '}
                        {new Date(attempt.completedAt).toLocaleDateString()}
                      </p>
                      {attempt.documentNames.length > 0 && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          PDF: {attempt.documentNames.join(', ')}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                      <span
                        className={`font-display text-2xl font-bold tabular-nums mr-2 ${
                          attempt.scorePercent >= 75
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : attempt.scorePercent >= 50
                              ? 'text-cyan-600 dark:text-cyan-300'
                              : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {attempt.scorePercent}%
                      </span>

                      <button
                        type="button"
                        onClick={() => downloadQuizReport(attempt)}
                        title="Download quiz result PDF"
                        className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-cyan-500/50 inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download PDF</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : attempt.id)}
                        className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-cyan-500/50 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <span>{isExpanded ? 'Hide Review' : 'Review'}</span>
                        {isExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => void handleDelete(attempt.id)}
                        aria-label={`Delete ${attempt.title}`}
                        className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-5 sm:px-6 pb-6 pt-4 border-t border-slate-200/80 dark:border-slate-800 space-y-4 bg-slate-50/60 dark:bg-slate-950/40">
                      {attempt.questions.map((q, idx) => {
                        const userIdx = attempt.userAnswers[idx];
                        const isCorrect = userIdx === q.correctIndex;
                        return (
                          <div
                            key={q.id}
                            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 p-4 space-y-2 text-sm"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="font-semibold text-slate-900 dark:text-white">
                                {idx + 1}. {q.question}
                              </p>
                              <span
                                className={`text-xs font-semibold shrink-0 ${
                                  isCorrect
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-rose-600 dark:text-rose-400'
                                }`}
                              >
                                {isCorrect ? 'Correct' : 'Incorrect'}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-300">
                              Correct Answer: <strong>{q.options[q.correctIndex]}</strong>
                              {!isCorrect && userIdx >= 0 && q.options[userIdx]
                                ? ` · Your Pick: ${q.options[userIdx]}`
                                : ''}
                            </p>
                            <div className="text-xs text-slate-600 dark:text-slate-300 flex items-start gap-1.5 pt-1">
                              <BookOpen className="w-3.5 h-3.5 text-cyan-500 shrink-0 mt-0.5" />
                              <div>
                                <span className="font-semibold text-cyan-600 dark:text-cyan-400">
                                  {q.sourceDocument} (Page {q.sourcePage}):{' '}
                                </span>
                                {q.explanation}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
