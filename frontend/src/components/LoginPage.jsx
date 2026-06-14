import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth, ROLES } from '../contexts/AuthContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent } from './ui/card';
import { 
  GraduationCap, Users, Home, Settings, Briefcase, 
  Compass, AlertTriangle, Plus, Loader2
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, loginAsStudent, isAuthenticated, currentRole, currentUser } = useAuth();
  const [students, setStudents] = useState([]);
  const [showStudentPicker, setShowStudentPicker] = useState(false);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [newStudentName, setNewStudentName] = useState('');
  const [creating, setCreating] = useState(false);
  const [unauthorized, setUnauthorized] = useState(false);

  // Redirect if already authenticated (but not if they were sent here for being unauthorized)
  useEffect(() => {
    if (isAuthenticated() && !location.state?.unauthorized) {
      navigateToRoleHome(currentRole);
    }
  }, [isAuthenticated, currentRole]);

  // Check for unauthorized access attempt
  useEffect(() => {
    if (location.state?.unauthorized) {
      setUnauthorized(true);
    }
  }, [location]);

  // Load students for student picker
  useEffect(() => {
    const loadStudents = async () => {
      try {
        const response = await axios.get(`${API}/students`);
        setStudents(response.data);
      } catch (error) {
        console.error('Failed to load students:', error);
      }
    };
    loadStudents();
  }, []);

  const handleRoleLogin = (role) => {
    setUnauthorized(false);
    if (role === ROLES.STUDENT) {
      setShowStudentPicker(true);
    } else {
      login(role);
      navigateToRoleHome(role);
    }
  };

  const handleStudentSelect = (student) => {
    setUnauthorized(false);
    loginAsStudent(student);
    // First time (no grade) → grade select; returning → home
    if (!student.grade) {
      navigate('/student/grade-select');
    } else {
      navigate('/student/home');
    }
  };

  const handleCreateStudent = async () => {
    if (!newStudentName.trim() || creating) return;
    setCreating(true);
    try {
      const res = await axios.post(`${API}/students`, { name: newStudentName.trim() });
      const newStudent = res.data;
      setStudents(prev => [...prev, newStudent]);
      setShowAddStudent(false);
      setNewStudentName('');
      toast.success(`Welcome aboard, ${newStudent.name}!`);
      handleStudentSelect(newStudent);
    } catch (error) {
      toast.error('Failed to create student');
    } finally {
      setCreating(false);
    }
  };

  const navigateToRoleHome = (role) => {
    if (role === ROLES.STUDENT && currentUser && !currentUser.grade) {
      navigate('/student/grade-select');
      return;
    }
    const roleRoutes = {
      [ROLES.STUDENT]: '/student/home',
      [ROLES.TEACHER]: '/teacher',
      [ROLES.PARENT]: '/parent',
      [ROLES.ADMIN]: '/admin',
      [ROLES.SALES]: '/sales'
    };
    navigate(roleRoutes[role] || '/');
  };

  const roleButtons = [
    {
      role: ROLES.STUDENT,
      label: 'Log in as Student',
      icon: GraduationCap,
      description: 'Explore the math adventure map',
      color: 'from-emerald-500 to-teal-500',
      hoverColor: 'hover:from-emerald-600 hover:to-teal-600'
    },
    {
      role: ROLES.TEACHER,
      label: 'Log in as Teacher',
      icon: Users,
      description: 'View class dashboard & analytics',
      color: 'from-blue-500 to-indigo-500',
      hoverColor: 'hover:from-blue-600 hover:to-indigo-600'
    },
    {
      role: ROLES.PARENT,
      label: 'Log in as Parent',
      icon: Home,
      description: "Track your child's progress",
      color: 'from-purple-500 to-pink-500',
      hoverColor: 'hover:from-purple-600 hover:to-pink-600'
    },
    {
      role: ROLES.ADMIN,
      label: 'Log in as Admin',
      icon: Settings,
      description: 'System administration',
      color: 'from-slate-600 to-slate-700',
      hoverColor: 'hover:from-slate-700 hover:to-slate-800'
    },
    {
      role: ROLES.SALES,
      label: 'Log in as Sales',
      icon: Briefcase,
      description: 'District licensing portal',
      color: 'from-amber-500 to-orange-500',
      hoverColor: 'hover:from-amber-600 hover:to-orange-600'
    }
  ];

  return (
    <div 
      className="min-h-screen flex flex-col items-center justify-center p-8"
      style={{
        background: 'linear-gradient(135deg, #1e3a5f 0%, #0f2744 50%, #1a365d 100%)'
      }}
      data-testid="login-page"
    >
      {/* Logo & Title */}
      <div className="text-center mb-10">
        <div className="flex items-center justify-center gap-4 mb-4">
          <Compass className="w-14 h-14 text-amber-400" />
          <h1 className="text-5xl font-bold text-white tracking-tight">
            MathQuest
          </h1>
        </div>
        <p className="text-xl text-slate-300">
          Adaptive Math Learning Platform
        </p>
        <p className="text-sm text-slate-400 mt-2">
          Texas TEKS Aligned
        </p>
      </div>

      {/* Unauthorized Warning */}
      {unauthorized && (
        <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg flex items-center gap-3 max-w-md">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          <p className="text-red-300 text-sm">
            You don't have permission to access that page. Please log in with the appropriate role.
          </p>
        </div>
      )}

      {/* Student Picker Modal */}
      {showStudentPicker ? (
        <Card className="w-full max-w-lg bg-white/95 backdrop-blur">
          <CardContent className="p-6">
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Choose Your Explorer</h2>
            <p className="text-slate-500 mb-6">Select your profile to continue your adventure</p>
            
            <div className="space-y-3">
              {students.map((student) => (
                <button
                  key={student.id}
                  onClick={() => handleStudentSelect(student)}
                  className="w-full p-4 bg-slate-50 hover:bg-emerald-50 border-2 border-transparent hover:border-emerald-300 rounded-xl flex items-center gap-4 transition-all"
                  data-testid={`student-picker-${student.id}`}
                >
                  <span className="text-4xl">{student.avatar_emoji}</span>
                  <div className="text-left flex-1">
                    <p className="font-semibold text-slate-800">{student.name}</p>
                    <p className="text-sm text-slate-500">
                      {student.nodes_mastered}/{student.total_nodes} islands discovered
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`text-lg font-bold ${
                      student.overall_composite >= 0.7 ? 'text-emerald-600' : 
                      student.overall_composite >= 0.5 ? 'text-amber-600' : 'text-red-600'
                    }`}>
                      {Math.round(student.overall_composite * 100)}%
                    </span>
                    <p className="text-xs text-slate-400">mastery</p>
                  </div>
                </button>
              ))}

              {/* Add New Student */}
              {showAddStudent ? (
                <div className="p-4 bg-amber-50 border-2 border-amber-200 rounded-xl space-y-3" data-testid="add-student-form">
                  <p className="font-semibold text-slate-700 text-sm">New Explorer Name</p>
                  <div className="flex gap-2">
                    <Input
                      value={newStudentName}
                      onChange={e => setNewStudentName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleCreateStudent()}
                      placeholder="Enter your name..."
                      className="flex-1"
                      autoFocus
                      disabled={creating}
                      data-testid="new-student-name-input"
                    />
                    <Button
                      onClick={handleCreateStudent}
                      disabled={!newStudentName.trim() || creating}
                      className="bg-amber-500 hover:bg-amber-600 text-white"
                      data-testid="create-student-btn"
                    >
                      {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Join'}
                    </Button>
                  </div>
                  <Button variant="ghost" size="sm" className="w-full text-slate-500" onClick={() => { setShowAddStudent(false); setNewStudentName(''); }}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <button
                  onClick={() => setShowAddStudent(true)}
                  className="w-full p-4 bg-white border-2 border-dashed border-slate-300 hover:border-amber-400 hover:bg-amber-50 rounded-xl flex items-center justify-center gap-3 transition-all"
                  data-testid="add-student-btn"
                >
                  <Plus className="w-5 h-5 text-slate-400" />
                  <span className="font-medium text-slate-500">Add New Explorer</span>
                </button>
              )}
            </div>
            
            <Button
              variant="ghost"
              className="w-full mt-4"
              onClick={() => setShowStudentPicker(false)}
            >
              Back to Role Selection
            </Button>
          </CardContent>
        </Card>
      ) : (
        /* Role Selection Buttons */
        <div className="w-full max-w-2xl grid gap-4">
          {roleButtons.map(({ role, label, icon: Icon, description, color, hoverColor }) => (
            <button
              key={role}
              onClick={() => handleRoleLogin(role)}
              className={`w-full p-5 bg-gradient-to-r ${color} ${hoverColor} rounded-xl flex items-center gap-5 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-[1.02]`}
              data-testid={`login-${role}`}
            >
              <div className="p-3 bg-white/20 rounded-xl">
                <Icon className="w-8 h-8" />
              </div>
              <div className="text-left flex-1">
                <p className="text-xl font-bold">{label}</p>
                <p className="text-sm text-white/80">{description}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Footer */}
      <p className="text-slate-500 text-sm mt-10">
        Phase 1 Prototype • No Password Required
      </p>
    </div>
  );
};

export default LoginPage;
