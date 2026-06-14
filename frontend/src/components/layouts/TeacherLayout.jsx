import { Outlet, useNavigate, NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/button';
import { 
  LogOut, LayoutDashboard, Users, BarChart3, Settings, BookOpen
} from 'lucide-react';

const TeacherLayout = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { to: '/teacher', icon: LayoutDashboard, label: 'Dashboard', end: true },
    { to: '/teacher/students', icon: Users, label: 'Students' },
  ];

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Top Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-blue-600" />
              MathQuest
              <span className="text-sm font-normal text-slate-500 ml-2">Teacher</span>
            </h1>
            
            <div className="hidden md:flex items-center gap-1">
              {navItems.map(({ to, icon: Icon, label, end }) => (
                <NavLink 
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) => 
                    `px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
                      isActive 
                        ? 'bg-blue-50 text-blue-700' 
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`
                  }
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </NavLink>
              ))}
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-slate-100 rounded-full px-3 py-1.5">
              <span className="text-xl">{currentUser?.avatar}</span>
              <span className="text-slate-700 font-medium text-sm hidden sm:block">
                {currentUser?.name}
              </span>
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              data-testid="logout-btn"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </nav>
      
      {/* Main Content */}
      <main className="pt-20 pb-8 px-4">
        <div className="max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default TeacherLayout;
