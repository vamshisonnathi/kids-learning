import { Outlet, useNavigate, NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/button';
import { 
  LogOut, Map, Home, Zap
} from 'lucide-react';

const StudentLayout = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navLinkClass = ({ isActive }) =>
    `px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive ? 'bg-white/20 text-white' : 'text-white/70 hover:text-white hover:bg-white/10'
    }`;

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-400 to-blue-600">
      {/* Top Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-sky-900/90 to-transparent backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Map className="w-6 h-6" />
              MathQuest
            </h1>
            
            <div className="hidden md:flex items-center gap-1">
              <NavLink to="/student/home" className={navLinkClass} data-testid="nav-home">
                <span className="flex items-center gap-1.5"><Home className="w-4 h-4" /> Home</span>
              </NavLink>
              <NavLink to="/student/diagnostic" className={navLinkClass} data-testid="nav-diagnostic">
                <span className="flex items-center gap-1.5"><Zap className="w-4 h-4" /> Diagnostic</span>
              </NavLink>
              <NavLink to="/student/map" className={navLinkClass} data-testid="nav-map">
                <span className="flex items-center gap-1.5"><Map className="w-4 h-4" /> Map</span>
              </NavLink>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-white/20 rounded-full px-3 py-1.5">
              <span className="text-2xl">{currentUser?.avatar}</span>
              <span className="text-white font-medium text-sm hidden sm:block">
                {currentUser?.name}
              </span>
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-white hover:bg-white/20"
              data-testid="logout-btn"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </nav>
      
      {/* Main Content */}
      <main className="pt-16">
        <Outlet />
      </main>
    </div>
  );
};

export default StudentLayout;
