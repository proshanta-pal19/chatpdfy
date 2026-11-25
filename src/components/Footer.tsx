import { BotMessageSquare } from 'lucide-react';
import type { AppView } from '../types';

interface FooterProps {
  onNavigate: (view: AppView) => void;
}

export default function Footer({ onNavigate }: FooterProps) {
  return (
    <footer className="no-print mt-auto border-t border-slate-200/80 dark:border-slate-800/80 bg-white/40 dark:bg-[#050811]/60">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500 dark:text-slate-400">
        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className="inline-flex items-center gap-2 font-display font-semibold text-slate-800 dark:text-slate-200 hover:text-cyan-600 dark:hover:text-cyan-300 transition-colors cursor-pointer"
          >
            <BotMessageSquare className="w-5 h-5 text-cyan-600 dark:text-cyan-400 shrink-0" />
            <span>ChatPDFy</span>
          </button>
          <span aria-hidden="true">·</span>
          <span>Study with strict PDF citations &amp; adaptive quizzes</span>
        </div>

        <div className="flex items-center gap-6">
          <button
            type="button"
            onClick={() => onNavigate('chat')}
            className="hover:text-cyan-600 dark:hover:text-cyan-300 transition-colors cursor-pointer"
          >
            Chat
          </button>
          <button
            type="button"
            onClick={() => onNavigate('quiz')}
            className="hover:text-cyan-600 dark:hover:text-cyan-300 transition-colors cursor-pointer"
          >
            Quiz
          </button>
        </div>
      </div>
    </footer>
  );
}
