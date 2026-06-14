import { useEffect, useState } from 'react';
import { api, API } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import axios from 'axios';
import {
  Activity, Users, Database, BookOpen, Server, 
  CheckCircle, TrendingUp, Image, Wand2, Loader2
} from 'lucide-react';

const AdminHome = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generatingProblems, setGeneratingProblems] = useState(false);
  const [generatingImages, setGeneratingImages] = useState(false);
  const [skillNodes, setSkillNodes] = useState([]);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [studentsRes, dashRes, graphRes] = await Promise.all([
        api.getStudents(),
        api.getTeacherDashboard(),
        api.getSkillGraph()
      ]);
      setStats({
        totalStudents: studentsRes.data.length,
        totalSkills: dashRes.data?.students?.[0]?.skills?.length || 0,
        avgMastery: studentsRes.data.reduce((sum, s) => sum + s.overall_composite, 0) / (studentsRes.data.length || 1),
        students: studentsRes.data,
      });
      setSkillNodes(graphRes.data?.nodes?.filter(n => n.grade === 5) || []);
    } catch (error) {
      console.error('Failed to load admin stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="admin-loading">
        <div className="text-slate-400">Loading system overview...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8" data-testid="admin-home">
      <div>
        <h1 className="text-3xl font-bold text-white">System Overview</h1>
        <p className="text-slate-400 mt-1">MathQuest Admin Console</p>
      </div>

      {/* System Status */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Server className="w-5 h-5 text-emerald-400" />
            System Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-3 p-3 bg-slate-700/50 rounded-lg">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              <div>
                <p className="text-sm text-slate-400">API Server</p>
                <p className="text-white font-semibold">Online</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-slate-700/50 rounded-lg">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              <div>
                <p className="text-sm text-slate-400">Database</p>
                <p className="text-white font-semibold">PostgreSQL</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-slate-700/50 rounded-lg">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              <div>
                <p className="text-sm text-slate-400">LLM Service</p>
                <p className="text-white font-semibold">Claude Haiku</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-slate-700/50 rounded-lg">
              <Activity className="w-5 h-5 text-blue-400" />
              <div>
                <p className="text-sm text-slate-400">Uptime</p>
                <p className="text-white font-semibold">99.9%</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-500/20 rounded-lg">
                <Users className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Total Students</p>
                <p className="text-2xl font-bold text-white">{stats?.totalStudents || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-500/20 rounded-lg">
                <BookOpen className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Skill Nodes</p>
                <p className="text-2xl font-bold text-white">43</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-500/20 rounded-lg">
                <TrendingUp className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Avg Mastery</p>
                <p className="text-2xl font-bold text-white">
                  {stats ? Math.round(stats.avgMastery * 100) : 0}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-500/20 rounded-lg">
                <Database className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">DB Engine</p>
                <p className="text-2xl font-bold text-white">PG 15</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Student Table */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Enrolled Students</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left p-3 text-sm text-slate-400">Student</th>
                  <th className="text-center p-3 text-sm text-slate-400">Mastery</th>
                  <th className="text-center p-3 text-sm text-slate-400">Skills Mastered</th>
                  <th className="text-center p-3 text-sm text-slate-400">Sessions</th>
                  <th className="text-center p-3 text-sm text-slate-400">Status</th>
                </tr>
              </thead>
              <tbody>
                {stats?.students?.map((student) => (
                  <tr key={student.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{student.avatar_emoji}</span>
                        <span className="text-white font-medium">{student.name}</span>
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      <span className={`font-bold ${
                        student.overall_composite >= 0.78 ? 'text-emerald-400' :
                        student.overall_composite >= 0.5 ? 'text-amber-400' : 'text-red-400'
                      }`}>
                        {Math.round(student.overall_composite * 100)}%
                      </span>
                    </td>
                    <td className="p-3 text-center text-slate-300">
                      {student.nodes_mastered}/{student.total_nodes}
                    </td>
                    <td className="p-3 text-center text-slate-300">
                      {student.total_sessions || 0}
                    </td>
                    <td className="p-3 text-center">
                      <Badge className={`${
                        student.overall_composite >= 0.78 ? 'bg-emerald-500/20 text-emerald-400' :
                        student.overall_composite >= 0.5 ? 'bg-amber-500/20 text-amber-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {student.overall_composite >= 0.78 ? 'On Track' :
                         student.overall_composite >= 0.5 ? 'Needs Attention' : 'At Risk'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Content Management */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-purple-400" />
            Content Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="p-4 bg-slate-700/50 rounded-lg">
              <h3 className="text-white font-medium mb-2">Generate Problems</h3>
              <p className="text-sm text-slate-400 mb-4">
                Use AI to generate new practice problems for each skill node.
              </p>
              <div className="flex flex-wrap gap-2">
                {skillNodes.slice(0, 6).map((node) => (
                  <Button
                    key={node.id}
                    size="sm"
                    variant="outline"
                    className="border-slate-600 text-slate-300 hover:bg-slate-600"
                    disabled={generatingProblems}
                    data-testid={`gen-problems-${node.id}`}
                    onClick={async () => {
                      setGeneratingProblems(true);
                      try {
                        const res = await axios.post(`${API}/problems/generate`, {
                          node_id: node.id, count: 3, include_word_problems: true
                        });
                        toast.success(`Generated ${res.data.problems_generated} problems for ${node.name}`);
                      } catch (e) {
                        toast.error(`Failed: ${e.response?.data?.detail || e.message}`);
                      } finally {
                        setGeneratingProblems(false);
                      }
                    }}
                  >
                    {node.id}
                  </Button>
                ))}
              </div>
            </div>
            <div className="p-4 bg-slate-700/50 rounded-lg">
              <h3 className="text-white font-medium mb-2">Generate Images</h3>
              <p className="text-sm text-slate-400 mb-4">
                Use AI to generate illustrations for problems with visual prompts.
              </p>
              <Button
                variant="outline"
                className="border-purple-500 text-purple-300 hover:bg-purple-500/20"
                disabled={generatingImages}
                data-testid="gen-images-batch"
                onClick={async () => {
                  setGeneratingImages(true);
                  try {
                    const res = await axios.post(`${API}/problems/generate-images-batch`);
                    toast.success(`Generated ${res.data.generated} images out of ${res.data.total} problems`);
                  } catch (e) {
                    toast.error(`Failed: ${e.response?.data?.detail || e.message}`);
                  } finally {
                    setGeneratingImages(false);
                  }
                }}
              >
                {generatingImages ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
                ) : (
                  <><Image className="w-4 h-4 mr-2" /> Generate All Images</>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminHome;
