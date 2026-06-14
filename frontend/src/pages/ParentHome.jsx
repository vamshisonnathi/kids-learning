import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Progress } from '../components/ui/progress';
import { Badge } from '../components/ui/badge';
import {
  TrendingUp, Star, AlertTriangle, Clock, BookOpen, Target
} from 'lucide-react';

const ParentHome = () => {
  const { currentUser } = useAuth();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [childSkills, setChildSkills] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const studentsRes = await api.getStudents();
      setStudents(studentsRes.data);
      
      // Load first child's detailed skill data
      if (studentsRes.data.length > 0) {
        const detailRes = await api.getTeacherStudentDetail(studentsRes.data[0].id);
        setChildSkills(detailRes.data?.grade5_nodes || []);
      }
    } catch (error) {
      console.error('Failed to load parent data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="parent-loading">
        <div className="text-slate-500">Loading your child's progress...</div>
      </div>
    );
  }

  const child = students[0];

  return (
    <div className="space-y-8" data-testid="parent-home">
      <div>
        <h1 className="text-3xl font-bold text-slate-800">
          Welcome, {currentUser?.name}
        </h1>
        <p className="text-slate-500 mt-1">Here's how your child is doing in MathQuest</p>
      </div>

      {child && (
        <>
          {/* Child Overview Card */}
          <Card className="border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50">
            <CardContent className="p-6">
              <div className="flex items-center gap-5">
                <span className="text-6xl">{child.avatar_emoji}</span>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-slate-800">{child.name}</h2>
                  <p className="text-slate-500 mt-1">Explorer</p>
                  <div className="flex items-center gap-6 mt-3">
                    <div className="flex items-center gap-2">
                      <Star className="w-5 h-5 text-amber-500" />
                      <span className="font-semibold text-slate-700">
                        {child.nodes_mastered}/{child.total_nodes} Skills Mastered
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Target className="w-5 h-5 text-blue-500" />
                      <span className="font-semibold text-slate-700">
                        {Math.round(child.overall_composite * 100)}% Overall Mastery
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Progress Bar */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
                Overall Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Progress value={child.overall_composite * 100} className="h-4" />
              <div className="flex justify-between mt-2 text-sm text-slate-500">
                <span>0%</span>
                <span className="font-medium text-slate-700">
                  {Math.round(child.overall_composite * 100)}% Complete
                </span>
                <span>100%</span>
              </div>
            </CardContent>
          </Card>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-6 text-center">
                <BookOpen className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                <p className="text-3xl font-bold text-slate-800">{child.total_sessions || 0}</p>
                <p className="text-sm text-slate-500 mt-1">Practice Sessions</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 text-center">
                <Star className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                <p className="text-3xl font-bold text-slate-800">{child.nodes_mastered}</p>
                <p className="text-sm text-slate-500 mt-1">Skills Mastered</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 text-center">
                {child.anxiety_flags > 3 ? (
                  <>
                    <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                    <p className="text-3xl font-bold text-amber-600">{child.anxiety_flags}</p>
                    <p className="text-sm text-slate-500 mt-1">Anxiety Indicators</p>
                  </>
                ) : (
                  <>
                    <Clock className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                    <p className="text-3xl font-bold text-emerald-600">Low</p>
                    <p className="text-sm text-slate-500 mt-1">Stress Level</p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Skill Breakdown */}
          {childSkills.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Skill Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {childSkills.slice(0, 8).map((skill) => (
                    <div key={skill.node_id} className="flex items-center gap-4">
                      <div className="w-40 text-sm font-medium text-slate-700 truncate">
                        {skill.name || skill.node_id}
                      </div>
                      <div className="flex-1">
                        <Progress value={skill.composite_score * 100} className="h-2" />
                      </div>
                      <div className="w-16 text-right">
                        <span className={`text-sm font-semibold ${
                          skill.composite_score >= 0.78 ? 'text-emerald-600' :
                          skill.composite_score >= 0.5 ? 'text-amber-600' : 'text-red-600'
                        }`}>
                          {Math.round(skill.composite_score * 100)}%
                        </span>
                      </div>
                      <Badge variant="outline" className={`text-xs ${
                        skill.status === 'mastered' ? 'border-emerald-300 text-emerald-700' :
                        skill.status === 'in_progress' ? 'border-blue-300 text-blue-700' :
                        'border-slate-300 text-slate-500'
                      }`}>
                        {skill.status?.replace('_', ' ') || 'locked'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default ParentHome;
