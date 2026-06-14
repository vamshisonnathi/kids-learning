import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { ScrollArea } from "./ui/scroll-area";
import { Badge } from "./ui/badge";
import { 
  Send, Lightbulb, CheckCircle, Clock,
  Sparkles, Brain
} from "lucide-react";
import axios from "axios";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const PracticeModal = ({ isOpen, onClose, node, studentId, onMasteryUpdate }) => {
  const [problem, setProblem] = useState(null);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [sending, setSending] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [currentMastery, setCurrentMastery] = useState(null);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  // Load problem when modal opens
  useEffect(() => {
    if (isOpen && node) {
      loadProblem();
      setMessages([]);
      setCurrentMastery({
        accuracy: node.accuracy_score || 0.5,
        fluency: node.fluency_weight || 0.7,
        composite: node.composite_score || 0.5
      });
    }
  }, [isOpen, node]);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input after sending
  useEffect(() => {
    if (!sending && inputRef.current) {
      inputRef.current.focus();
    }
  }, [sending]);

  const loadProblem = async () => {
    if (!node?.node_id) return;
    
    setLoading(true);
    try {
      const response = await axios.get(`${API}/tutor/problem/${node.node_id}`);
      setProblem(response.data);
      setStartTime(Date.now());
      
      // Add welcome message
      setMessages([{
        type: "tutor",
        content: `Welcome to ${response.data.skill_name}! Here's your challenge. Take your time, and feel free to ask for help if you get stuck.`,
        timestamp: new Date().toISOString()
      }]);
    } catch (error) {
      console.error("Error loading problem:", error);
      toast.error("Couldn't load a problem for this skill");
      // Fallback problem
      setProblem({
        problem_id: "fallback",
        problem_type: "procedural",
        question: "This skill doesn't have problems yet. Try another island!",
        hint: "Come back soon!",
        node_id: node.node_id,
        teks: node.teks,
        skill_name: node.name
      });
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!inputValue.trim() || sending) return;
    
    const userMessage = inputValue.trim();
    setInputValue("");
    setSending(true);
    
    // Calculate response time
    const responseTime = startTime ? (Date.now() - startTime) / 1000 : 60;
    
    // Add user message to chat
    setMessages(prev => [...prev, {
      type: "student",
      content: userMessage,
      timestamp: new Date().toISOString()
    }]);
    
    try {
      const response = await axios.post(`${API}/tutor/evaluate`, {
        student_id: studentId,
        node_id: node.node_id,
        problem_id: problem?.problem_id || "unknown",
        message: userMessage,
        response_time_seconds: responseTime,
        problem_text: problem?.question,
        correct_answer: problem?.answer
      });
      
      const { 
        tutor_message, 
        is_correct, 
        encouragement,
        updated_accuracy,
        updated_fluency,
        updated_composite,
        mastery_change
      } = response.data;
      
      // Add tutor response to chat - NO error pattern shown to student
      setMessages(prev => [...prev, {
        type: "tutor",
        content: tutor_message,
        isCorrect: is_correct,
        encouragement: encouragement,
        timestamp: new Date().toISOString()
      }]);
      
      // Update mastery display
      setCurrentMastery({
        accuracy: updated_accuracy,
        fluency: updated_fluency,
        composite: updated_composite
      });
      
      // Show toast for feedback - simple, no error type
      if (is_correct) {
        toast.success("Correct! Great work! 🌟");
      } else {
        toast.info("Let's work on this together!");
      }
      
      // Notify parent of mastery update
      if (onMasteryUpdate && mastery_change !== "unchanged") {
        onMasteryUpdate(node.node_id, {
          accuracy_score: updated_accuracy,
          fluency_weight: updated_fluency,
          composite_score: updated_composite
        });
      }
      
      // Reset timer for next attempt
      setStartTime(Date.now());
      
    } catch (error) {
      console.error("Error evaluating response:", error);
      setMessages(prev => [...prev, {
        type: "tutor",
        content: "Oops! I had trouble processing that. Try again?",
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const requestHint = () => {
    setInputValue("Can you give me a hint?");
    setTimeout(sendMessage, 100);
  };

  const getNewProblem = () => {
    loadProblem();
    toast.info("Loading a new problem...");
  };

  if (!node) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="max-w-2xl h-[85vh] flex flex-col p-0 gap-0"
        aria-describedby="practice-modal-description"
      >
        {/* Header */}
        <DialogHeader className="p-4 pb-3 border-b bg-gradient-to-r from-sky-50 to-indigo-50">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="w-5 h-5 text-amber-500" />
                {problem?.skill_name || node.name}
              </DialogTitle>
              <p className="text-sm text-slate-500" id="practice-modal-description">
                TEKS {problem?.teks || node.teks} • {problem?.problem_type || "procedural"}
              </p>
            </div>
            
            {/* Mini mastery display */}
            {currentMastery && (
              <div className="flex items-center gap-3 text-xs">
                <div className="text-center">
                  <p className="font-bold text-emerald-600">
                    {Math.round(currentMastery.accuracy * 100)}%
                  </p>
                  <p className="text-slate-400">Accuracy</p>
                </div>
                <div className="text-center">
                  <p className={`font-bold ${currentMastery.fluency < 0.8 ? "text-amber-600" : "text-slate-600"}`}>
                    {Math.round(currentMastery.fluency * 100)}%
                  </p>
                  <p className="text-slate-400">Fluency</p>
                </div>
                <div className="text-center">
                  <p className={`font-bold ${currentMastery.composite >= 0.78 ? "text-emerald-600" : currentMastery.composite >= 0.6 ? "text-amber-600" : "text-red-600"}`}>
                    {Math.round(currentMastery.composite * 100)}%
                  </p>
                  <p className="text-slate-400">Mastery</p>
                </div>
              </div>
            )}
          </div>
        </DialogHeader>

        {/* Problem Display */}
        <div className="p-4 bg-white border-b" data-testid="problem-display">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500" />
            </div>
          ) : problem ? (
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <Brain className="w-5 h-5 text-amber-600" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-slate-800 text-lg">
                    {problem.question}
                  </p>
                </div>
              </div>
              
              {/* Problem image if available */}
              {problem.image_url && (
                <div className="flex justify-center" data-testid="problem-image">
                  <img 
                    src={problem.image_url} 
                    alt="Problem illustration" 
                    className="max-h-48 rounded-lg border border-slate-200 shadow-sm"
                  />
                </div>
              )}
              
              {/* Problem type badge */}
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {problem.problem_type === "word_problem" ? "Word Problem" : "Practice"}
                </Badge>
                {startTime && (
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Timer running
                  </span>
                )}
              </div>
            </div>
          ) : (
            <p className="text-slate-500 text-center py-4">
              Loading problem...
            </p>
          )}
        </div>

        {/* Chat Area */}
        <ScrollArea 
          className="flex-1 p-4" 
          ref={scrollRef}
          data-testid="chat-area"
        >
          <div className="space-y-4">
            {messages.map((msg, idx) => (
              <div 
                key={idx} 
                className={`flex ${msg.type === "student" ? "justify-end" : "justify-start"}`}
              >
                <div 
                  className={`max-w-[85%] rounded-2xl px-4 py-2 ${
                    msg.type === "student" 
                      ? "bg-sky-500 text-white rounded-br-md" 
                      : "bg-slate-100 text-slate-800 rounded-bl-md"
                  }`}
                >
                  {msg.type === "tutor" && msg.isCorrect === true && (
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                    </div>
                  )}
                  
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  
                  {msg.encouragement && msg.type === "tutor" && (
                    <p className="text-xs mt-2 opacity-80">{msg.encouragement}</p>
                  )}
                </div>
              </div>
            ))}
            
            {sending && (
              <div className="flex justify-start">
                <div className="bg-slate-100 rounded-2xl px-4 py-3 rounded-bl-md">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="p-4 border-t bg-slate-50">
          <div className="flex gap-2 mb-3">
            <Button
              variant="outline"
              size="sm"
              onClick={requestHint}
              disabled={sending}
              className="text-xs"
              data-testid="hint-btn"
            >
              <Lightbulb className="w-3 h-3 mr-1" />
              Get a Hint
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={getNewProblem}
              disabled={sending || loading}
              className="text-xs"
              data-testid="new-problem-btn"
            >
              <Sparkles className="w-3 h-3 mr-1" />
              New Problem
            </Button>
          </div>
          
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your answer or ask for help..."
              disabled={sending}
              className="flex-1"
              data-testid="chat-input"
            />
            <Button 
              onClick={sendMessage} 
              disabled={!inputValue.trim() || sending}
              data-testid="send-btn"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          
          <p className="text-xs text-slate-400 mt-2 text-center">
            Press Enter to send • Ask "help" or "hint" if you're stuck
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PracticeModal;
