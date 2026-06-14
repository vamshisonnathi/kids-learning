import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { toast } from "sonner";
import { Button } from "./ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { 
  Users, TrendingUp, AlertTriangle, 
  CheckCircle, Clock, ChevronRight, Brain
} from "lucide-react";

const TeacherDashboard = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const response = await api.getTeacherDashboard();
      setDashboardData(response.data);
    } catch (error) {
      console.error("Error loading dashboard:", error);
      toast.error("Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score) => {
    if (score >= 0.78) return "text-emerald-600";
    if (score >= 0.60) return "text-amber-600";
    return "text-red-600";
  };

  const getScoreBg = (score) => {
    if (score >= 0.78) return "bg-emerald-100";
    if (score >= 0.60) return "bg-amber-100";
    return "bg-red-100";
  };

  const ErrorBadge = ({ type }) => {
    const styles = {
      CONCEPTUAL: "bg-purple-100 text-purple-700 border-purple-200",
      PROCEDURAL: "bg-blue-100 text-blue-700 border-blue-200",
      CARELESS: "bg-yellow-100 text-yellow-700 border-yellow-200",
      VOCABULARY: "bg-pink-100 text-pink-700 border-pink-200",
      PREREQ_GAP: "bg-red-100 text-red-700 border-red-200",
    };
    
    return (
      <span className={`error-badge ${type}`} data-testid={`error-badge-${type}`}>
        {type}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="teacher-theme min-h-screen flex items-center justify-center">
        <div className="text-slate-600 text-xl">Loading dashboard...</div>
      </div>
    );
  }

  const { students, class_summary } = dashboardData || { students: [], class_summary: {} };

  return (
    <div className="teacher-theme teacher-dashboard" data-testid="teacher-dashboard">
      {/* Header */}
      <div className="teacher-header">
        <h1 className="teacher-title">Class Dashboard</h1>
        <Badge variant="outline" className="text-sm">
          Demo Class
        </Badge>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <Card className="kpi-card">
          <CardContent className="p-0">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="kpi-value">{class_summary.total_students}</p>
                <p className="kpi-label">Total Students</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="kpi-card">
          <CardContent className="p-0">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="kpi-value">{class_summary.students_on_track}</p>
                <p className="kpi-label">On Track (≥70%)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="kpi-card">
          <CardContent className="p-0">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-100 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <p className="kpi-value">{class_summary.students_struggling}</p>
                <p className="kpi-label">Struggling (&lt;60%)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="kpi-card">
          <CardContent className="p-0">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-100 rounded-lg">
                <Brain className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="kpi-value">{class_summary.students_with_anxiety}</p>
                <p className="kpi-label">Anxiety Flags</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Student Table */}
      <Card className="data-table">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold">Student Progress</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="w-[200px]">Student</TableHead>
                <TableHead className="text-center">Composite Score</TableHead>
                <TableHead className="text-center">Mastered</TableHead>
                <TableHead className="text-center">Blocked</TableHead>
                <TableHead className="text-center">Anxiety</TableHead>
                <TableHead>Error Patterns</TableHead>
                <TableHead className="text-center">Attention</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((student) => (
                <TableRow 
                  key={student.student_id} 
                  className="table-row cursor-pointer hover:bg-slate-50"
                  onClick={() => navigate(`/teacher/student/${student.student_id}`)}
                  data-testid={`student-row-${student.student_id}`}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{student.avatar_emoji}</span>
                      <div>
                        <p className="font-medium text-slate-900">{student.name}</p>
                        <p className="text-xs text-slate-500">{student.sessions_total} sessions</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold ${getScoreBg(student.overall_composite)} ${getScoreColor(student.overall_composite)}`}>
                      {Math.round(student.overall_composite * 100)}%
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                      <span className="font-medium">{student.nodes_mastered}/{student.total_grade5_nodes}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {student.blocked_nodes.length > 0 ? (
                      <Badge variant="destructive" className="text-xs">
                        {student.blocked_nodes.length} blocked
                      </Badge>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {student.anxiety_flags > 0 ? (
                      <div className="anxiety-indicator">
                        <Clock className="w-4 h-4 mr-1" />
                        {student.anxiety_flags}
                      </div>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                      {student.error_patterns.length > 0 ? (
                        student.error_patterns.map((pattern, idx) => (
                          <ErrorBadge key={idx} type={pattern} />
                        ))
                      ) : (
                        <span className="text-slate-400 text-sm">None</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {student.needs_attention ? (
                      <Badge variant="outline" className="border-red-300 text-red-600 bg-red-50">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        Review
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-emerald-300 text-emerald-600 bg-emerald-50">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Good
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="mt-6 p-4 bg-white rounded-lg shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Error Pattern Legend</h3>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <ErrorBadge type="CONCEPTUAL" />
            <span className="text-xs text-slate-600">Wrong operation chosen</span>
          </div>
          <div className="flex items-center gap-2">
            <ErrorBadge type="PROCEDURAL" />
            <span className="text-xs text-slate-600">Execution error</span>
          </div>
          <div className="flex items-center gap-2">
            <ErrorBadge type="CARELESS" />
            <span className="text-xs text-slate-600">Inconsistent results</span>
          </div>
          <div className="flex items-center gap-2">
            <ErrorBadge type="VOCABULARY" />
            <span className="text-xs text-slate-600">Language/reading issue</span>
          </div>
          <div className="flex items-center gap-2">
            <ErrorBadge type="PREREQ_GAP" />
            <span className="text-xs text-slate-600">Missing foundation skill</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeacherDashboard;
