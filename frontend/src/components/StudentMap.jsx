import { useEffect, useState, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../lib/api";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Progress } from "./ui/progress";
import { 
  Star, Lock, Trophy, Target, Anchor,
  MapPin, Compass, Ship, Skull, Flag, Play
} from "lucide-react";
import PracticeModal from "./PracticeModal";

// Node positions for the treasure map layout (percentage-based)
const NODE_POSITIONS = {
  // Grade 4 Prerequisites (bottom area - foundation islands)
  "4.2A": { x: 5, y: 82 }, "4.2B": { x: 12, y: 88 }, "4.2D": { x: 20, y: 84 },
  "4.2E": { x: 28, y: 86 }, "4.2F": { x: 35, y: 82 }, "4.3B": { x: 8, y: 72 },
  "4.3C": { x: 16, y: 70 }, "4.3E": { x: 5, y: 65 }, "4.4A": { x: 55, y: 88 },
  "4.4B": { x: 62, y: 84 }, "4.4D": { x: 48, y: 76 }, "4.4E": { x: 58, y: 72 },
  "4.4F": { x: 68, y: 78 }, "4.4G": { x: 75, y: 82 }, "4.5A": { x: 80, y: 86 },
  "4.5B": { x: 86, y: 80 }, "4.5C": { x: 90, y: 86 }, "4.5D": { x: 84, y: 90 },
  "4.6A": { x: 90, y: 74 }, "4.6B": { x: 94, y: 80 }, "4.6C": { x: 92, y: 70 },
  "4.9A": { x: 88, y: 66 }, "4.9B": { x: 93, y: 62 },
  
  // Main Quest Islands (top area - adventure zone)
  "5-N01": { x: 15, y: 48 }, "5-N02": { x: 26, y: 38 }, "5-N03": { x: 38, y: 18 },
  "5-N04": { x: 42, y: 48 }, "5-N05": { x: 55, y: 52 }, "5-N06": { x: 50, y: 32 },
  "5-N07": { x: 40, y: 28 }, "5-N08": { x: 30, y: 26 }, "5-N09": { x: 22, y: 58 },
  "5-N10": { x: 32, y: 54 }, "5-N11": { x: 36, y: 44 }, "5-N12": { x: 62, y: 54 },
  "5-N13": { x: 68, y: 40 }, "5-N14": { x: 72, y: 50 }, "5-N15": { x: 78, y: 36 },
  "5-N16": { x: 72, y: 22 }, "5-N17": { x: 86, y: 48 }, "5-N18": { x: 82, y: 56 },
  "5-N19": { x: 88, y: 36 }, "5-N20": { x: 60, y: 12 },
};

// Node names for display
const NODE_NAMES = {
  "5-N01": "Fraction Bay", "5-N02": "Multiply Cove", "5-N03": "Word Problem Peak",
  "5-N04": "Decimal Dock", "5-N05": "Division Depths", "5-N06": "Connection Coast",
  "5-N07": "Number Line Lagoon", "5-N08": "Estimation Atoll", "5-N09": "Place Value Port",
  "5-N10": "Compare Canyon", "5-N11": "Rounding Reef", "5-N12": "Multi-Digit Marina",
  "5-N13": "Prime Island", "5-N14": "Order Oasis", "5-N15": "Algebra Archipelago",
  "5-N16": "Simplify Strait", "5-N17": "Shape Shore", "5-N18": "Ordered Outpost",
  "5-N19": "Graph Grotto", "5-N20": "Data Destination",
};

const StudentMap = () => {
  const { currentUser } = useAuth();
  const location = useLocation();
  const studentId = currentUser?.id;
  const mapRef = useRef(null);
  
  const [student, setStudent] = useState(null);
  const [skillGraph, setSkillGraph] = useState({ nodes: [], edges: [] });
  const [progress, setProgress] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState(null);
  const [practiceNode, setPracticeNode] = useState(null);
  const [mapDimensions, setMapDimensions] = useState({ width: 1200, height: 800 });
  const [diagnosticResults, setDiagnosticResults] = useState(null);
  const [showDiagnosticBanner, setShowDiagnosticBanner] = useState(false);

  // Receive diagnostic results from navigation state
  useEffect(() => {
    if (location.state?.diagnosticResults) {
      setDiagnosticResults(location.state.diagnosticResults);
      setShowDiagnosticBanner(true);
      // Auto-dismiss banner after 6s
      const timer = setTimeout(() => setShowDiagnosticBanner(false), 6000);
      return () => clearTimeout(timer);
    }
  }, [location.state]);

  useEffect(() => {
    loadData();
    
    const handleResize = () => {
      if (mapRef.current) {
        setMapDimensions({
          width: mapRef.current.offsetWidth,
          height: mapRef.current.offsetHeight
        });
      }
    };
    
    window.addEventListener('resize', handleResize);
    handleResize();
    
    return () => window.removeEventListener('resize', handleResize);
  }, [studentId]);

  const loadData = async () => {
    try {
      const [studentRes, graphRes, progressRes] = await Promise.all([
        api.getStudent(studentId),
        api.getSkillGraph(),
        api.getStudentProgress(studentId)
      ]);
      
      setStudent(studentRes.data);
      setSkillGraph(graphRes.data);
      setProgress(progressRes.data.skill_progress || {});
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load map data");
    } finally {
      setLoading(false);
    }
  };

  const getNodeStatus = (nodeId) => {
    // Diagnostic overlay: correct = mastered, incorrect = gap
    if (diagnosticResults) {
      const diagResult = diagnosticResults.find(r => r.node_id === nodeId);
      if (diagResult) {
        return diagResult.is_correct ? "mastered" : "diagnostic-gap";
      }
    }
    const nodeProgress = progress[nodeId];
    if (!nodeProgress) return "locked";
    return nodeProgress.status?.toLowerCase() || "locked";
  };

  const getNodeIcon = (status) => {
    switch (status) {
      case "mastered": return <Trophy className="w-5 h-5" />;
      case "diagnostic-gap": return <Target className="w-5 h-5" />;
      case "open": return <Target className="w-5 h-5" />;
      case "approaching": return <Flag className="w-5 h-5" />;
      case "practicing": return <Compass className="w-5 h-5" />;
      case "blocked": return <Skull className="w-5 h-5" />;
      default: return <Lock className="w-4 h-4" />;
    }
  };

  const getNodePosition = (nodeId) => {
    const pos = NODE_POSITIONS[nodeId] || { x: 50, y: 50 };
    return {
      left: `${pos.x}%`,
      top: `${pos.y}%`
    };
  };

  const renderPaths = () => {
    if (!skillGraph.edges) return null;
    
    return (
      <svg className="map-paths" viewBox="0 0 100 100" preserveAspectRatio="none">
        {skillGraph.edges.map((edge, idx) => {
          const fromPos = NODE_POSITIONS[edge.from];
          const toPos = NODE_POSITIONS[edge.to];
          
          if (!fromPos || !toPos) return null;
          
          const fromStatus = getNodeStatus(edge.from);
          const toStatus = getNodeStatus(edge.to);
          const isUnlocked = fromStatus === "mastered" || toStatus !== "locked";
          
          // Create curved path
          const midX = (fromPos.x + toPos.x) / 2;
          const midY = (fromPos.y + toPos.y) / 2 - 5;
          
          return (
            <path
              key={idx}
              className={`map-path ${isUnlocked ? "unlocked" : "locked"}`}
              d={`M ${fromPos.x} ${fromPos.y} Q ${midX} ${midY} ${toPos.x} ${toPos.y}`}
            />
          );
        })}
      </svg>
    );
  };

  const handleNodeClick = (node) => {
    const nodeProgress = progress[node.node_id] || {};
    const visualStatus = getNodeStatus(node.node_id);
    
    setSelectedNode({
      ...node,
      ...nodeProgress,
      // Override status for diagnostic nodes so the modal shows practice button
      status: visualStatus === "diagnostic-gap" ? "OPEN" : 
              visualStatus === "mastered" ? "MASTERED" : 
              nodeProgress.status,
      displayName: NODE_NAMES[node.node_id] || node.name
    });
  };

  const handleStartPractice = () => {
    if (selectedNode) {
      setPracticeNode(selectedNode);
      setSelectedNode(null);
    }
  };

  const handleMasteryUpdate = (nodeId, newMastery) => {
    // Update local progress state to reflect changes
    setProgress(prev => ({
      ...prev,
      [nodeId]: {
        ...prev[nodeId],
        ...newMastery
      }
    }));
    // Refresh data to get latest from server
    loadData();
  };

  const countMasteredNodes = () => {
    return Object.entries(progress).filter(
      ([nodeId, data]) => nodeId.startsWith("5-N") && data.status === "MASTERED"
    ).length;
  };

  if (loading) {
    return (
      <div className="adventure-map flex items-center justify-center">
        <div className="text-white text-2xl font-bold">Loading your adventure map...</div>
      </div>
    );
  }

  return (
    <div className="student-theme">
      {/* Diagnostic Results Banner */}
      {showDiagnosticBanner && diagnosticResults && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-slide-down" data-testid="diagnostic-banner">
          <div className="bg-slate-900/90 backdrop-blur-md border border-amber-400/30 rounded-2xl px-6 py-4 shadow-2xl max-w-md">
            <p className="text-amber-400 font-bold text-sm uppercase tracking-wider mb-1">Diagnostic Complete</p>
            <p className="text-white/80 text-sm">
              {diagnosticResults.filter(r => r.is_correct).length}/{diagnosticResults.length} correct &mdash;
              {' '}<span className="text-red-400 font-semibold">Red islands</span> are your gaps. Start there!
            </p>
          </div>
        </div>
      )}

      {/* Floating Stats Badge */}
      <div className="fixed top-20 right-4 z-40" data-testid="map-stats-badge">
        <div className="bg-sky-900/80 backdrop-blur-sm rounded-full px-4 py-2 flex items-center gap-2 shadow-lg">
          <Star className="w-4 h-4 text-amber-400" />
          <span className="text-white font-bold text-sm">
            {countMasteredNodes()}/20 Islands Conquered
          </span>
        </div>
      </div>

      {/* Map Container */}
      <div 
        ref={mapRef}
        className="adventure-map"
        style={{ minHeight: "100vh", paddingTop: "16px" }}
        data-testid="adventure-map"
      >
        {/* Water waves decoration */}
        <div className="water-waves" />
        
        {/* Render path connections */}
        {renderPaths()}
        
        {/* Map content area */}
        <div className="relative w-full h-full" style={{ minHeight: "calc(100vh - 80px)" }}>
          {/* Render islands (nodes) */}
          {skillGraph.nodes?.map((node) => {
            const status = getNodeStatus(node.node_id);
            const isGrade4 = node.grade === 4;
            const position = getNodePosition(node.node_id);
            
            return (
              <div
                key={node.node_id}
                className="island-node"
                style={position}
                onClick={() => handleNodeClick(node)}
                data-testid={`island-${node.node_id}`}
              >
                <div className={`island-body ${status} ${isGrade4 ? "grade4" : ""}`}>
                  {getNodeIcon(status)}
                  
                  {/* Status badge */}
                  {status === "mastered" && (
                    <div className="island-badge mastered">
                      <Star className="w-3 h-3" />
                    </div>
                  )}
                  {status === "diagnostic-gap" && (
                    <div className="island-badge diagnostic-gap">
                      <Target className="w-3 h-3" />
                    </div>
                  )}
                  {status === "locked" && (
                    <div className="island-badge locked">
                      <Lock className="w-3 h-3" />
                    </div>
                  )}
                </div>
                
                {/* Label */}
                {!isGrade4 && (
                  <div className={`island-label ${status === 'diagnostic-gap' ? 'text-red-300 font-bold' : ''}`}>
                    {status === 'diagnostic-gap' ? 'Start Here!' : (NODE_NAMES[node.node_id] || node.name)}
                    <div className="island-teks">{node.teks}</div>
                  </div>
                )}
                {isGrade4 && (
                  <div className="island-label text-xs opacity-80">
                    {node.teks}
                  </div>
                )}
              </div>
            );
          })}
          
          {/* Decorative elements */}
          <div className="absolute bottom-10 left-10 text-6xl opacity-30">
            <Ship />
          </div>
          <div className="absolute top-1/4 right-10 text-4xl opacity-20">
            <Anchor />
          </div>
        </div>
      </div>

      {/* Node Detail Modal */}
      <Dialog open={!!selectedNode} onOpenChange={() => setSelectedNode(null)}>
        <DialogContent className="sm:max-w-md" aria-describedby="node-description">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <span className="text-3xl">
                {selectedNode?.status === "MASTERED" ? "🏆" : 
                 selectedNode?.status === "LOCKED" ? "🔒" : "🗺️"}
              </span>
              {selectedNode?.displayName}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4" id="node-description">
            <div>
              <p className="text-sm text-slate-500">Texas Standard: {selectedNode?.teks}</p>
              <p className="text-sm mt-2">{selectedNode?.description}</p>
            </div>
            
            {selectedNode?.status !== "LOCKED" && (
              <>
                <div>
                  <p className="text-sm font-medium mb-2">Your Progress</p>
                  <Progress 
                    value={(selectedNode?.composite_score || 0) * 100} 
                    className="h-3"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    {Math.round((selectedNode?.composite_score || 0) * 100)}% mastery
                  </p>
                </div>
                
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-slate-100 rounded-lg p-2">
                    <p className="text-lg font-bold text-green-600">
                      {Math.round((selectedNode?.accuracy_score || 0) * 100)}%
                    </p>
                    <p className="text-xs text-slate-500">Accuracy</p>
                  </div>
                  <div className="bg-slate-100 rounded-lg p-2">
                    <p className="text-lg font-bold text-blue-600">
                      {Math.round((selectedNode?.challenge_score || 0) * 100)}%
                    </p>
                    <p className="text-xs text-slate-500">Challenge</p>
                  </div>
                  <div className="bg-slate-100 rounded-lg p-2">
                    <p className="text-lg font-bold text-amber-600">
                      {selectedNode?.sessions_completed || 0}
                    </p>
                    <p className="text-xs text-slate-500">Sessions</p>
                  </div>
                </div>

                {/* MASSIVE START PRACTICE BUTTON */}
                <Button 
                  className="w-full h-14 text-lg font-bold bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-lg hover:shadow-xl transition-all duration-200 mt-4" 
                  onClick={handleStartPractice}
                  data-testid="start-practice-btn"
                >
                  <Play className="w-6 h-6 mr-3" />
                  Start Practice
                </Button>
                <p className="text-xs text-center text-slate-400">
                  Practice this skill with AI-powered tutoring
                </p>
              </>
            )}
            
            {selectedNode?.status === "LOCKED" && (
              <div className="bg-slate-100 border border-slate-200 rounded-lg p-4 text-center">
                <Lock className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                <p className="text-sm text-slate-600 font-medium">
                  This island is locked!
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Complete the prerequisite islands to unlock this skill.
                </p>
              </div>
            )}
            
            {selectedNode?.status === "BLOCKED" && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-700 font-medium">
                  This island is blocked! Complete the prerequisite islands first.
                </p>
              </div>
            )}
            
            {selectedNode?.anxiety_flag && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm text-amber-700">
                  Take your time! Speed isn't everything.
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Practice Modal */}
      <PracticeModal
        isOpen={!!practiceNode}
        onClose={() => setPracticeNode(null)}
        node={practiceNode}
        studentId={studentId}
        onMasteryUpdate={handleMasteryUpdate}
      />
    </div>
  );
};

export default StudentMap;
