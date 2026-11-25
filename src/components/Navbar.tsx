import { BotMessageSquare, Moon, Sun, Volume2, VolumeX } from 'lucide-react';
import type { AppView } from '../types';

interface NavbarProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  isDark: boolean;
  onToggleTheme: () => void;
  soundOn: boolean;
  onToggleSound: () => void;
}

export default function Navbar({
  currentView,
  onNavigate,
  isDark,
  onToggleTheme,
  soundOn,
  onToggleSound,
}: NavbarProps) {
  return (
    <header className="no-print sticky top-0 z-40 border-b border-slate-200/80 dark:border-cyan-500/15 bg-white/80 dark:bg-[#060913]/80 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4 sm:gap-8">
        <button
          type="button"
          onClick={() => onNavigate('home')}
          className="font-display text-xl font-bold tracking-tight text-slate-900 dark:text-white hover:text-cyan-600 dark:hover:text-cyan-300 transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-cyan-400 rounded-md"
        >
          <BotMessageSquare className="w-5 h-5 text-cyan-600 dark:text-cyan-400 shrink-0" />
          <span>ChatPDFy</span>
        </button>

        <nav aria-label="Primary" className="flex items-center gap-6 sm:gap-10">
          <button
            type="button"
            onClick={() => onNavigate('chat')}
            className={`relative py-1.5 text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-cyan-400 rounded-sm ${
              currentView === 'chat'
                ? 'text-cyan-600 dark:text-cyan-300'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Chat
            {currentView === 'chat' && (
              <span className="absolute left-0 right-0 -bottom-0.5 h-0.5 rounded-full bg-cyan-500 dark:bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)]" />
            )}
          </button>

          <button
            type="button"
            onClick={() => onNavigate('quiz')}
            className={`relative py-1.5 text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-cyan-400 rounded-sm ${
              currentView === 'quiz'
                ? 'text-cyan-600 dark:text-cyan-300'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Quiz
            {currentView === 'quiz' && (
              <span className="absolute left-0 right-0 -bottom-0.5 h-0.5 rounded-full bg-cyan-500 dark:bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)]" />
            )}
          </button>
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onToggleSound}
            aria-label={soundOn ? 'Mute sound effects' : 'Enable sound effects'}
            title={soundOn ? 'Sound effects on' : 'Sound effects muted'}
            className="h-10 w-10 inline-flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-900/70 text-slate-600 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-300 hover:border-cyan-500/40 transition-colors cursor-pointer"
          >
            {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            title={isDark ? 'Light mode' : 'Dark mode'}
            className="h-10 w-10 inline-flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-900/70 text-slate-600 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-300 hover:border-cyan-500/40 transition-colors cursor-pointer"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </header>
  );
}
