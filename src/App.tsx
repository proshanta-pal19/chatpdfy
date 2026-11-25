/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import ChatView from './components/ChatView';
import Footer from './components/Footer';
import HomeView from './components/HomeView';
import Navbar from './components/Navbar';
import ProfileView from './components/ProfileView';
import QuizView from './components/QuizView';
import type {
  AppView,
  ChatMessage,
  PdfDocumentMeta,
  QuizAttempt,
  StudentProfile,
} from './types';
import {
  fetchChatHistory,
  fetchPdfs,
  fetchProfile,
  removePdf,
  uploadPdfs,
} from './utils/api';
import {
  isSoundEnabled,
  playSelectSound,
  playTransitionSound,
  playUploadSuccessSound,
  setSoundEnabled,
} from './utils/sound';

export default function App() {
  const [view, setView] = useState<AppView>('home');
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof document === 'undefined') return true;
    return document.documentElement.classList.contains('dark');
  });
  const [soundOn, setSoundOn] = useState<boolean>(() => isSoundEnabled());

  const [documents, setDocuments] = useState<PdfDocumentMeta[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [activeUploads, setActiveUploads] = useState(0);
  const uploading = activeUploads > 0;
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [profile, setProfile] = useState<StudentProfile>({
    studentId: 'default-scholar',
    displayName: 'Scholar',
    studyGoal: 'Master core concepts and score 90%+ on practice quizzes',
    updatedAt: new Date().toISOString(),
  });
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [docs, chats, profileData] = await Promise.all([
          fetchPdfs(),
          fetchChatHistory(),
          fetchProfile(),
        ]);
        setDocuments(docs);
        setSelectedDocIds(docs.map((d) => d.id));
        setMessages(chats);
        setProfile(profileData.profile);
        setAttempts(profileData.attempts);
      } catch (err) {
        console.error('Initial load error:', err);
      }
    };
    void loadInitialData();
  }, []);

  const handleToggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    try {
      localStorage.setItem('chatpdfy-theme', nextDark ? 'dark' : 'light');
    } catch {
      // ignore storage errors
    }
    playSelectSound();
  };

  const handleToggleSound = () => {
    const next = !soundOn;
    setSoundEnabled(next);
    setSoundOn(next);
    if (next) playSelectSound();
  };

  const handleNavigate = (nextView: AppView) => {
    if (nextView === view) return;
    setView(nextView);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    playTransitionSound();
  };

  const handleUploadFiles = async (files: File[]) => {
    setUploadError(null);
    setActiveUploads((c) => c + files.length);

    let anySuccess = false;
    const errors: string[] = [];

    await Promise.all(
      files.map(async (file) => {
        try {
          const uploaded = await uploadPdfs([file]);
          anySuccess = true;
          setDocuments((prev) => [...uploaded, ...prev]);
          setSelectedDocIds((prev) => [...uploaded.map((d) => d.id), ...prev]);
        } catch (err) {
          errors.push(`${file.name}: ${(err as Error).message || 'Upload failed'}`);
        } finally {
          setActiveUploads((c) => Math.max(0, c - 1));
        }
      }),
    );

    if (anySuccess) {
      playUploadSuccessSound();
    }
    if (errors.length > 0) {
      setUploadError(errors.join(' · '));
    }
  };

  const handleDeleteDoc = async (id: string) => {
    await removePdf(id);
    setDocuments((prev) => prev.filter((d) => d.id !== id));
    setSelectedDocIds((prev) => prev.filter((docId) => docId !== id));
    playSelectSound();
  };

  const handleToggleSelectDoc = (id: string) => {
    setSelectedDocIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
    playSelectSound();
  };

  const handleSelectAllDocs = () => {
    setSelectedDocIds(documents.map((d) => d.id));
    playSelectSound();
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-x-hidden bg-slate-50 text-slate-900 dark:bg-[#060913] dark:text-slate-100 transition-colors duration-200">
      {/* Subtle ambient background gradients */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute -top-32 left-1/4 w-[36rem] h-[36rem] rounded-full bg-cyan-500/10 dark:bg-cyan-500/12 blur-[120px]" />
        <div className="absolute top-1/3 right-1/5 w-[28rem] h-[28rem] rounded-full bg-emerald-500/8 dark:bg-emerald-500/10 blur-[120px]" />
      </div>

      <Navbar
        currentView={view}
        onNavigate={handleNavigate}
        isDark={isDark}
        onToggleTheme={handleToggleTheme}
        soundOn={soundOn}
        onToggleSound={handleToggleSound}
      />

      <main className="flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          >
            {view === 'home' && (
              <HomeView
                onNavigate={handleNavigate}
                documentCount={documents.length}
                quizCount={attempts.length}
              />
            )}

            {view === 'chat' && (
              <ChatView
                documents={documents}
                selectedDocIds={selectedDocIds}
                onToggleSelect={handleToggleSelectDoc}
                onSelectAll={handleSelectAllDocs}
                onUploadFiles={handleUploadFiles}
                onDeleteDoc={handleDeleteDoc}
                uploading={uploading}
                uploadError={uploadError}
                messages={messages}
                onMessagesChange={setMessages}
                onGoToQuiz={() => handleNavigate('quiz')}
              />
            )}

            {view === 'quiz' && (
              <QuizView
                documents={documents}
                selectedDocIds={selectedDocIds}
                onToggleSelect={handleToggleSelectDoc}
                onSelectAll={handleSelectAllDocs}
                onUploadFiles={handleUploadFiles}
                onDeleteDoc={handleDeleteDoc}
                uploading={uploading}
                uploadError={uploadError}
                onAttemptSaved={(attempt) => setAttempts((prev) => [attempt, ...prev])}
              />
            )}

            {view === 'profile' && (
              <ProfileView
                profile={profile}
                attempts={attempts}
                onProfileUpdated={setProfile}
                onAttemptDeleted={(id) =>
                  setAttempts((prev) => prev.filter((item) => item.id !== id))
                }
                onStartQuiz={() => handleNavigate('quiz')}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      <Footer onNavigate={handleNavigate} />
    </div>
  );
}
