import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Progress } from './ui/progress';
import axios from 'axios';
import { toast } from 'sonner';
import {
  ChevronRight, CheckCircle, XCircle, Loader2, Target
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const DiagnosticFlow = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const grade = currentUser?.grade || 5;
  const [problems, setProblems] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showFeedback, setShowFeedback] = useState(null);

  useEffect(() => {
    loadProblems();
  }, []);

  const loadProblems = async () => {
    try {
      const res = await axios.get(`${API}/diagnostic/problems/${grade}`);
      if (res.data.problems && res.data.problems.length > 0) {
        setProblems(res.data.problems);
      } else {
        toast.error(`No problems available for grade ${grade} yet`);
        navigate('/student/home');
      }
    } catch (error) {
      console.error('Failed to load diagnostic problems:', error);
      toast.error('Could not load diagnostic');
    } finally {
      setLoading(false);
    }
  };

  const currentProblem = problems[currentIndex];
  const totalQuestions = problems.length || 5;
  const progressPercent = ((currentIndex) / totalQuestions) * 100;

  const handleSubmit = useCallback(() => {
    if (!answer.trim() || submitting) return;
    setSubmitting(true);

    const isCorrect = answer.trim().toLowerCase() === currentProblem.answer.trim().toLowerCase();

    const result = {
      node_id: currentProblem.node_id,
      problem_id: currentProblem.problem_id,
      skill_name: currentProblem.skill_name,
      student_answer: answer.trim(),
      correct_answer: currentProblem.answer,
      is_correct: isCorrect,
    };

    setResults(prev => [...prev, result]);
    setShowFeedback(isCorrect ? 'correct' : 'incorrect');

    // Brief flash of feedback then advance
    setTimeout(async () => {
      setShowFeedback(null);
      setAnswer('');
      setSubmitting(false);

      if (currentIndex + 1 >= totalQuestions) {
        // All done — persist results to DB then navigate to map
        const allResults = [...results, result];
        
        // Submit diagnostic to backend
        try {
          await axios.post(`${API}/diagnostic/submit`, {
            student_id: currentUser?.id,
            results: allResults.map(r => ({ node_id: r.node_id, is_correct: r.is_correct }))
          });
        } catch (e) {
          console.error('Failed to persist diagnostic:', e);
        }
        
        navigate('/student/map', { state: { diagnosticResults: allResults } });
      } else {
        setCurrentIndex(prev => prev + 1);
      }
    }, 800);
  }, [answer, submitting, currentProblem, currentIndex, totalQuestions, results, navigate]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center" data-testid="diagnostic-loading">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-amber-400 animate-spin mx-auto mb-4" />
          <p className="text-white/80 text-lg">Preparing your diagnostic...</p>
        </div>
      </div>
    );
  }

  if (!currentProblem) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center">
        <p className="text-white/80">No problems available. Try again later.</p>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-64px)] flex flex-col items-center justify-center px-6" data-testid="diagnostic-flow">
      {/* Top bar: progress */}
      <div className="fixed top-16 left-0 right-0 z-40 bg-sky-900/80 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-2xl mx-auto px-6 py-3 flex items-center gap-4">
          <div className="flex items-center gap-2 text-white/70 text-sm font-medium shrink-0">
            <Target className="w-4 h-4 text-amber-400" />
            Question {currentIndex + 1} of {totalQuestions}
          </div>
          <Progress value={progressPercent} className="h-2 flex-1 bg-white/10" />
          <span className="text-xs text-white/50 shrink-0">{Math.round(progressPercent)}%</span>
        </div>
      </div>

      {/* Feedback overlay */}
      {showFeedback && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center pointer-events-none transition-opacity duration-300 ${showFeedback ? 'opacity-100' : 'opacity-0'}`}>
          <div className={`rounded-full p-8 ${showFeedback === 'correct' ? 'bg-emerald-500/30 backdrop-blur-sm' : 'bg-red-500/30 backdrop-blur-sm'}`}>
            {showFeedback === 'correct' ? (
              <CheckCircle className="w-24 h-24 text-emerald-400" />
            ) : (
              <XCircle className="w-24 h-24 text-red-400" />
            )}
          </div>
        </div>
      )}

      {/* Question card */}
      <div className="w-full max-w-2xl mt-20" data-testid="diagnostic-card">
        {/* Skill tag */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs font-semibold uppercase tracking-widest text-amber-400/80">
            {currentProblem.teks}
          </span>
          <span className="text-white/30">|</span>
          <span className="text-xs text-white/50">{currentProblem.skill_name}</span>
        </div>

        {/* Question */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-8 mb-6">
          <p className="text-white text-xl sm:text-2xl font-semibold leading-relaxed" data-testid="diagnostic-question">
            {currentProblem.question}
          </p>

          {/* Image if available */}
          {currentProblem.image_url && (
            <div className="mt-6 flex justify-center" data-testid="diagnostic-image">
              <img
                src={currentProblem.image_url}
                alt="Problem illustration"
                className="max-h-48 rounded-xl border border-white/10"
              />
            </div>
          )}
        </div>

        {/* Answer input */}
        <div className="flex gap-3">
          <Input
            value={answer}
            onChange={e => setAnswer(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your answer..."
            className="h-14 text-lg bg-white/10 border-white/20 text-white placeholder:text-white/30 rounded-xl focus:border-amber-400 focus:ring-amber-400/30"
            autoFocus
            disabled={submitting}
            data-testid="diagnostic-answer-input"
          />
          <Button
            onClick={handleSubmit}
            disabled={!answer.trim() || submitting}
            className="h-14 px-8 bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-500 hover:to-orange-500 text-slate-900 font-bold rounded-xl text-lg transition-all duration-200 disabled:opacity-40"
            data-testid="diagnostic-submit-btn"
          >
            {currentIndex + 1 >= totalQuestions ? 'Finish' : 'Next'}
            <ChevronRight className="w-5 h-5 ml-1" />
          </Button>
        </div>

        {/* Question dots */}
        <div className="flex items-center justify-center gap-3 mt-8">
          {problems.map((prob, idx) => {
            const result = results[idx];
            const isCurrent = idx === currentIndex;
            return (
              <div
                key={prob.node_id}
                className={`w-3 h-3 rounded-full transition-all duration-300 ${
                  result
                    ? result.is_correct
                      ? 'bg-emerald-400 scale-110'
                      : 'bg-red-400 scale-110'
                    : isCurrent
                      ? 'bg-amber-400 scale-125 ring-2 ring-amber-400/50'
                      : 'bg-white/20'
                }`}
                data-testid={`dot-${idx}`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default DiagnosticFlow;
