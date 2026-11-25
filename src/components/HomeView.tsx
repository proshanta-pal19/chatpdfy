import {
  ArrowRight,
  BookOpen,
  BrainCircuit,
  FileSearch,
  ShieldCheck,
  Timer,
  TrendingUp,
} from 'lucide-react';
import { useState } from 'react';
import type { AppView } from '../types';

interface HomeViewProps {
  onNavigate: (view: AppView) => void;
  documentCount: number;
  quizCount: number;
}

const FEATURES = [
  {
    icon: FileSearch,
    title: 'Multi-PDF Extraction & Grounding',
    description:
      'Upload one lecture deck or an entire unit of course PDFs at once. Every answer traces back to the exact document name, page number, and quoted passage.',
  },
  {
    icon: ShieldCheck,
    title: 'Zero-Hallucination Safeguard',
    description:
      'Questions outside your notes never trigger guesswork. When evidence is missing, ChatPDFy clearly reports "Not Found in the document" so your facts stay accurate.',
  },
  {
    icon: Timer,
    title: 'Adaptive Timed Quizzes',
    description:
      'Pick 5 to 25 questions across Easy, Medium, or Hard difficulty. Practice under a live visual countdown and unlock PDF-backed explanations after submission.',
  },
  {
    icon: TrendingUp,
    title: 'Performance History & Reports',
    description:
      'Track scores across study sessions in your profile dashboard and download clean, structured quiz reports for offline review before exams.',
  },
];

export default function HomeView({ onNavigate, documentCount, quizCount }: HomeViewProps) {
  const [imgError, setImgError] = useState(false);

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col">
      {/* Hero Section */}
      <section className="max-w-6xl mx-auto w-full px-4 sm:px-6 pt-10 sm:pt-16 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
          <div className="lg:col-span-6 flex flex-col justify-center space-y-6">
            <div className="space-y-4">
              <p className="text-xs sm:text-sm font-medium tracking-wide text-cyan-600 dark:text-cyan-400">
                Document-Grounded Study Workspace
              </p>
              <h1 className="font-display text-3xl sm:text-4xl lg:text-[2.65rem] font-bold tracking-tight text-slate-900 dark:text-white leading-[1.15] [text-wrap:balance]">
                Turn static documents into interactive conversations. Instant insights from any document.
              </h1>
              <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl">
                Stop scrolling through hundreds of lecture slides for a single definition. Upload
                your PDFs to ask source-verified questions or generate an exam-ready quiz in
                seconds.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4 pt-1">
              <button
                type="button"
                onClick={() => onNavigate('chat')}
                className="px-6 py-3.5 rounded-xl text-sm sm:text-base font-semibold text-white bg-cyan-600 hover:bg-cyan-500 transition-all neon-glow-cyan inline-flex items-center gap-2 cursor-pointer whitespace-nowrap"
              >
                <span>Quick Start</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => onNavigate('quiz')}
                className="px-5 py-3.5 rounded-xl text-sm sm:text-base font-semibold border border-slate-300 dark:border-cyan-500/30 text-slate-800 dark:text-slate-100 hover:border-cyan-500/60 hover:text-cyan-600 dark:hover:text-cyan-300 transition-colors cursor-pointer whitespace-nowrap"
              >
                Open Quiz Studio
              </button>
            </div>

            <div className="pt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-mono tabular-nums">
              <span>{documentCount} PDFs indexed</span>
              <span aria-hidden="true">·</span>
              <span>{quizCount} quizzes completed</span>
              <span aria-hidden="true">·</span>
              <span>Page-level citations</span>
            </div>
          </div>

          <div className="lg:col-span-6 flex">
            <div className="glass-panel rounded-3xl p-2.5 w-full flex overflow-hidden relative">
              {!imgError ? (
                <img
                  src="/assets/aistudio/image_37d2ce5d.png"
                  alt="AI assistant interacting with glowing holographic document cards and chat insights"
                  referrerPolicy="no-referrer"
                  onError={() => setImgError(true)}
                  className="w-full h-72 sm:h-96 lg:h-full object-cover rounded-2xl"
                />
              ) : (
                <div className="w-full h-72 sm:h-96 lg:h-full rounded-2xl bg-gradient-to-br from-slate-900 via-cyan-950/50 to-emerald-950/40 flex flex-col items-center justify-center p-8 text-center">
                  <BookOpen className="w-12 h-12 text-cyan-400 mb-3" />
                  <p className="font-display text-lg font-semibold text-white">
                    PDF Intelligence & Active Recall
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Clean 4-column workflow strip */}
        <div className="mt-10 glass-panel rounded-2xl grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-200/80 dark:divide-slate-800/80">
          <div className="p-5">
            <p className="text-xs text-slate-500 dark:text-slate-400">Step 01</p>
            <p className="mt-1 font-display text-base font-semibold text-slate-900 dark:text-white">
              Upload 1+ PDFs
            </p>
          </div>
          <div className="p-5">
            <p className="text-xs text-slate-500 dark:text-slate-400">Step 02</p>
            <p className="mt-1 font-display text-base font-semibold text-slate-900 dark:text-white">
              Ask Grounded Questions
            </p>
          </div>
          <div className="p-5">
            <p className="text-xs text-slate-500 dark:text-slate-400">Step 03</p>
            <p className="mt-1 font-display text-base font-semibold text-slate-900 dark:text-white">
              Generate Timed Quiz
            </p>
          </div>
          <div className="p-5">
            <p className="text-xs text-slate-500 dark:text-slate-400">Step 04</p>
            <p className="mt-1 font-display text-base font-semibold text-slate-900 dark:text-white">
              Review & Export Score
            </p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-12 sm:py-16 border-t border-slate-200/70 dark:border-slate-800/70">
        <div className="max-w-2xl mb-10">
          <p className="text-xs sm:text-sm font-medium text-cyan-600 dark:text-cyan-400 mb-2">
            Built for Focused Study
          </p>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white [text-wrap:balance]">
            Turn passive reading into active recall without switching tools.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {FEATURES.map((feat) => {
            const Icon = feat.icon;
            return (
              <article
                key={feat.title}
                className="glass-panel rounded-2xl p-6 sm:p-7 transition-transform duration-200 hover:-translate-y-0.5"
              >
                <div className="w-11 h-11 rounded-xl bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center text-cyan-600 dark:text-cyan-300 mb-4">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white mb-2">
                  {feat.title}
                </h3>
                <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                  {feat.description}
                </p>
              </article>
            );
          })}
        </div>

        <div className="mt-10 glass-panel rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-600 dark:text-emerald-300 shrink-0">
              <BrainCircuit className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
                Ready to test your understanding?
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                Jump into Chat to upload your study PDFs, or head straight to the Quiz Studio.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('chat')}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-cyan-600 hover:bg-cyan-500 transition-colors cursor-pointer whitespace-nowrap"
            >
              Start Studying
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
