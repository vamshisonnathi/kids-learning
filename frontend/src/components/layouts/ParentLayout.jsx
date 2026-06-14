import { Outlet, useNavigate, NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/button';
import { 
  LogOut, Home, User, BarChart3, MessageSquare, Settings
} from 'lucide-react';

const ParentLayout = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const sidebarItems = [
    { to: '/parent', icon: Home, label: 'Home', end: true },
    { to: '/parent/child', icon: User, label: 'My Child' },
    { to: '/parent/progress', icon: BarChart3, label: 'Progress' },
    { to: '/parent/messages', icon: MessageSquare, label: 'Messages' },
    { to: '/parent/settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 bottom-0 w-64 bg-white border-r border-slate-200 flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-slate-100">
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Home className="w-6 h-6 text-purple-600" />
            MathQuest
          </h1>
          <p className="text-sm text-slate-500 mt-1">Parent Portal</p>
        </div>
        
        {/* Navigation */}
        <nav className="flex-1 p-4">
          <ul className="space-y-1">
            {sidebarItems.map(({ to, icon: Icon, label, end }) => (
              <li key={to}>
                <NavLink 
                  to={to}
                  end={end}
                  className={({ isActive }) => 
                    `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                      isActive 
                        ? 'bg-purple-50 text-purple-700' 
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`
                  }
                >
                  <Icon className="w-5 h-5" />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        
        {/* User & Logout */}
        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">{currentUser?.avatar}</span>
            <div>
              <p className="font-medium text-slate-800 text-sm">{currentUser?.name}</p>
              <p className="text-xs text-slate-500">Parent Account</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            className="w-full"
            data-testid="logout-btn"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </aside>
      
      {/* Main Content */}
      <main className="flex-1 ml-64 p-8">
        <Outlet />
      </main>
    </div>
  );
};

export default ParentLayout;
