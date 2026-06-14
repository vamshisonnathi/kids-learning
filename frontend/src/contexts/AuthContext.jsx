import { createContext, useContext, useState, useEffect } from 'react';

// Available roles
export const ROLES = {
  STUDENT: 'student',
  TEACHER: 'teacher',
  PARENT: 'parent',
  ADMIN: 'admin',
  SALES: 'sales'
};

// Role permissions
export const ROLE_PERMISSIONS = {
  [ROLES.STUDENT]: ['/student'],
  [ROLES.TEACHER]: ['/teacher'],
  [ROLES.PARENT]: ['/parent'],
  [ROLES.ADMIN]: ['/admin', '/teacher'],  // Admin can also access teacher view
  [ROLES.SALES]: ['/sales']
};

// Demo users for each role
export const DEMO_USERS = {
  [ROLES.STUDENT]: { id: 'student-001', name: 'Alex Champion', avatar: '🌟', role: ROLES.STUDENT },
  [ROLES.TEACHER]: { id: 'teacher-001', name: 'Ms. Johnson', avatar: '👩‍🏫', role: ROLES.TEACHER },
  [ROLES.PARENT]: { id: 'parent-001', name: 'Parent User', avatar: '👨‍👩‍👧', role: ROLES.PARENT },
  [ROLES.ADMIN]: { id: 'admin-001', name: 'Admin User', avatar: '🔧', role: ROLES.ADMIN },
  [ROLES.SALES]: { id: 'sales-001', name: 'Sales Rep', avatar: '💼', role: ROLES.SALES }
};

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [currentRole, setCurrentRole] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load auth state from localStorage on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('mathquest_user');
    const savedRole = localStorage.getItem('mathquest_role');
    
    if (savedUser && savedRole) {
      try {
        setCurrentUser(JSON.parse(savedUser));
        setCurrentRole(savedRole);
      } catch (e) {
        localStorage.removeItem('mathquest_user');
        localStorage.removeItem('mathquest_role');
      }
    }
    setIsLoading(false);
  }, []);

  // Login function
  const login = (role, customUser = null) => {
    const user = customUser || DEMO_USERS[role];
    setCurrentUser(user);
    setCurrentRole(role);
    localStorage.setItem('mathquest_user', JSON.stringify(user));
    localStorage.setItem('mathquest_role', role);
  };

  // Login as specific student
  const loginAsStudent = (studentData) => {
    const user = {
      id: studentData.id,
      name: studentData.name,
      avatar: studentData.avatar_emoji || '🧑‍🎓',
      grade: studentData.grade || null,
      role: ROLES.STUDENT
    };
    login(ROLES.STUDENT, user);
  };

  // Update current user data (e.g., after grade selection)
  const updateUser = (updates) => {
    const updated = { ...currentUser, ...updates };
    setCurrentUser(updated);
    localStorage.setItem('mathquest_user', JSON.stringify(updated));
  };

  // Logout function
  const logout = () => {
    setCurrentUser(null);
    setCurrentRole(null);
    localStorage.removeItem('mathquest_user');
    localStorage.removeItem('mathquest_role');
  };

  // Check if user can access a route
  const canAccess = (path) => {
    if (!currentRole) return false;
    const allowedPaths = ROLE_PERMISSIONS[currentRole] || [];
    return allowedPaths.some(allowed => path.startsWith(allowed));
  };

  // Check if user is authenticated
  const isAuthenticated = () => {
    return currentUser !== null && currentRole !== null;
  };

  const value = {
    currentUser,
    currentRole,
    isLoading,
    login,
    loginAsStudent,
    updateUser,
    logout,
    canAccess,
    isAuthenticated,
    ROLES
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
