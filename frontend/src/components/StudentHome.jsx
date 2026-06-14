import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';
import { Zap, Map, Target, Clock, BarChart3 } from 'lucide-react';

const StudentHome = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-[calc(100vh-64px)] flex flex-col items-center justify-center px-6 relative overflow-hidden" data-testid="student-home">
      {/* Animated background particles */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="particle particle-1" />
        <div className="particle particle-2" />
        <div className="particle particle-3" />
        <div className="particle particle-4" />
      </div>

      {/* Hero content */}
      <div className="relative z-10 text-center max-w-2xl mx-auto">
        {/* Greeting */}
        <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-5 py-2 mb-8 border border-white/20">
          <span className="text-2xl">{currentUser?.avatar}</span>
          <span className="text-white/90 font-medium">Welcome back, {currentUser?.name?.split(' ')[0]}</span>
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-tight mb-6 tracking-tight">
          Ready for the<br />
          <span className="bg-gradient-to-r from-amber-300 via-yellow-300 to-orange-300 bg-clip-text text-transparent">
            Math STAAR?
          </span>
        </h1>

        <p className="text-lg sm:text-xl text-white/80 mb-12 max-w-lg mx-auto leading-relaxed">
          Let's find your hidden gaps in just 5 questions. Then we'll build your personalized adventure map.
        </p>

        {/* Diagnostic Info Cards */}
        <div className="flex items-center justify-center gap-6 mb-10">
          <div className="flex items-center gap-2 text-white/70">
            <Clock className="w-4 h-4" />
            <span className="text-sm font-medium">5 minutes</span>
          </div>
          <div className="w-px h-4 bg-white/30" />
          <div className="flex items-center gap-2 text-white/70">
            <Target className="w-4 h-4" />
            <span className="text-sm font-medium">5 questions</span>
          </div>
          <div className="w-px h-4 bg-white/30" />
          <div className="flex items-center gap-2 text-white/70">
            <BarChart3 className="w-4 h-4" />
            <span className="text-sm font-medium">Personalized</span>
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col items-center gap-4">
          <Button
            onClick={() => navigate('/student/diagnostic')}
            className="h-16 px-12 text-lg font-bold bg-gradient-to-r from-amber-400 via-yellow-400 to-orange-400 hover:from-amber-500 hover:via-yellow-500 hover:to-orange-500 text-slate-900 rounded-2xl shadow-[0_0_40px_rgba(251,191,36,0.3)] hover:shadow-[0_0_60px_rgba(251,191,36,0.5)] transition-all duration-300 hover:scale-105"
            data-testid="start-diagnostic-btn"
          >
            <Zap className="w-6 h-6 mr-3" />
            Start 5-Minute Diagnostic
          </Button>

          <Button
            variant="ghost"
            onClick={() => navigate('/student/map')}
            className="text-white/60 hover:text-white hover:bg-white/10 font-medium px-8 py-3"
            data-testid="skip-to-map-btn"
          >
            <Map className="w-4 h-4 mr-2" />
            Skip to Map
          </Button>
        </div>
      </div>
    </div>
  );
};

export default StudentHome;
