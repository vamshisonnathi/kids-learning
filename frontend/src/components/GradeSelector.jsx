import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const GRADES = [
  { value: 3, label: '3rd', color: 'from-teal-400 to-emerald-500', ring: 'ring-emerald-400/50' },
  { value: 4, label: '4th', color: 'from-blue-400 to-indigo-500', ring: 'ring-blue-400/50' },
  { value: 5, label: '5th', color: 'from-amber-400 to-orange-500', ring: 'ring-amber-400/50' },
  { value: 6, label: '6th', color: 'from-rose-400 to-pink-500', ring: 'ring-rose-400/50' },
  { value: 7, label: '7th', color: 'from-violet-400 to-purple-500', ring: 'ring-violet-400/50' },
  { value: 8, label: '8th', color: 'from-cyan-400 to-sky-500', ring: 'ring-cyan-400/50' },
];

const GradeSelector = () => {
  const { currentUser, updateUser } = useAuth();
  const navigate = useNavigate();
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    if (!selected || saving) return;
    setSaving(true);
    try {
      await axios.patch(`${API}/students/${currentUser.id}/grade`, { grade: selected });
      updateUser({ grade: selected });
      toast.success(`Grade ${selected} selected!`);
      navigate('/student/diagnostic');
    } catch (e) {
      toast.error('Failed to save grade');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex flex-col items-center justify-center px-6" data-testid="grade-selector">
      <div className="text-center max-w-xl mx-auto">
        <h1 className="text-3xl sm:text-4xl font-black text-white mb-3">
          What grade are you in?
        </h1>
        <p className="text-white/60 mb-10">
          We'll customize your adventure based on your grade level.
        </p>

        <div className="grid grid-cols-3 gap-4 max-w-md mx-auto mb-10">
          {GRADES.map((g) => (
            <button
              key={g.value}
              onClick={() => setSelected(g.value)}
              className={`relative p-6 rounded-2xl border-2 transition-all duration-200 ${
                selected === g.value
                  ? `border-white bg-gradient-to-br ${g.color} ring-4 ${g.ring} scale-105 shadow-xl`
                  : 'border-white/20 bg-white/5 hover:bg-white/10 hover:border-white/40'
              }`}
              data-testid={`grade-${g.value}`}
            >
              <span className={`text-4xl font-black ${
                selected === g.value ? 'text-white' : 'text-white/80'
              }`}>
                {g.label}
              </span>
              <p className={`text-sm mt-1 ${
                selected === g.value ? 'text-white/90' : 'text-white/40'
              }`}>
                Grade
              </p>
            </button>
          ))}
        </div>

        <Button
          onClick={handleConfirm}
          disabled={!selected || saving}
          className="h-14 px-10 text-lg font-bold bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-500 hover:to-orange-500 text-slate-900 rounded-2xl shadow-lg transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
          data-testid="grade-confirm-btn"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
          {selected ? `Let's Go!` : 'Pick your grade'}
        </Button>
      </div>
    </div>
  );
};

export default GradeSelector;
