import { Outlet, useNavigate, NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/button';
import { 
  LogOut, Briefcase, Building, Users, FileText, TrendingUp, Calendar
} from 'lucide-react';

const SalesLayout = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const sidebarItems = [
    { to: '/sales', icon: TrendingUp, label: 'Dashboard', end: true },
    { to: '/sales/districts', icon: Building, label: 'Districts' },
    { to: '/sales/pilots', icon: Users, label: 'Pilots' },
    { to: '/sales/contracts', icon: FileText, label: 'Contracts' },
    { to: '/sales/calendar', icon: Calendar, label: 'Calendar' },
  ];

  return (
    <div className="min-h-screen bg-amber-50 flex">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 bottom-0 w-64 bg-white border-r border-amber-200 flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-amber-100">
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-amber-600" />
            MathQuest
          </h1>
          <p className="text-sm text-slate-500 mt-1">Sales Portal</p>
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
                        ? 'bg-amber-100 text-amber-800' 
                        : 'text-slate-600 hover:text-slate-900 hover:bg-amber-50'
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
        <div className="p-4 border-t border-amber-100">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">{currentUser?.avatar}</span>
            <div>
              <p className="font-medium text-slate-800 text-sm">{currentUser?.name}</p>
              <p className="text-xs text-slate-500">Sales Representative</p>
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

export default SalesLayout;
