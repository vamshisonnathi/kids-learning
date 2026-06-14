import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Progress } from "./ui/progress";
import { 
  ArrowLeft, Clock, CheckCircle, AlertTriangle, 
  Lock, Target, XCircle, Brain
} from "lucide-react";

const TeacherStudentDetail = () => {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStudentDetail();
  }, [studentId]);

  const loadStudentDetail = async () => {
    try {
      const response = await api.getTeacherStudentDetail(studentId);
      setData(response.data);
    } catch (error) {
      console.error("Error loading student detail:", error);
      toast.error("Failed to load student details");
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "MASTERED": return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case "APPROACHING": return <Target className="w-4 h-4 text-amber-500" />;
      case "PRACTICING": return <Clock className="w-4 h-4 text-blue-500" />;
      case "BLOCKED": return <XCircle className="w-4 h-4 text-red-500" />;
      case "OPEN": return <Target className="w-4 h-4 text-sky-500" />;
      default: return <Lock className="w-4 h-4 text-slate-400" />;
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      MASTERED: "bg-emerald-100 text-emerald-700 border-emerald-200",
      APPROACHING: "bg-amber-100 text-amber-700 border-amber-200",
      PRACTICING: "bg-blue-100 text-blue-700 border-blue-200",
      BLOCKED: "bg-red-100 text-red-700 border-red-200",
      OPEN: "bg-sky-100 text-sky-700 border-sky-200",
      LOCKED: "bg-slate-100 text-slate-500 border-slate-200",
    };
    
    return (
      <Badge variant="outline" className={styles[status] || styles.LOCKED}>
        {status}
      </Badge>
    );
  };

  const ErrorBadge = ({ type }) => (
    <span className={`error-badge ${type}`}>{type}</span>
  );

  const getScoreColor = (score) => {
    if (score >= 0.78) return "text-emerald-600";
    if (score >= 0.60) return "text-amber-600";
    return "text-red-600";
  };

  if (loading) {
    return (
      <div className="teacher-theme min-h-screen flex items-center justify-center">
        <div className="text-slate-600 text-xl">Loading student details...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="teacher-theme min-h-screen flex items-center justify-center">
        <div className="text-red-600 text-xl">Student not found</div>
      </div>
    );
  }

  const { student, grade4_nodes, grade5_nodes } = data;
  
  // Calculate summary stats
  const grade5Mastered = grade5_nodes.filter(n => n.status === "MASTERED").length;
  const grade5Blocked = grade5_nodes.filter(n => n.status === "BLOCKED").length;
  const anxietyCount = [...grade4_nodes, ...grade5_nodes].filter(n => n.anxiety_flag).length;
  const allErrors = [...grade4_nodes, ...grade5_nodes].flatMap(n => n.error_patterns);
  const uniqueErrors = [...new Set(allErrors)];

  const NodeTable = ({ nodes, title }) => (
    <Table>
      <TableHeader>
        <TableRow className="bg-slate-50">
          <TableHead className="w-[80px]">Node</TableHead>
          <TableHead>Skill Name</TableHead>
          <TableHead className="text-center">Status</TableHead>
          <TableHead className="text-center">Accuracy</TableHead>
          <TableHead className="text-center">Challenge</TableHead>
          <TableHead className="text-center">Fluency</TableHead>
          <TableHead className="text-center">Composite</TableHead>
          <TableHead className="text-center">Anxiety</TableHead>
          <TableHead>Errors</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {nodes.map((node) => (
          <TableRow key={node.node_id} className="hover:bg-slate-50">
            <TableCell className="font-mono text-sm font-medium">
              {node.teks}
            </TableCell>
            <TableCell>
              <div>
                <p className="font-medium text-slate-900">{node.name}</p>
                <p className="text-xs text-slate-500">{node.sessions_completed} sessions</p>
              </div>
            </TableCell>
            <TableCell className="text-center">
              <div className="flex items-center justify-center gap-2">
                {getStatusIcon(node.status)}
                {getStatusBadge(node.status)}
              </div>
            </TableCell>
            <TableCell className="text-center">
              {node.status !== "LOCKED" ? (
                <span className={`font-bold ${getScoreColor(node.accuracy_score)}`}>
                  {Math.round(node.accuracy_score * 100)}%
                </span>
              ) : (
                <span className="text-slate-400">—</span>
              )}
            </TableCell>
            <TableCell className="text-center">
              {node.status !== "LOCKED" ? (
                <span className={`font-bold ${getScoreColor(node.challenge_score)}`}>
                  {Math.round(node.challenge_score * 100)}%
                </span>
              ) : (
                <span className="text-slate-400">—</span>
              )}
            </TableCell>
            <TableCell className="text-center">
              {node.status !== "LOCKED" ? (
                <span className={`font-bold ${node.fluency_weight < 0.80 ? "text-amber-600" : "text-slate-600"}`}>
                  {Math.round(node.fluency_weight * 100)}%
                </span>
              ) : (
                <span className="text-slate-400">—</span>
              )}
            </TableCell>
            <TableCell className="text-center">
              {node.status !== "LOCKED" ? (
                <div className="flex flex-col items-center">
                  <span className={`font-bold ${getScoreColor(node.composite_score)}`}>
                    {Math.round(node.composite_score * 100)}%
                  </span>
                  <Progress 
                    value={node.composite_score * 100} 
                    className="w-16 h-1 mt-1"
                  />
                </div>
              ) : (
                <span className="text-slate-400">—</span>
              )}
            </TableCell>
            <TableCell className="text-center">
              {node.anxiety_flag ? (
                <div className="flex items-center justify-center text-amber-600">
                  <Brain className="w-4 h-4" />
                </div>
              ) : (
                <span className="text-slate-400">—</span>
              )}
            </TableCell>
            <TableCell>
              <div className="flex flex-wrap gap-1">
                {node.error_patterns.length > 0 ? (
                  node.error_patterns.map((pattern, idx) => (
                    <ErrorBadge key={idx} type={pattern} />
                  ))
                ) : (
                  <span className="text-slate-400 text-sm">—</span>
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  return (
    <div className="teacher-theme teacher-dashboard" data-testid="teacher-student-detail">
      {/* Header */}
      <div className="teacher-header">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => navigate("/teacher")}
            data-testid="back-to-dashboard-btn"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </div>

      {/* Student Info Card */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-5xl">{student.avatar_emoji}</span>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">{student.name}</h1>
                <p className="text-slate-500">Grade {student.grade} • {student.classroom}</p>
                <p className="text-sm text-slate-400">{student.total_sessions} total sessions</p>
              </div>
            </div>
            
            {/* Summary Stats */}
            <div className="flex gap-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-emerald-600">{grade5Mastered}</p>
                <p className="text-sm text-slate-500">Mastered</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-red-600">{grade5Blocked}</p>
                <p className="text-sm text-slate-500">Blocked</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-amber-600">{anxietyCount}</p>
                <p className="text-sm text-slate-500">Anxiety Flags</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-purple-600">{uniqueErrors.length}</p>
                <p className="text-sm text-slate-500">Error Types</p>
              </div>
            </div>
          </div>
          
          {/* Error Pattern Summary */}
          {uniqueErrors.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm font-medium text-slate-700 mb-2">Active Error Patterns:</p>
              <div className="flex flex-wrap gap-2">
                {uniqueErrors.map((pattern, idx) => (
                  <ErrorBadge key={idx} type={pattern} />
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Skill Breakdown Tabs */}
      <Tabs defaultValue="grade5" className="space-y-4">
        <TabsList>
          <TabsTrigger value="grade5" data-testid="tab-grade5">
            Grade 5 Skills ({grade5_nodes.length})
          </TabsTrigger>
          <TabsTrigger value="grade4" data-testid="tab-grade4">
            Grade 4 Prerequisites ({grade4_nodes.length})
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="grade5">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Grade 5 TEKS Progress</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <NodeTable nodes={grade5_nodes} />
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="grade4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Grade 4 Prerequisites (Foundation)</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <NodeTable nodes={grade4_nodes} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Insights Panel */}
      <Card className="mt-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Teacher Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {grade5Blocked > 0 && (
              <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg">
                <XCircle className="w-5 h-5 text-red-500 mt-0.5" />
                <div>
                  <p className="font-medium text-red-700">Prerequisite Gap Detected</p>
                  <p className="text-sm text-red-600">
                    Student has {grade5Blocked} blocked node(s). Check Grade 4 prerequisites for gaps.
                  </p>
                </div>
              </div>
            )}
            
            {anxietyCount > 3 && (
              <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg">
                <Brain className="w-5 h-5 text-amber-500 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-700">Math Anxiety Indicator</p>
                  <p className="text-sm text-amber-600">
                    High accuracy but slow response times across {anxietyCount} nodes. 
                    Fluency data excluded from mastery calculation. Consider reducing time pressure.
                  </p>
                </div>
              </div>
            )}
            
            {uniqueErrors.includes("PREREQ_GAP") && (
              <div className="flex items-start gap-3 p-3 bg-purple-50 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-purple-500 mt-0.5" />
                <div>
                  <p className="font-medium text-purple-700">Foundation Skills Need Review</p>
                  <p className="text-sm text-purple-600">
                    Errors trace back to Grade 4 skills. Focus on prerequisite remediation before advancing.
                  </p>
                </div>
              </div>
            )}
            
            {grade5Mastered >= 15 && anxietyCount === 0 && (
              <div className="flex items-start gap-3 p-3 bg-emerald-50 rounded-lg">
                <CheckCircle className="w-5 h-5 text-emerald-500 mt-0.5" />
                <div>
                  <p className="font-medium text-emerald-700">On Track for Success</p>
                  <p className="text-sm text-emerald-600">
                    Student is progressing well with {grade5Mastered}/20 skills mastered.
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TeacherStudentDetail;
