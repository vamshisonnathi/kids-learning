import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Users, BookOpen, Compass } from "lucide-react";

const StudentSelector = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    try {
      const response = await api.getStudents();
      setStudents(response.data);
      if (response.data.length === 0) {
        // Seed demo data if no students
        await api.seedDemoData();
        const newResponse = await api.getStudents();
        setStudents(newResponse.data);
        toast.success("Demo students created!");
      }
    } catch (error) {
      console.error("Error loading students:", error);
      toast.error("Failed to load students");
    } finally {
      setLoading(false);
    }
  };

  const getStudentDescription = (student) => {
    if (student.overall_composite >= 0.75) return "Sailing smoothly!";
    if (student.anxiety_flags > 3) return "Taking time to think...";
    if (student.error_patterns.includes("PREREQ_GAP")) return "Building foundations...";
    return "On the adventure!";
  };

  if (loading) {
    return (
      <div className="student-selector">
        <div className="text-white text-xl">Loading adventures...</div>
      </div>
    );
  }

  return (
    <div className="student-selector" data-testid="student-selector-page">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="selector-title flex items-center justify-center gap-4">
          <Compass className="w-12 h-12" />
          MathQuest
        </h1>
        <p className="selector-subtitle">Choose your explorer to begin the adventure!</p>
      </div>

      {/* Student Cards */}
      <div className="student-cards">
        {students.map((student) => (
          <div
            key={student.id}
            className="student-card"
            onClick={() => navigate(`/student/${student.id}`)}
            data-testid={`student-card-${student.id}`}
          >
            <div className="student-avatar">{student.avatar_emoji}</div>
            <div className="student-name">{student.name}</div>
            <p className="student-progress-text mb-3">{getStudentDescription(student)}</p>
            
            {/* Progress bar */}
            <div className="progress-bar mb-2">
              <div
                className={`progress-fill ${
                  student.overall_composite >= 0.7 ? "high" : 
                  student.overall_composite >= 0.5 ? "medium" : "low"
                }`}
                style={{ width: `${Math.round(student.overall_composite * 100)}%` }}
              />
            </div>
            <p className="text-xs text-slate-500">
              {student.nodes_mastered}/{student.total_nodes} islands discovered
            </p>
          </div>
        ))}
      </div>

      {/* Teacher Button */}
      <div className="mt-12 flex gap-4">
        <Button
          variant="outline"
          className="bg-white/10 border-white/30 text-white hover:bg-white/20"
          onClick={() => navigate("/teacher")}
          data-testid="teacher-dashboard-btn"
        >
          <Users className="w-4 h-4 mr-2" />
          Teacher Dashboard
        </Button>
        <Button
          variant="outline"
          className="bg-white/10 border-white/30 text-white hover:bg-white/20"
          onClick={async () => {
            await api.seedDemoData();
            loadStudents();
            toast.success("Demo data reset!");
          }}
          data-testid="reset-demo-btn"
        >
          <BookOpen className="w-4 h-4 mr-2" />
          Reset Demo Data
        </Button>
      </div>
    </div>
  );
};

export default StudentSelector;
