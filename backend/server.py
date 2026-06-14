"""
MathQuest API - PostgreSQL Backend
Migrated from MongoDB to PostgreSQL with SQLAlchemy
"""
from fastapi import FastAPI, APIRouter, HTTPException, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text, Enum as SQLEnum, text, UniqueConstraint
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base, relationship
from sqlalchemy.future import select
from sqlalchemy import and_, func
from contextlib import asynccontextmanager
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone
from enum import Enum
import json
import random
import anthropic
import openai
import base64

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# ══════════════════════════════════════════════════════════════════════════════
# DATABASE CONFIGURATION
# ══════════════════════════════════════════════════════════════════════════════

DATABASE_URL = os.environ.get('DATABASE_URL')
ASYNC_DATABASE_URL = DATABASE_URL.replace('postgresql://', 'postgresql+asyncpg://') if DATABASE_URL else None

# Create async engine with pgbouncer-compatible settings
engine = create_async_engine(
    ASYNC_DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
    # CRITICAL: Disable prepared statement cache for Supabase pgbouncer compatibility
    connect_args={
        "prepared_statement_cache_size": 0,
        "statement_cache_size": 0,
    }
)

# Session factory
AsyncSessionLocal = sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False
)

# Base class for models
Base = declarative_base()

ANTHROPIC_API_KEY = os.environ.get('ANTHROPIC_API_KEY', '')
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY', '')

anthropic_client = anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY)
openai_client = openai.AsyncOpenAI(api_key=OPENAI_API_KEY)

# ══════════════════════════════════════════════════════════════════════════════
# CONSTANTS
# ══════════════════════════════════════════════════════════════════════════════
MIN_ACCURACY_THRESHOLD = 0.80
CHALLENGE_THRESHOLD = 0.70
MIN_ATTEMPTS = 8
FLUENCY_CEILING_SECONDS = 90
FLUENCY_NOISE_THRESHOLD = 0.80
RETENTION_WINDOW_DAYS = 7
RETENTION_THRESHOLD = 0.75
CONFIDENCE_FLOOR = 3
DECAY_RATE = 0.15

# ══════════════════════════════════════════════════════════════════════════════
# ENUMS
# ══════════════════════════════════════════════════════════════════════════════
class NodeStatusEnum(str, Enum):
    LOCKED = "LOCKED"
    OPEN = "OPEN"
    PRACTICING = "PRACTICING"
    APPROACHING = "APPROACHING"
    MASTERED = "MASTERED"
    BLOCKED = "BLOCKED"

class ErrorPatternEnum(str, Enum):
    CONCEPTUAL = "CONCEPTUAL"
    PROCEDURAL = "PROCEDURAL"
    CARELESS = "CARELESS"
    VOCABULARY = "VOCABULARY"
    PREREQ_GAP = "PREREQ_GAP"
    CORRECT = "CORRECT"
    HELP_REQUEST = "HELP_REQUEST"
    OFF_TASK = "OFF_TASK"

class ProblemTypeEnum(str, Enum):
    PROCEDURAL = "procedural"
    WORD_PROBLEM = "word_problem"
    TRANSFER = "transfer"

# ══════════════════════════════════════════════════════════════════════════════
# SQLALCHEMY MODELS
# ══════════════════════════════════════════════════════════════════════════════

class Student(Base):
    """Student table - stores student profile information"""
    __tablename__ = "students"
    
    id = Column(String(50), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(100), nullable=False)
    avatar_emoji = Column(String(10), default="🧑‍🎓")
    grade = Column(Integer, nullable=True, default=None)
    classroom = Column(String(100), default="Demo Class")
    total_sessions = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    
    # Relationships
    mastery_ledgers = relationship("MasteryLedger", back_populates="student", cascade="all, delete-orphan")
    problem_attempts = relationship("ProblemAttempt", back_populates="student", cascade="all, delete-orphan")

class SkillNode(Base):
    """SkillNode table - stores TEKS skill nodes (DAG vertices)"""
    __tablename__ = "skill_nodes"
    
    id = Column(String(50), primary_key=True)  # e.g., "5-N01" or "4.3E"
    teks = Column(String(20), nullable=False)  # Texas standard identifier
    name = Column(String(100), nullable=False)
    description = Column(Text)
    grade = Column(Integer, nullable=False)  # 4 or 5
    x_position = Column(Float, default=0)
    y_position = Column(Float, default=0)
    
    # Relationships
    prerequisites = relationship(
        "Edge",
        foreign_keys="Edge.target_node_id",
        back_populates="target_node"
    )
    unlocks = relationship(
        "Edge",
        foreign_keys="Edge.source_node_id",
        back_populates="source_node"
    )
    mastery_ledgers = relationship("MasteryLedger", back_populates="skill_node")
    problem_attempts = relationship("ProblemAttempt", back_populates="skill_node")
    practice_problems = relationship("PracticeProblem", back_populates="skill_node", cascade="all, delete-orphan")

class PracticeProblem(Base):
    """PracticeProblem table - stores practice problems for each skill node"""
    __tablename__ = "practice_problems"
    
    id = Column(String(50), primary_key=True, default=lambda: str(uuid.uuid4()))
    node_id = Column(String(50), ForeignKey("skill_nodes.id"), nullable=False)
    teks = Column(String(20), nullable=False)  # e.g., "5.3A"
    
    # Problem type: 'procedural' or 'word_problem'
    type = Column(String(20), nullable=False, default="procedural")
    
    # Problem content (plain text or KaTeX-compatible, NO raw LaTeX $ delimiters)
    problem_text = Column(Text, nullable=False)
    correct_answer = Column(String(255), nullable=False)
    
    # Hint for Socratic tutoring
    hint = Column(Text, nullable=True)
    
    # DALL-E image generation (optional)
    dalle_prompt = Column(Text, nullable=True)
    image_url = Column(Text, nullable=True)
    
    # Metadata
    difficulty = Column(Integer, default=1)  # 1=easy, 2=medium, 3=hard
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    is_active = Column(Boolean, default=True)
    
    # Relationships
    skill_node = relationship("SkillNode", back_populates="practice_problems")

class Edge(Base):
    """Edge table - represents DAG prerequisite relationships"""
    __tablename__ = "edges"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    source_node_id = Column(String(50), ForeignKey("skill_nodes.id"), nullable=False)  # Prerequisite
    target_node_id = Column(String(50), ForeignKey("skill_nodes.id"), nullable=False)  # Unlocks
    
    # Relationships
    source_node = relationship("SkillNode", foreign_keys=[source_node_id], back_populates="unlocks")
    target_node = relationship("SkillNode", foreign_keys=[target_node_id], back_populates="prerequisites")

class MasteryLedger(Base):
    """MasteryLedger table - tracks mastery score components per student per node"""
    __tablename__ = "mastery_ledgers"
    __table_args__ = (UniqueConstraint("student_id", "node_id", name="uq_mastery_student_node"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    student_id = Column(String(50), ForeignKey("students.id"), nullable=False)
    node_id = Column(String(50), ForeignKey("skill_nodes.id"), nullable=False)
    
    # Mastery components
    accuracy_score = Column(Float, default=0.0)
    fluency_weight = Column(Float, default=0.6)
    challenge_score = Column(Float, default=0.0)
    composite_score = Column(Float, default=0.0)
    
    # Status and metadata
    status = Column(String(20), default=NodeStatusEnum.LOCKED.value)
    sessions_completed = Column(Integer, default=0)
    last_attempt_date = Column(DateTime(timezone=True), nullable=True)
    anxiety_flag = Column(Boolean, default=False)
    
    # Error patterns (stored as JSON array)
    error_patterns = Column(Text, default="[]")  # JSON array of error types
    
    # Relationships
    student = relationship("Student", back_populates="mastery_ledgers")
    skill_node = relationship("SkillNode", back_populates="mastery_ledgers")

class ProblemAttempt(Base):
    """ProblemAttempt table - logs every single answer attempt"""
    __tablename__ = "problem_attempts"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    student_id = Column(String(50), ForeignKey("students.id"), nullable=False)
    node_id = Column(String(50), ForeignKey("skill_nodes.id"), nullable=False)
    problem_id = Column(String(50), nullable=False)
    
    # Attempt details
    problem_text = Column(Text)
    student_answer = Column(Text)
    correct_answer = Column(Text)
    is_correct = Column(Boolean, default=False)
    
    # Classification
    error_type = Column(String(20), nullable=True)
    confidence = Column(Float, nullable=True)
    
    # Timing
    response_time_seconds = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    
    # Tutor response
    tutor_response = Column(Text)
    
    # Relationships
    student = relationship("Student", back_populates="problem_attempts")
    skill_node = relationship("SkillNode", back_populates="problem_attempts")

class ChatMessage(Base):
    """ChatMessage table - stores conversation history"""
    __tablename__ = "chat_messages"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    student_id = Column(String(50), ForeignKey("students.id"), nullable=False)
    node_id = Column(String(50), ForeignKey("skill_nodes.id"), nullable=False)
    problem_id = Column(String(50), nullable=False)
    role = Column(String(20), nullable=False)  # "student" or "tutor"
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

# ══════════════════════════════════════════════════════════════════════════════
# DATABASE DEPENDENCY
# ══════════════════════════════════════════════════════════════════════════════

async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

# ══════════════════════════════════════════════════════════════════════════════
# PYDANTIC MODELS (API Request/Response)
# ══════════════════════════════════════════════════════════════════════════════

class StudentResponse(BaseModel):
    id: str
    name: str
    avatar_emoji: str
    overall_composite: float
    nodes_mastered: int
    total_nodes: int
    anxiety_flags: int
    error_patterns: List[str]

class SkillNodeResponse(BaseModel):
    id: str
    node_id: str
    teks: str
    name: str
    description: str
    grade: int
    x_position: float
    y_position: float
    prerequisites: List[str]
    unlocks: List[str]

class SkillGraphResponse(BaseModel):
    nodes: List[SkillNodeResponse]
    edges: List[Dict[str, str]]

class TutorMessageRequest(BaseModel):
    student_id: str
    node_id: str
    problem_id: str
    message: str
    response_time_seconds: Optional[float] = None
    problem_text: Optional[str] = None
    correct_answer: Optional[str] = None

class TutorResponse(BaseModel):
    tutor_message: str
    is_correct: bool
    hint: Optional[str] = None
    encouragement: Optional[str] = None
    updated_accuracy: Optional[float] = None
    updated_fluency: Optional[float] = None
    updated_composite: Optional[float] = None
    mastery_change: str

class ProblemResponse(BaseModel):
    problem_id: str
    problem_type: str
    question: str
    hint: str
    answer: str
    node_id: str
    teks: str
    skill_name: str
    image_url: Optional[str] = None

class PracticeProblemCreate(BaseModel):
    node_id: str
    teks: str
    type: str = "procedural"
    problem_text: str
    correct_answer: str
    hint: Optional[str] = None
    dalle_prompt: Optional[str] = None
    difficulty: int = 1

class PracticeProblemResponse(BaseModel):
    id: str
    node_id: str
    teks: str
    type: str
    problem_text: str
    correct_answer: str
    hint: Optional[str]
    dalle_prompt: Optional[str]
    image_url: Optional[str]
    difficulty: int
    is_active: bool

class GenerateProblemsRequest(BaseModel):
    node_id: str
    count: int = Field(default=5, ge=1, le=20)
    include_word_problems: bool = True

class DiagnosticResult(BaseModel):
    node_id: str
    is_correct: bool

class DiagnosticSubmitRequest(BaseModel):
    student_id: str
    results: List[DiagnosticResult]

# ══════════════════════════════════════════════════════════════════════════════
# PROBLEM BANK (Static data - could move to DB later)
# ══════════════════════════════════════════════════════════════════════════════

PROBLEM_BANK = {
    "5-N01": {
        "teks": "5.3A",
        "skill": "Add Unlike Fractions",
        "problems": [
            {"id": "5-N01-P1", "type": "procedural", "question": "What is 1/4 + 2/3?", "answer": "11/12", "hint": "First, find a common denominator for 4 and 3."},
            {"id": "5-N01-P2", "type": "procedural", "question": "Calculate: 3/5 + 1/2", "answer": "11/10 or 1 1/10", "hint": "What number is divisible by both 5 and 2?"},
            {"id": "5-N01-P3", "type": "word_problem", "question": "Maria ate 1/3 of a pizza and her brother ate 1/4. How much pizza did they eat together?", "answer": "7/12", "hint": "You need to add two fractions. What do you do first?"},
        ]
    },
    "5-N02": {
        "teks": "5.3B",
        "skill": "Multiply Fractions",
        "problems": [
            {"id": "5-N02-P1", "type": "procedural", "question": "What is 3 × 2/5?", "answer": "6/5 or 1 1/5", "hint": "Multiply the whole number by the numerator."},
            {"id": "5-N02-P2", "type": "procedural", "question": "Calculate: 4 × 3/8", "answer": "12/8 or 3/2 or 1 1/2", "hint": "4 × 3 = ? Then put it over 8."},
            {"id": "5-N02-P3", "type": "word_problem", "question": "If a recipe needs 2/3 cup of sugar and you want to make 5 batches, how much sugar do you need?", "answer": "10/3 or 3 1/3 cups", "hint": "What operation do you use for 'batches'?"},
        ]
    },
    "5-N03": {
        "teks": "5.3C",
        "skill": "Fraction Word Problems",
        "problems": [
            {"id": "5-N03-P1", "type": "word_problem", "question": "Sam has 3/4 of a gallon of paint. He uses 1/3 of it. How much paint did he use?", "answer": "1/4 gallon", "hint": "What does 'of' mean in math? Think about the operation."},
            {"id": "5-N03-P2", "type": "word_problem", "question": "A rope is 5/6 yard long. If you cut off 1/4 yard, how much rope is left?", "answer": "7/12 yard", "hint": "Cutting off means you need to subtract."},
        ]
    },
    "5-N04": {
        "teks": "5.3D",
        "skill": "Decimal Multiplication",
        "problems": [
            {"id": "5-N04-P1", "type": "procedural", "question": "What is 3.5 × 4?", "answer": "14", "hint": "You can think of 3.5 as 3 + 0.5. Multiply each part by 4."},
            {"id": "5-N04-P2", "type": "procedural", "question": "Calculate: 2.8 × 6", "answer": "16.8", "hint": "28 × 6 = 168. Now place the decimal point."},
            {"id": "5-N04-P3", "type": "word_problem", "question": "Apples cost $1.25 each. How much do 7 apples cost?", "answer": "$8.75", "hint": "Multiply the price by the quantity."},
        ]
    },
    "5-N05": {"teks": "5.3E", "skill": "Decimal Division", "problems": [{"id": "5-N05-P1", "type": "procedural", "question": "What is 8.4 ÷ 4?", "answer": "2.1", "hint": "Divide 84 by 4 first, then place the decimal."}]},
    "5-N06": {"teks": "5.3G", "skill": "Decimal-Fraction Connection", "problems": [{"id": "5-N06-P1", "type": "procedural", "question": "Write 0.75 as a fraction in simplest form.", "answer": "3/4", "hint": "0.75 = 75/100. Can you simplify this?"}]},
    "5-N07": {"teks": "5.3K", "skill": "Number Line", "problems": [{"id": "5-N07-P1", "type": "procedural", "question": "Place 2/3 on a number line between 0 and 1. Is it closer to 0, 1/2, or 1?", "answer": "Closer to 1", "hint": "2/3 ≈ 0.67. Compare to 0.5."}]},
    "5-N08": {"teks": "5.3L", "skill": "Estimation", "problems": [{"id": "5-N08-P1", "type": "procedural", "question": "Estimate 7/8 + 4/5. Is the answer closer to 1, 1.5, or 2?", "answer": "Closer to 2", "hint": "7/8 is close to 1. 4/5 is close to 1."}]},
    "5-N09": {"teks": "5.2A", "skill": "Place Value", "problems": [{"id": "5-N09-P1", "type": "procedural", "question": "In the number 4,567,890,123, what is the value of the digit 5?", "answer": "500,000,000", "hint": "Count the place values from right to left."}]},
    "5-N10": {"teks": "5.2B", "skill": "Compare Numbers", "problems": [{"id": "5-N10-P1", "type": "procedural", "question": "Which is greater: 3,456,789,012 or 3,465,789,012?", "answer": "3,465,789,012", "hint": "Compare digit by digit from left to right."}]},
    "5-N11": {"teks": "5.2C", "skill": "Rounding", "problems": [{"id": "5-N11-P1", "type": "procedural", "question": "Round 4,567,890,123 to the nearest billion.", "answer": "5,000,000,000", "hint": "Look at the hundred millions digit."}]},
    "5-N12": {"teks": "5.4A", "skill": "Multi-Digit Operations", "problems": [{"id": "5-N12-P1", "type": "procedural", "question": "Calculate: 456 × 78", "answer": "35,568", "hint": "Use the standard algorithm."}]},
    "5-N13": {"teks": "5.4B", "skill": "Prime Factorization", "problems": [{"id": "5-N13-P1", "type": "procedural", "question": "Find the prime factorization of 36.", "answer": "2² × 3²", "hint": "Start by dividing by 2."}]},
    "5-N14": {"teks": "5.4C", "skill": "Order of Operations", "problems": [{"id": "5-N14-P1", "type": "procedural", "question": "Solve: 3 + 4 × 2", "answer": "11", "hint": "Remember PEMDAS."}]},
    "5-N15": {"teks": "5.4E", "skill": "Algebraic Expressions", "problems": [{"id": "5-N15-P1", "type": "procedural", "question": "If n = 5, what is 3n + 7?", "answer": "22", "hint": "Replace n with 5."}]},
    "5-N16": {"teks": "5.4F", "skill": "Simplify Expressions", "problems": [{"id": "5-N16-P1", "type": "procedural", "question": "Simplify: 2³ × 3²", "answer": "72", "hint": "2³ = 8. 3² = 9."}]},
    "5-N17": {"teks": "5.5A", "skill": "2D Shapes", "problems": [{"id": "5-N17-P1", "type": "procedural", "question": "A quadrilateral has 4 right angles and 4 equal sides. What is it called?", "answer": "Square", "hint": "4 equal sides = rhombus. 4 right angles = rectangle."}]},
    "5-N18": {"teks": "5.6A", "skill": "Ordered Pairs", "problems": [{"id": "5-N18-P1", "type": "procedural", "question": "What ordered pair represents a point 3 units right and 5 units up from the origin?", "answer": "(3, 5)", "hint": "First number is x, second is y."}]},
    "5-N19": {"teks": "5.6B", "skill": "Graphing", "problems": [{"id": "5-N19-P1", "type": "procedural", "question": "Where is the point (4, 2) located on a coordinate plane?", "answer": "4 units right, 2 units up", "hint": "Start at origin."}]},
    "5-N20": {"teks": "5.9A", "skill": "Data Analysis", "problems": [{"id": "5-N20-P1", "type": "word_problem", "question": "A graph shows test scores: 75, 80, 85, 90, 95. What's the mean score?", "answer": "85", "hint": "Add all scores. Divide by count."}]},
}

# ══════════════════════════════════════════════════════════════════════════════
# LLM SYSTEM PROMPTS
# ══════════════════════════════════════════════════════════════════════════════

CLASSIFIER_SYSTEM_PROMPT = """You are a math error classification engine. Return ONLY a valid JSON object.

Required schema:
{
  "error_type": "<CORRECT|CONCEPTUAL|PROCEDURAL|CARELESS|VOCABULARY|PREREQ_GAP|HELP_REQUEST|OFF_TASK>",
  "confidence": <float 0.0-1.0>,
  "evidence": "<one sentence max 20 words>"
}

Rules:
- CORRECT: Student's answer matches correct answer (accept equivalent forms)
- CONCEPTUAL: Wrong operation or misunderstood problem
- PROCEDURAL: Right approach, execution error
- VOCABULARY: Misunderstood math term
- PREREQ_GAP: Missing foundational skill
- HELP_REQUEST: Asking for help ("help", "stuck", "confused")
- OFF_TASK: Non-math response"""

TUTOR_SYSTEM_PROMPT = """ABSOLUTE RULE: You are talking directly to a 10-year-old child. You must NEVER break character. You must NEVER reference system data, conversation history conflicts, or talk to the developer. If the input is confusing, just ask the student a gentle clarifying math question.

You are a warm, encouraging math tutor named "Nova". Your job is to ask ONE guiding question that helps the student find their own mistake.

THE ONE ABSOLUTE RULE: YOU MUST NEVER REVEAL THE CORRECT ANSWER.

RESPONSE RULES:
- 2-4 sentences maximum
- End with exactly ONE question mark
- Never say "almost", "close", or reveal error magnitude
- Reference something specific from student's answer
- NEVER mention "error_type", "classification", "JSON", "system"

ERROR-TYPE STRATEGIES:
- CORRECT: Celebrate! Ask if they want a harder problem
- CONCEPTUAL: Redirect to re-read the problem
- PROCEDURAL: Ask about the specific step that went wrong
- VOCABULARY: Define the misunderstood term simply
- PREREQ_GAP: Step back to foundational skill
- HELP_REQUEST: Validate frustration, ask what part confuses them
- OFF_TASK: Gently redirect to the problem"""

SOCRATIC_HINTS = {
    "HELP_REQUEST": ["It's okay to feel stuck! What's the very first part of this problem that confuses you?"],
    "CORRECT": ["Excellent work! You nailed it! 🌟 Ready for a trickier problem?"],
    "CONCEPTUAL": ["Let's think about what the problem is really asking. What operation do you think fits here?"],
    "PROCEDURAL": ["You're on the right track! Can you walk me through your steps one more time?"],
    "VOCABULARY": ["Let me help with that math word. What do you think it means?"],
    "PREREQ_GAP": ["Let's take a small step back. Can you show me how you'd solve a simpler version?"],
    "OFF_TASK": ["Let's get back to our math adventure! Take another look at the problem."],
}

# Problem Generation Prompt
PROBLEM_GENERATOR_PROMPT = """You are a 5th-grade math problem generator aligned to Texas TEKS standards. Generate practice problems that are grade-appropriate, engaging, and mathematically sound.

OUTPUT FORMAT: Return ONLY valid JSON array with no markdown fences. Each problem must have:
{
  "type": "procedural" or "word_problem",
  "problem_text": "Clear problem statement (plain text, use fractions like 1/2 not LaTeX)",
  "correct_answer": "The correct answer as a string",
  "hint": "A Socratic hint that guides without revealing the answer",
  "difficulty": 1 (easy), 2 (medium), or 3 (hard),
  "dalle_prompt": "Optional: A simple, child-friendly illustration prompt if the problem would benefit from a visual. Use clear, concrete imagery. Set to null if no image needed."
}

RULES:
1. Problems must be appropriate for 10-year-olds
2. Use real-world contexts kids relate to (pizza, toys, games, sports, pets)
3. NO LaTeX syntax - write fractions as "1/2", "3/4" etc.
4. Include a mix of procedural and word problems
5. Hints should guide thinking, NEVER reveal the answer
6. DALL-E prompts should be simple, child-safe, educational illustrations
7. Generate exactly the number of problems requested"""

# ══════════════════════════════════════════════════════════════════════════════
# SKILL GRAPH DATA (for seeding)
# ══════════════════════════════════════════════════════════════════════════════

SKILL_GRAPH_SEED = [
    # Grade 4 Prerequisites
    {"id": "4.2A", "teks": "4.2A", "name": "Place Value", "description": "Interpret value of each digit in whole numbers", "grade": 4, "prerequisites": [], "unlocks": ["5-N09"], "x": 5, "y": 85},
    {"id": "4.2B", "teks": "4.2B", "name": "Compare Numbers", "description": "Compare and order whole numbers", "grade": 4, "prerequisites": [], "unlocks": ["5-N09", "5-N10", "5-N11"], "x": 15, "y": 90},
    {"id": "4.2D", "teks": "4.2D", "name": "Round Numbers", "description": "Round whole numbers to a given place value", "grade": 4, "prerequisites": [], "unlocks": ["5-N11"], "x": 25, "y": 85},
    {"id": "4.2E", "teks": "4.2E", "name": "Decimal Place Value", "description": "Represent decimals with place value models", "grade": 4, "prerequisites": [], "unlocks": ["5-N09", "5-N04"], "x": 35, "y": 90},
    {"id": "4.2F", "teks": "4.2F", "name": "Compare Decimals", "description": "Compare and order decimals", "grade": 4, "prerequisites": [], "unlocks": ["5-N10"], "x": 45, "y": 85},
    {"id": "4.3B", "teks": "4.3B", "name": "Equivalent Fractions", "description": "Determine equivalent fractions", "grade": 4, "prerequisites": [], "unlocks": ["5-N01", "5-N02", "5-N08"], "x": 10, "y": 75},
    {"id": "4.3C", "teks": "4.3C", "name": "Benchmark Fractions", "description": "Compare fractions using benchmarks", "grade": 4, "prerequisites": [], "unlocks": ["5-N01"], "x": 20, "y": 70},
    {"id": "4.3E", "teks": "4.3E", "name": "Fraction Models", "description": "Represent fractions with models", "grade": 4, "prerequisites": [], "unlocks": ["5-N01"], "x": 5, "y": 65},
    {"id": "4.4A", "teks": "4.4A", "name": "Addition Strategies", "description": "Add whole numbers using strategies", "grade": 4, "prerequisites": [], "unlocks": ["5-N12", "5-N14"], "x": 55, "y": 90},
    {"id": "4.4B", "teks": "4.4B", "name": "Subtraction Strategies", "description": "Subtract whole numbers using strategies", "grade": 4, "prerequisites": [], "unlocks": ["5-N12"], "x": 65, "y": 85},
    {"id": "4.4D", "teks": "4.4D", "name": "Multiply 2-Digit", "description": "Multiply 2-digit by 2-digit numbers", "grade": 4, "prerequisites": [], "unlocks": ["5-N02", "5-N04", "5-N13", "5-N16", "5-N19"], "x": 50, "y": 75},
    {"id": "4.4E", "teks": "4.4E", "name": "Division Remainders", "description": "Division with remainders interpretation", "grade": 4, "prerequisites": [], "unlocks": ["5-N05", "5-N12"], "x": 60, "y": 70},
    {"id": "4.4F", "teks": "4.4F", "name": "Decimal Operations", "description": "Add/subtract decimals with models", "grade": 4, "prerequisites": [], "unlocks": ["5-N05", "5-N08"], "x": 70, "y": 75},
    {"id": "4.4G", "teks": "4.4G", "name": "Fraction Addition", "description": "Add fractions with like denominators", "grade": 4, "prerequisites": [], "unlocks": ["5-N05"], "x": 75, "y": 80},
    {"id": "4.5A", "teks": "4.5A", "name": "Multi-Step Problems", "description": "Solve multi-step problems", "grade": 4, "prerequisites": [], "unlocks": ["5-N13", "5-N14", "5-N15", "5-N16", "5-N20"], "x": 80, "y": 85},
    {"id": "4.5B", "teks": "4.5B", "name": "Strip Diagrams", "description": "Use strip diagrams to represent problems", "grade": 4, "prerequisites": [], "unlocks": ["5-N13", "5-N14", "5-N15"], "x": 85, "y": 80},
    {"id": "4.5C", "teks": "4.5C", "name": "Input-Output Tables", "description": "Use input-output tables", "grade": 4, "prerequisites": [], "unlocks": ["5-N18"], "x": 90, "y": 85},
    {"id": "4.5D", "teks": "4.5D", "name": "Equations", "description": "Solve equations with variables", "grade": 4, "prerequisites": [], "unlocks": ["5-N18", "5-N19"], "x": 85, "y": 90},
    {"id": "4.6A", "teks": "4.6A", "name": "Points on Grid", "description": "Identify points on coordinate grid", "grade": 4, "prerequisites": [], "unlocks": ["5-N17"], "x": 90, "y": 75},
    {"id": "4.6B", "teks": "4.6B", "name": "Graph Data", "description": "Graph data from tables", "grade": 4, "prerequisites": [], "unlocks": ["5-N17", "5-N18"], "x": 94, "y": 80},
    {"id": "4.6C", "teks": "4.6C", "name": "Data Interpretation", "description": "Interpret data from graphs", "grade": 4, "prerequisites": [], "unlocks": ["5-N17"], "x": 92, "y": 70},
    {"id": "4.9A", "teks": "4.9A", "name": "Data Representation", "description": "Represent data with graphs", "grade": 4, "prerequisites": [], "unlocks": ["5-N20"], "x": 88, "y": 65},
    {"id": "4.9B", "teks": "4.9B", "name": "Data Analysis", "description": "Analyze data from graphs", "grade": 4, "prerequisites": [], "unlocks": ["5-N20"], "x": 93, "y": 60},
    # Grade 5 Nodes
    {"id": "5-N01", "teks": "5.3A", "name": "Add Unlike Fractions", "description": "Add fractions with unlike denominators", "grade": 5, "prerequisites": ["4.3E", "4.3B", "4.3C"], "unlocks": ["5-N02", "5-N07"], "x": 15, "y": 50},
    {"id": "5-N02", "teks": "5.3B", "name": "Multiply Fractions", "description": "Multiply fractions by whole numbers", "grade": 5, "prerequisites": ["5-N01", "4.3B", "4.4D"], "unlocks": ["5-N07", "5-N03"], "x": 25, "y": 40},
    {"id": "5-N03", "teks": "5.3C", "name": "Fraction Word Problems", "description": "Solve word problems with fractions", "grade": 5, "prerequisites": ["5-N01", "5-N02", "5-N06", "5-N08"], "unlocks": [], "x": 35, "y": 15},
    {"id": "5-N04", "teks": "5.3D", "name": "Decimal Multiplication", "description": "Multiply decimals by whole numbers", "grade": 5, "prerequisites": ["4.2E", "4.4D", "5-N09"], "unlocks": ["5-N06", "5-N07"], "x": 45, "y": 45},
    {"id": "5-N05", "teks": "5.3E", "name": "Decimal Division", "description": "Divide decimals by whole numbers", "grade": 5, "prerequisites": ["4.4F", "4.4E", "4.4G"], "unlocks": ["5-N06"], "x": 55, "y": 50},
    {"id": "5-N06", "teks": "5.3G", "name": "Decimal Representations", "description": "Connect decimals and fractions", "grade": 5, "prerequisites": ["5-N05", "5-N04"], "unlocks": ["5-N03", "5-N07"], "x": 50, "y": 30},
    {"id": "5-N07", "teks": "5.3K", "name": "Number Line Representation", "description": "Represent numbers on number lines", "grade": 5, "prerequisites": ["5-N01", "5-N04", "5-N11"], "unlocks": ["5-N20"], "x": 40, "y": 25},
    {"id": "5-N08", "teks": "5.3L", "name": "Estimation with Fractions", "description": "Estimate fraction computations", "grade": 5, "prerequisites": ["5-N02", "4.3B", "4.4F"], "unlocks": ["5-N03"], "x": 30, "y": 25},
    {"id": "5-N09", "teks": "5.2A", "name": "Large Number Place Value", "description": "Place value through billions", "grade": 5, "prerequisites": ["4.2A", "4.2E", "4.2B"], "unlocks": ["5-N10", "5-N04"], "x": 20, "y": 60},
    {"id": "5-N10", "teks": "5.2B", "name": "Compare Large Numbers", "description": "Compare/order numbers through billions", "grade": 5, "prerequisites": ["5-N09", "4.2B", "4.2F"], "unlocks": ["5-N11"], "x": 30, "y": 55},
    {"id": "5-N11", "teks": "5.2C", "name": "Round Large Numbers", "description": "Round numbers through billions", "grade": 5, "prerequisites": ["5-N10", "4.2D", "4.2B"], "unlocks": ["5-N07"], "x": 35, "y": 45},
    {"id": "5-N12", "teks": "5.4A", "name": "Multi-Digit Operations", "description": "Multiply/divide multi-digit numbers", "grade": 5, "prerequisites": ["4.4E", "4.4B", "4.4A"], "unlocks": ["5-N13"], "x": 60, "y": 55},
    {"id": "5-N13", "teks": "5.4B", "name": "Prime Factorization", "description": "Find prime factorization", "grade": 5, "prerequisites": ["4.5A", "4.4D", "4.5B", "5-N12"], "unlocks": ["5-N16"], "x": 65, "y": 40},
    {"id": "5-N14", "teks": "5.4C", "name": "Order of Operations", "description": "Evaluate expressions with parentheses", "grade": 5, "prerequisites": ["4.5B", "4.4A", "4.5A"], "unlocks": ["5-N15"], "x": 70, "y": 50},
    {"id": "5-N15", "teks": "5.4E", "name": "Algebraic Expressions", "description": "Write and solve expressions", "grade": 5, "prerequisites": ["5-N14", "4.5B", "4.5A"], "unlocks": ["5-N20"], "x": 75, "y": 35},
    {"id": "5-N16", "teks": "5.4F", "name": "Simplify Expressions", "description": "Simplify numerical expressions", "grade": 5, "prerequisites": ["5-N13", "4.5A", "4.4D"], "unlocks": [], "x": 70, "y": 20},
    {"id": "5-N17", "teks": "5.5A", "name": "Classify 2D Shapes", "description": "Classify 2D shapes by properties", "grade": 5, "prerequisites": ["4.6A", "4.6B", "4.6C"], "unlocks": [], "x": 85, "y": 50},
    {"id": "5-N18", "teks": "5.6A", "name": "Ordered Pairs", "description": "Recognize ordered pairs", "grade": 5, "prerequisites": ["4.5D", "4.6B", "4.5C"], "unlocks": ["5-N19"], "x": 80, "y": 55},
    {"id": "5-N19", "teks": "5.6B", "name": "Graph Ordered Pairs", "description": "Graph ordered pairs on coordinate plane", "grade": 5, "prerequisites": ["5-N18", "4.5D", "4.4D"], "unlocks": [], "x": 85, "y": 35},
    {"id": "5-N20", "teks": "5.9A", "name": "Data Analysis", "description": "Analyze data to make predictions", "grade": 5, "prerequisites": ["4.9A", "4.9B", "4.5A", "5-N15", "5-N07"], "unlocks": [], "x": 60, "y": 10},
]

# ══════════════════════════════════════════════════════════════════════════════
# FASTAPI APP SETUP
# ══════════════════════════════════════════════════════════════════════════════

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    try:
        # Startup: Create tables
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables created")
        
        # Migrate N%% -> 5-N%% node IDs: drop old data and re-seed
        async with AsyncSessionLocal() as session:
            check = await session.execute(
                select(SkillNode).where(SkillNode.id == "N01")
            )
            if check.scalar_one_or_none():
                logger.info("Old N%% format detected. Dropping and re-seeding with 5-N%% format...")
                from sqlalchemy import text
                await session.execute(text("DELETE FROM chat_messages"))
                await session.execute(text("DELETE FROM problem_attempts"))
                await session.execute(text("DELETE FROM mastery_ledgers"))
                await session.execute(text("DELETE FROM practice_problems"))
                await session.execute(text("DELETE FROM edges"))
                await session.execute(text("DELETE FROM students"))
                await session.execute(text("DELETE FROM skill_nodes"))
                await session.commit()
                logger.info("Old data cleared. Re-seeding...")
                await seed_database(session)
                logger.info("Re-seed with 5-N%% format complete")
        
        # Check if seed data exists
        async with AsyncSessionLocal() as session:
            result = await session.execute(select(func.count(Student.id)))
            count = result.scalar()
            if count == 0:
                logger.info("Seeding database with initial data...")
                await seed_database(session)
    except Exception as e:
        logger.error(f"Database startup failed: {e}")
        logger.info("Starting without database connection - some features will be limited")
    
    yield
    
    # Shutdown
    try:
        await engine.dispose()
    except Exception as e:
        logger.error(f"Database shutdown error: {e}")

app = FastAPI(title="MathQuest API", version="2.0.0", lifespan=lifespan)
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ══════════════════════════════════════════════════════════════════════════════
# DATABASE SEEDING
# ══════════════════════════════════════════════════════════════════════════════

async def seed_database(session: AsyncSession):
    """Seed the database with skill graph and demo students"""
    
    # 1. Create Skill Nodes
    for node_data in SKILL_GRAPH_SEED:
        node = SkillNode(
            id=node_data["id"],
            teks=node_data["teks"],
            name=node_data["name"],
            description=node_data["description"],
            grade=node_data["grade"],
            x_position=node_data["x"],
            y_position=node_data["y"]
        )
        session.add(node)
    
    await session.flush()
    
    # 2. Create Edges (prerequisites)
    for node_data in SKILL_GRAPH_SEED:
        for prereq_id in node_data["prerequisites"]:
            edge = Edge(source_node_id=prereq_id, target_node_id=node_data["id"])
            session.add(edge)
    
    # 3. Create Demo Students
    students_data = [
        {"id": "student-001", "name": "Alex Champion", "avatar_emoji": "🌟", "total_sessions": 45},
        {"id": "student-002", "name": "Jordan Struggling", "avatar_emoji": "🤔", "total_sessions": 18},
        {"id": "student-003", "name": "Sam Careful", "avatar_emoji": "😰", "total_sessions": 32},
    ]
    
    for s_data in students_data:
        student = Student(**s_data)
        session.add(student)
    
    await session.flush()
    
    # 4. Create Mastery Ledgers for each student-node pair
    # Student 1: High Mastery
    for node_data in SKILL_GRAPH_SEED:
        if node_data["grade"] == 4:
            ledger = MasteryLedger(
                student_id="student-001", node_id=node_data["id"],
                accuracy_score=0.92, fluency_weight=0.88, challenge_score=0.85,
                composite_score=0.88, status="MASTERED", sessions_completed=5,
                error_patterns="[]"
            )
        else:
            status_map = {
                "5-N01": ("MASTERED", 0.85), "5-N02": ("MASTERED", 0.82), "5-N03": ("APPROACHING", 0.72),
                "5-N04": ("MASTERED", 0.88), "5-N05": ("MASTERED", 0.84), "5-N06": ("MASTERED", 0.80),
                "5-N07": ("APPROACHING", 0.75), "5-N08": ("MASTERED", 0.86), "5-N09": ("MASTERED", 0.90),
                "5-N10": ("MASTERED", 0.88), "5-N11": ("MASTERED", 0.85), "5-N12": ("MASTERED", 0.87),
                "5-N13": ("APPROACHING", 0.74), "5-N14": ("MASTERED", 0.83), "5-N15": ("OPEN", 0.65),
                "5-N16": ("LOCKED", 0.0), "5-N17": ("MASTERED", 0.81), "5-N18": ("MASTERED", 0.84),
                "5-N19": ("APPROACHING", 0.76), "5-N20": ("LOCKED", 0.0)
            }
            status, score = status_map.get(node_data["id"], ("LOCKED", 0.0))
            ledger = MasteryLedger(
                student_id="student-001", node_id=node_data["id"],
                accuracy_score=score, fluency_weight=0.85, challenge_score=max(0, score-0.05),
                composite_score=score, status=status, sessions_completed=4 if status != "LOCKED" else 0,
                error_patterns="[]"
            )
        session.add(ledger)
    
    # Student 2: Prereq Gap (4.3E failing)
    for node_data in SKILL_GRAPH_SEED:
        if node_data["grade"] == 4:
            if node_data["id"] == "4.3E":
                ledger = MasteryLedger(
                    student_id="student-002", node_id=node_data["id"],
                    accuracy_score=0.55, fluency_weight=0.70, challenge_score=0.45,
                    composite_score=0.52, status="PRACTICING", sessions_completed=6,
                    error_patterns='["CONCEPTUAL", "PREREQ_GAP"]'
                )
            else:
                ledger = MasteryLedger(
                    student_id="student-002", node_id=node_data["id"],
                    accuracy_score=0.82, fluency_weight=0.78, challenge_score=0.75,
                    composite_score=0.78, status="MASTERED", sessions_completed=4,
                    error_patterns="[]"
                )
        else:
            status_map = {
                "5-N01": ("BLOCKED", 0.58, '["PREREQ_GAP"]'), "5-N02": ("LOCKED", 0.0, "[]"),
                "5-N03": ("LOCKED", 0.0, "[]"), "5-N04": ("PRACTICING", 0.62, '["PROCEDURAL"]'),
                "5-N05": ("PRACTICING", 0.65, "[]"), "5-N06": ("LOCKED", 0.0, "[]"),
                "5-N07": ("LOCKED", 0.0, "[]"), "5-N08": ("LOCKED", 0.0, "[]"),
                "5-N09": ("MASTERED", 0.80, "[]"), "5-N10": ("APPROACHING", 0.72, "[]"),
                "5-N11": ("LOCKED", 0.0, "[]"), "5-N12": ("APPROACHING", 0.70, '["PROCEDURAL"]'),
                "5-N13": ("LOCKED", 0.0, "[]"), "5-N14": ("PRACTICING", 0.68, "[]"),
                "5-N15": ("LOCKED", 0.0, "[]"), "5-N16": ("LOCKED", 0.0, "[]"),
                "5-N17": ("OPEN", 0.50, "[]"), "5-N18": ("PRACTICING", 0.64, "[]"),
                "5-N19": ("LOCKED", 0.0, "[]"), "5-N20": ("LOCKED", 0.0, "[]")
            }
            status, score, errors = status_map.get(node_data["id"], ("LOCKED", 0.0, "[]"))
            ledger = MasteryLedger(
                student_id="student-002", node_id=node_data["id"],
                accuracy_score=score, fluency_weight=0.75, challenge_score=max(0, score-0.08),
                composite_score=score, status=status, sessions_completed=3 if status != "LOCKED" else 0,
                error_patterns=errors
            )
        session.add(ledger)
    
    # Student 3: Anxious (high accuracy, low fluency)
    for node_data in SKILL_GRAPH_SEED:
        if node_data["grade"] == 4:
            ledger = MasteryLedger(
                student_id="student-003", node_id=node_data["id"],
                accuracy_score=0.88, fluency_weight=0.65, challenge_score=0.78,
                composite_score=0.76, status="MASTERED", sessions_completed=5,
                anxiety_flag=True, error_patterns="[]"
            )
        else:
            status_map = {
                "5-N01": ("MASTERED", 0.82, 0.68), "5-N02": ("MASTERED", 0.80, 0.65),
                "5-N03": ("PRACTICING", 0.75, 0.62), "5-N04": ("APPROACHING", 0.78, 0.64),
                "5-N05": ("APPROACHING", 0.76, 0.66), "5-N06": ("LOCKED", 0.0, 0.6),
                "5-N07": ("LOCKED", 0.0, 0.6), "5-N08": ("APPROACHING", 0.74, 0.63),
                "5-N09": ("MASTERED", 0.85, 0.70), "5-N10": ("MASTERED", 0.83, 0.68),
                "5-N11": ("APPROACHING", 0.77, 0.65), "5-N12": ("PRACTICING", 0.72, 0.60),
                "5-N13": ("LOCKED", 0.0, 0.6), "5-N14": ("PRACTICING", 0.70, 0.62),
                "5-N15": ("LOCKED", 0.0, 0.6), "5-N16": ("LOCKED", 0.0, 0.6),
                "5-N17": ("APPROACHING", 0.75, 0.64), "5-N18": ("PRACTICING", 0.73, 0.61),
                "5-N19": ("LOCKED", 0.0, 0.6), "5-N20": ("LOCKED", 0.0, 0.6)
            }
            status, accuracy, fluency = status_map.get(node_data["id"], ("LOCKED", 0.0, 0.6))
            anxiety = fluency < 0.80 and accuracy > 0.70
            ledger = MasteryLedger(
                student_id="student-003", node_id=node_data["id"],
                accuracy_score=accuracy, fluency_weight=fluency, challenge_score=max(0, accuracy-0.05),
                composite_score=accuracy * 0.5 + max(0, accuracy-0.05) * 0.5 if accuracy > 0 else 0,
                status=status, sessions_completed=4 if status != "LOCKED" else 0,
                anxiety_flag=anxiety, error_patterns="[]"
            )
        session.add(ledger)
    
    await session.commit()
    logger.info("Database seeded successfully!")

# ══════════════════════════════════════════════════════════════════════════════
# API ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@api_router.get("/")
async def root():
    return {"message": "MathQuest API v2.0 (PostgreSQL)", "status": "operational"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "database": "PostgreSQL", "timestamp": datetime.now(timezone.utc).isoformat()}

# ─────────────────────────────────────────────────────────────────────────────
# SKILL GRAPH ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

@api_router.get("/skill-graph")
async def get_skill_graph(db: AsyncSession = Depends(get_db)):
    """Get the complete skill graph DAG structure"""
    # Get all nodes
    result = await db.execute(select(SkillNode))
    nodes = result.scalars().all()
    
    # Get all edges
    edge_result = await db.execute(select(Edge))
    edges = edge_result.scalars().all()
    
    # Build response
    node_responses = []
    for node in nodes:
        prereqs = [e.source_node_id for e in edges if e.target_node_id == node.id]
        unlocks = [e.target_node_id for e in edges if e.source_node_id == node.id]
        node_responses.append({
            "id": node.id,
            "node_id": node.id,
            "teks": node.teks,
            "name": node.name,
            "description": node.description,
            "grade": node.grade,
            "x_position": node.x_position,
            "y_position": node.y_position,
            "prerequisites": prereqs,
            "unlocks": unlocks
        })
    
    edge_responses = [{"from": e.source_node_id, "to": e.target_node_id} for e in edges]
    
    return {"nodes": node_responses, "edges": edge_responses}

@api_router.get("/skill-graph/node/{node_id}")
async def get_skill_node(node_id: str, db: AsyncSession = Depends(get_db)):
    """Get details for a specific skill node"""
    result = await db.execute(select(SkillNode).where(SkillNode.id == node_id))
    node = result.scalar_one_or_none()
    if not node:
        raise HTTPException(status_code=404, detail=f"Node {node_id} not found")
    return node

# ─────────────────────────────────────────────────────────────────────────────
# STUDENT ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

@api_router.get("/students")
async def get_students(db: AsyncSession = Depends(get_db)):
    students_result = await db.execute(select(Student))
    students = students_result.scalars().all()

    student_ids = [s.id for s in students]
    ledgers_result = await db.execute(
        select(MasteryLedger).where(MasteryLedger.student_id.in_(student_ids))
    )
    all_ledgers = ledgers_result.scalars().all()

    ledgers_by_student: dict[str, list] = {s.id: [] for s in students}
    for l in all_ledgers:
        ledgers_by_student[l.student_id].append(l)

    response = []
    for student in students:
        ledgers = ledgers_by_student[student.id]
        grade5_ledgers = [l for l in ledgers if l.node_id.startswith("5-N")]
        nodes_mastered = sum(1 for l in grade5_ledgers if l.status == "MASTERED")
        anxiety_flags = sum(1 for l in ledgers if l.anxiety_flag)

        all_errors: set[str] = set()
        for l in ledgers:
            try:
                errors = json.loads(l.error_patterns) if l.error_patterns else []
                all_errors.update(errors)
            except (json.JSONDecodeError, TypeError):
                pass

        composites = [l.composite_score for l in grade5_ledgers if l.composite_score > 0]
        overall = sum(composites) / len(composites) if composites else 0

        response.append({
            "id": student.id,
            "name": student.name,
            "avatar_emoji": student.avatar_emoji,
            "grade": student.grade,
            "overall_composite": round(overall, 2),
            "nodes_mastered": nodes_mastered,
            "total_nodes": 20,
            "anxiety_flags": anxiety_flags,
            "error_patterns": list(all_errors)
        })

    return response

class CreateStudentRequest(BaseModel):
    name: str

STUDENT_AVATARS = ["🌟", "🚀", "🦊", "🐬", "🎯", "⚡", "🌈", "🔥", "🎨", "🦁", "🐉", "🌸", "🎵", "🏆", "💎"]

@api_router.post("/students")
async def create_student(req: CreateStudentRequest, db: AsyncSession = Depends(get_db)):
    """Create a new student with auto-generated avatar"""
    import random
    
    # Pick a random avatar
    avatar = random.choice(STUDENT_AVATARS)
    
    student = Student(
        id=str(uuid.uuid4()),
        name=req.name.strip(),
        avatar_emoji=avatar
    )
    db.add(student)
    await db.flush()
    
    # Create mastery ledgers for all grade-5 nodes
    grade5_result = await db.execute(
        select(SkillNode).where(SkillNode.id.like("5-N%"))
    )
    grade5_nodes = grade5_result.scalars().all()
    
    for node in grade5_nodes:
        ledger = MasteryLedger(
            student_id=student.id,
            node_id=node.id
        )
        db.add(ledger)
    
    await db.commit()
    
    return {
        "id": student.id,
        "name": student.name,
        "avatar_emoji": student.avatar_emoji,
        "grade": student.grade,
        "overall_composite": 0,
        "nodes_mastered": 0,
        "total_nodes": 20,
        "anxiety_flags": 0,
        "error_patterns": []
    }

class UpdateGradeRequest(BaseModel):
    grade: int

@api_router.patch("/students/{student_id}/grade")
async def update_student_grade(student_id: str, req: UpdateGradeRequest, db: AsyncSession = Depends(get_db)):
    """Set a student's grade level"""
    result = await db.execute(select(Student).where(Student.id == student_id))
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    student.grade = req.grade
    await db.commit()
    return {"id": student.id, "name": student.name, "grade": student.grade}

@api_router.get("/students/{student_id}")
async def get_student(student_id: str, db: AsyncSession = Depends(get_db)):
    """Get detailed student data"""
    result = await db.execute(select(Student).where(Student.id == student_id))
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Get mastery data
    ledger_result = await db.execute(
        select(MasteryLedger).where(MasteryLedger.student_id == student_id)
    )
    ledgers = ledger_result.scalars().all()
    
    mastery_data = {}
    for l in ledgers:
        mastery_data[l.node_id] = {
            "node_id": l.node_id,
            "accuracy_score": l.accuracy_score,
            "fluency_weight": l.fluency_weight,
            "challenge_score": l.challenge_score,
            "composite_score": l.composite_score,
            "status": l.status,
            "sessions_completed": l.sessions_completed,
            "anxiety_flag": l.anxiety_flag,
            "error_patterns": json.loads(l.error_patterns) if l.error_patterns else []
        }
    
    return {
        "id": student.id,
        "name": student.name,
        "avatar_emoji": student.avatar_emoji,
        "grade": student.grade,
        "classroom": student.classroom,
        "total_sessions": student.total_sessions,
        "mastery_data": mastery_data
    }

@api_router.get("/students/{student_id}/progress")
async def get_student_progress(student_id: str, db: AsyncSession = Depends(get_db)):
    """Get student's progress across all skill nodes"""
    student = await get_student(student_id, db)
    
    # Find recommended node
    recommended = None
    for node_id in ["5-N01", "5-N02", "5-N03", "5-N04", "5-N05"]:
        status = student["mastery_data"].get(node_id, {}).get("status", "LOCKED")
        if status in ["OPEN", "PRACTICING", "APPROACHING"]:
            recommended = node_id
            break
    
    return {
        "student": student,
        "skill_progress": student["mastery_data"],
        "recommended_node": recommended
    }

@api_router.get("/diagnostic/problems/{grade}")
async def get_diagnostic_problems(grade: int, db: AsyncSession = Depends(get_db)):
    """Get 5 diagnostic problems spread across nodes for a given grade"""
    grade_prefix = f"{grade}-N"
    
    # Get all nodes for this grade
    result = await db.execute(
        select(SkillNode).where(SkillNode.id.like(f"{grade_prefix}%"))
    )
    nodes = result.scalars().all()
    
    if not nodes:
        return {"problems": [], "message": f"No content available for grade {grade} yet"}
    
    # Pick up to 5 spread-out nodes
    import random
    node_ids = [n.id for n in nodes]
    if len(node_ids) > 5:
        step = len(node_ids) // 5
        selected_nodes = [node_ids[i * step] for i in range(5)]
    else:
        selected_nodes = node_ids[:5]
    
    problems = []
    for node_id in selected_nodes:
        # Try DB problems first
        prob_result = await db.execute(
            select(PracticeProblem).where(
                and_(PracticeProblem.node_id == node_id, PracticeProblem.is_active == True)
            )
        )
        db_problems = prob_result.scalars().all()
        
        if db_problems:
            p = random.choice(db_problems)
            node_result = await db.execute(select(SkillNode).where(SkillNode.id == node_id))
            node = node_result.scalar_one_or_none()
            problems.append({
                "problem_id": p.id,
                "question": p.problem_text,
                "answer": p.correct_answer,
                "node_id": node_id,
                "skill_name": node.name if node else node_id,
                "teks": p.teks,
                "problem_type": p.type,
                "image_url": p.image_url
            })
        elif node_id in PROBLEM_BANK:
            bank = PROBLEM_BANK[node_id]
            p = random.choice(bank["problems"])
            problems.append({
                "problem_id": p["id"],
                "question": p["question"],
                "answer": p["answer"],
                "node_id": node_id,
                "skill_name": bank["skill"],
                "teks": bank["teks"],
                "problem_type": p["type"],
                "image_url": None
            })
    
    return {"problems": problems, "grade": grade}

@api_router.post("/diagnostic/submit")
async def submit_diagnostic(req: DiagnosticSubmitRequest, db: AsyncSession = Depends(get_db)):
    """Persist diagnostic results: correct nodes → MASTERED, incorrect → OPEN, unlock downstream"""
    # Verify student exists
    student_result = await db.execute(select(Student).where(Student.id == req.student_id))
    student = student_result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Get all edges for downstream unlocking
    edge_result = await db.execute(select(Edge))
    edges = edge_result.scalars().all()
    
    nodes_to_open = set()
    
    for result in req.results:
        # Update the mastery ledger for this node
        ledger_result = await db.execute(
            select(MasteryLedger).where(
                and_(MasteryLedger.student_id == req.student_id, MasteryLedger.node_id == result.node_id)
            )
        )
        ledger = ledger_result.scalar_one_or_none()
        
        if ledger:
            if result.is_correct:
                ledger.status = "MASTERED"
                ledger.composite_score = 0.78
                ledger.accuracy_score = 1.0
                # Find downstream nodes to unlock
                for edge in edges:
                    if edge.source_node_id == result.node_id:
                        nodes_to_open.add(edge.target_node_id)
            else:
                ledger.status = "OPEN"
                ledger.composite_score = 0.0
                ledger.accuracy_score = 0.0
                # Gap node itself should be open for practice
                nodes_to_open.add(result.node_id)
    
    # Open downstream/related nodes that are still locked
    for node_id in nodes_to_open:
        ledger_result = await db.execute(
            select(MasteryLedger).where(
                and_(MasteryLedger.student_id == req.student_id, MasteryLedger.node_id == node_id)
            )
        )
        ledger = ledger_result.scalar_one_or_none()
        if ledger and ledger.status == "LOCKED":
            ledger.status = "OPEN"
    
    await db.commit()
    
    correct_count = sum(1 for r in req.results if r.is_correct)
    return {
        "message": "Diagnostic results saved",
        "correct": correct_count,
        "total": len(req.results),
        "nodes_unlocked": len(nodes_to_open)
    }

# ─────────────────────────────────────────────────────────────────────────────
# TEACHER DASHBOARD ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

@api_router.get("/teacher/dashboard")
async def get_teacher_dashboard(db: AsyncSession = Depends(get_db)):
    students_result = await db.execute(select(Student))
    students = students_result.scalars().all()

    student_ids = [s.id for s in students]
    ledgers_result = await db.execute(
        select(MasteryLedger).where(MasteryLedger.student_id.in_(student_ids))
    )
    all_ledgers = ledgers_result.scalars().all()

    ledgers_by_student: dict[str, list] = {s.id: [] for s in students}
    for l in all_ledgers:
        ledgers_by_student[l.student_id].append(l)

    dashboard_data = []
    for student in students:
        ledgers = ledgers_by_student[student.id]
        grade5_ledgers = [l for l in ledgers if l.node_id.startswith("5-N")]
        composites = [l.composite_score for l in grade5_ledgers if l.composite_score > 0]
        avg_composite = sum(composites) / len(composites) if composites else 0

        nodes_mastered = sum(1 for l in grade5_ledgers if l.status == "MASTERED")
        blocked_nodes = [l.node_id for l in grade5_ledgers if l.status == "BLOCKED"]
        anxiety_count = sum(1 for l in ledgers if l.anxiety_flag)

        all_errors: list[str] = []
        for l in ledgers:
            try:
                errors = json.loads(l.error_patterns) if l.error_patterns else []
                all_errors.extend(errors)
            except (json.JSONDecodeError, TypeError):
                pass

        needs_attention = anxiety_count > 3 or len(blocked_nodes) > 0 or "PREREQ_GAP" in all_errors

        dashboard_data.append({
            "student_id": student.id,
            "name": student.name,
            "avatar_emoji": student.avatar_emoji,
            "overall_composite": round(avg_composite, 2),
            "nodes_mastered": nodes_mastered,
            "total_grade5_nodes": 20,
            "blocked_nodes": blocked_nodes,
            "anxiety_flags": anxiety_count,
            "error_patterns": list(set(all_errors)),
            "sessions_total": student.total_sessions,
            "needs_attention": needs_attention
        })

    return {
        "students": dashboard_data,
        "class_summary": {
            "total_students": len(dashboard_data),
            "students_on_track": sum(1 for s in dashboard_data if s["overall_composite"] >= 0.70),
            "students_struggling": sum(1 for s in dashboard_data if s["overall_composite"] < 0.60),
            "students_with_anxiety": sum(1 for s in dashboard_data if s["anxiety_flags"] > 0)
        }
    }

@api_router.get("/teacher/student/{student_id}/detail")
async def get_teacher_student_detail(student_id: str, db: AsyncSession = Depends(get_db)):
    """Get detailed breakdown of student performance for teacher view"""
    result = await db.execute(select(Student).where(Student.id == student_id))
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Get all nodes
    nodes_result = await db.execute(select(SkillNode))
    nodes = nodes_result.scalars().all()
    
    # Get student's mastery ledgers
    ledger_result = await db.execute(
        select(MasteryLedger).where(MasteryLedger.student_id == student_id)
    )
    ledgers = {l.node_id: l for l in ledger_result.scalars().all()}
    
    node_details = []
    for node in nodes:
        ledger = ledgers.get(node.id)
        node_details.append({
            "node_id": node.id,
            "teks": node.teks,
            "name": node.name,
            "grade": node.grade,
            "status": ledger.status if ledger else "LOCKED",
            "accuracy_score": round(ledger.accuracy_score, 2) if ledger else 0,
            "fluency_weight": round(ledger.fluency_weight, 2) if ledger else 0.6,
            "challenge_score": round(ledger.challenge_score, 2) if ledger else 0,
            "composite_score": round(ledger.composite_score, 2) if ledger else 0,
            "sessions_completed": ledger.sessions_completed if ledger else 0,
            "error_patterns": json.loads(ledger.error_patterns) if ledger and ledger.error_patterns else [],
            "anxiety_flag": ledger.anxiety_flag if ledger else False
        })
    
    return {
        "student": {
            "id": student.id,
            "name": student.name,
            "avatar_emoji": student.avatar_emoji,
            "grade": student.grade,
            "classroom": student.classroom,
            "total_sessions": student.total_sessions
        },
        "node_details": node_details,
        "grade4_nodes": [n for n in node_details if n["grade"] == 4],
        "grade5_nodes": [n for n in node_details if n["grade"] == 5]
    }

# ─────────────────────────────────────────────────────────────────────────────
# PRACTICE PROBLEMS ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

@api_router.get("/problems/{node_id}", response_model=List[PracticeProblemResponse])
async def get_problems_for_node(node_id: str, db: AsyncSession = Depends(get_db)):
    """Get all active practice problems for a specific skill node"""
    result = await db.execute(
        select(PracticeProblem).where(
            and_(PracticeProblem.node_id == node_id, PracticeProblem.is_active == True)
        )
    )
    problems = result.scalars().all()
    
    # If no problems in DB, fall back to PROBLEM_BANK
    if not problems and node_id in PROBLEM_BANK:
        bank_problems = PROBLEM_BANK[node_id]["problems"]
        return [
            PracticeProblemResponse(
                id=p["id"],
                node_id=node_id,
                teks=PROBLEM_BANK[node_id]["teks"],
                type=p["type"],
                problem_text=p["question"],
                correct_answer=p["answer"],
                hint=p.get("hint"),
                dalle_prompt=None,
                image_url=None,
                difficulty=1,
                is_active=True
            )
            for p in bank_problems
        ]
    
    return [
        PracticeProblemResponse(
            id=p.id,
            node_id=p.node_id,
            teks=p.teks,
            type=p.type,
            problem_text=p.problem_text,
            correct_answer=p.correct_answer,
            hint=p.hint,
            dalle_prompt=p.dalle_prompt,
            image_url=p.image_url,
            difficulty=p.difficulty,
            is_active=p.is_active
        )
        for p in problems
    ]

@api_router.get("/problems/{node_id}/random")
async def get_random_problem(node_id: str, db: AsyncSession = Depends(get_db)):
    """Get a random problem for a specific skill node (DB first, then PROBLEM_BANK fallback)"""
    # Try DB first
    result = await db.execute(
        select(PracticeProblem).where(
            and_(PracticeProblem.node_id == node_id, PracticeProblem.is_active == True)
        )
    )
    problems = result.scalars().all()
    
    if problems:
        problem = random.choice(problems)
        # Get node info
        node_result = await db.execute(select(SkillNode).where(SkillNode.id == node_id))
        node = node_result.scalar_one_or_none()
        
        return ProblemResponse(
            problem_id=problem.id,
            problem_type=problem.type,
            question=problem.problem_text,
            hint=problem.hint or "Think step by step.",
            answer=problem.correct_answer,
            node_id=node_id,
            teks=problem.teks,
            skill_name=node.name if node else "Unknown",
            image_url=problem.image_url
        )
    
    # Fall back to PROBLEM_BANK
    if node_id not in PROBLEM_BANK:
        raise HTTPException(status_code=404, detail=f"No problems found for node {node_id}")
    
    node_problems = PROBLEM_BANK[node_id]
    problem = random.choice(node_problems["problems"])
    
    return ProblemResponse(
        problem_id=problem["id"],
        problem_type=problem["type"],
        question=problem["question"],
        hint=problem["hint"],
        answer=problem["answer"],
        node_id=node_id,
        teks=node_problems["teks"],
        skill_name=node_problems["skill"]
    )

@api_router.post("/problems/create", response_model=PracticeProblemResponse)
async def create_problem(problem: PracticeProblemCreate, db: AsyncSession = Depends(get_db)):
    """Manually create a new practice problem"""
    new_problem = PracticeProblem(
        id=str(uuid.uuid4()),
        node_id=problem.node_id,
        teks=problem.teks,
        type=problem.type,
        problem_text=problem.problem_text,
        correct_answer=problem.correct_answer,
        hint=problem.hint,
        dalle_prompt=problem.dalle_prompt,
        difficulty=problem.difficulty
    )
    db.add(new_problem)
    await db.commit()
    await db.refresh(new_problem)
    
    return PracticeProblemResponse(
        id=new_problem.id,
        node_id=new_problem.node_id,
        teks=new_problem.teks,
        type=new_problem.type,
        problem_text=new_problem.problem_text,
        correct_answer=new_problem.correct_answer,
        hint=new_problem.hint,
        dalle_prompt=new_problem.dalle_prompt,
        image_url=new_problem.image_url,
        difficulty=new_problem.difficulty,
        is_active=new_problem.is_active
    )

@api_router.post("/problems/generate")
async def generate_problems(request: GenerateProblemsRequest, db: AsyncSession = Depends(get_db)):
    """Auto-generate practice problems for a skill node using LLM"""
    # Get the skill node
    node_result = await db.execute(select(SkillNode).where(SkillNode.id == request.node_id))
    node = node_result.scalar_one_or_none()
    
    if not node:
        raise HTTPException(status_code=404, detail=f"Node {request.node_id} not found")
    
    # Build the generation request
    generation_input = {
        "teks": node.teks,
        "skill_name": node.name,
        "skill_description": node.description,
        "grade": node.grade,
        "count": request.count,
        "include_word_problems": request.include_word_problems
    }
    
    try:
        prompt = f"""Generate {request.count} practice problems for:
- TEKS Standard: {node.teks}
- Skill: {node.name}
- Description: {node.description}
- Grade Level: {node.grade}
- Include word problems: {request.include_word_problems}

Return ONLY a JSON array of problem objects."""

        llm_response = await anthropic_client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=2048,
            system=PROBLEM_GENERATOR_PROMPT,
            messages=[{"role": "user", "content": prompt}],
        )
        response_text = llm_response.content[0].text.strip()
        if response_text.startswith("```"):
            lines = response_text.split("\n")
            response_text = "\n".join(lines[1:-1]) if lines[-1].strip() == "```" else "\n".join(lines[1:])
        
        generated_problems = json.loads(response_text.strip())
        
        # Store in database
        created_problems = []
        for gp in generated_problems:
            new_problem = PracticeProblem(
                id=str(uuid.uuid4()),
                node_id=request.node_id,
                teks=node.teks,
                type=gp.get("type", "procedural"),
                problem_text=gp.get("problem_text", ""),
                correct_answer=gp.get("correct_answer", ""),
                hint=gp.get("hint"),
                dalle_prompt=gp.get("dalle_prompt"),
                difficulty=gp.get("difficulty", 1)
            )
            db.add(new_problem)
            created_problems.append({
                "id": new_problem.id,
                "type": new_problem.type,
                "problem_text": new_problem.problem_text,
                "correct_answer": new_problem.correct_answer,
                "hint": new_problem.hint,
                "dalle_prompt": new_problem.dalle_prompt,
                "difficulty": new_problem.difficulty
            })
        
        await db.commit()
        
        logger.info(f"Generated {len(created_problems)} problems for node {request.node_id}")
        
        return {
            "node_id": request.node_id,
            "teks": node.teks,
            "skill_name": node.name,
            "problems_generated": len(created_problems),
            "problems": created_problems
        }
        
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse LLM response: {e}")
        raise HTTPException(status_code=500, detail="Failed to parse generated problems")
    except Exception as e:
        logger.error(f"Problem generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Problem generation failed: {str(e)}")

@api_router.delete("/problems/{problem_id}")
async def delete_problem(problem_id: str, db: AsyncSession = Depends(get_db)):
    """Soft-delete a practice problem (sets is_active to False)"""
    result = await db.execute(select(PracticeProblem).where(PracticeProblem.id == problem_id))
    problem = result.scalar_one_or_none()
    
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")
    
    problem.is_active = False
    await db.commit()
    
    return {"message": "Problem deleted", "problem_id": problem_id}

@api_router.post("/problems/{problem_id}/generate-image")
async def generate_problem_image(problem_id: str, db: AsyncSession = Depends(get_db)):
    """Generate an image for a practice problem using its dalle_prompt"""
    result = await db.execute(select(PracticeProblem).where(PracticeProblem.id == problem_id))
    problem = result.scalar_one_or_none()
    
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")
    
    if not problem.dalle_prompt:
        raise HTTPException(status_code=400, detail="Problem has no DALL-E prompt")
    
    if problem.image_url:
        return {"problem_id": problem_id, "image_url": problem.image_url, "status": "already_exists"}
    
    try:
        img_response = await openai_client.images.generate(
            model="gpt-image-1",
            prompt=f"Simple, child-friendly, educational math illustration: {problem.dalle_prompt}",
            n=1,
            size="1024x1024",
        )

        if not img_response.data or not img_response.data[0].b64_json:
            raise HTTPException(status_code=500, detail="No image generated")

        data_url = f"data:image/png;base64,{img_response.data[0].b64_json}"
        problem.image_url = data_url
        await db.commit()

        logger.info(f"Generated image for problem {problem_id}")
        return {"problem_id": problem_id, "image_url": data_url, "status": "generated"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Image generation failed for problem {problem_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Image generation failed: {str(e)}")

@api_router.post("/problems/generate-images-batch")
async def generate_images_batch(db: AsyncSession = Depends(get_db)):
    """Generate images for all problems that have dalle_prompt but no image_url"""
    result = await db.execute(
        select(PracticeProblem).where(
            and_(
                PracticeProblem.dalle_prompt.isnot(None),
                PracticeProblem.dalle_prompt != "",
                (PracticeProblem.image_url.is_(None) | (PracticeProblem.image_url == "")),
                PracticeProblem.is_active == True
            )
        )
    )
    problems = result.scalars().all()
    
    if not problems:
        return {"message": "No problems need image generation", "generated": 0, "total": 0}
    
    generated = 0
    errors = []
    
    for problem in problems:
        try:
            img_response = await openai_client.images.generate(
                model="gpt-image-1",
                prompt=f"Simple, child-friendly, educational math illustration: {problem.dalle_prompt}",
                n=1,
                size="1024x1024",
            )

            if img_response.data and img_response.data[0].b64_json:
                problem.image_url = f"data:image/png;base64,{img_response.data[0].b64_json}"
                generated += 1
                logger.info(f"Generated image for problem {problem.id}")
        except Exception as e:
            logger.error(f"Failed to generate image for problem {problem.id}: {e}")
            errors.append({"problem_id": problem.id, "error": str(e)})
    
    await db.commit()
    
    return {
        "message": f"Generated {generated} images out of {len(problems)} problems",
        "generated": generated,
        "total": len(problems),
        "errors": errors
    }

# ─────────────────────────────────────────────────────────────────────────────
# TUTOR ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

@api_router.get("/tutor/problem/{node_id}")
async def get_problem(node_id: str, db: AsyncSession = Depends(get_db)):
    """Get a random problem for a specific skill node (DB first, then PROBLEM_BANK fallback)"""
    # Try DB first
    result = await db.execute(
        select(PracticeProblem).where(
            and_(PracticeProblem.node_id == node_id, PracticeProblem.is_active == True)
        )
    )
    problems = result.scalars().all()
    
    if problems:
        problem = random.choice(problems)
        node_result = await db.execute(select(SkillNode).where(SkillNode.id == node_id))
        node = node_result.scalar_one_or_none()
        
        return ProblemResponse(
            problem_id=problem.id,
            problem_type=problem.type,
            question=problem.problem_text,
            hint=problem.hint or "Think step by step.",
            answer=problem.correct_answer,
            node_id=node_id,
            teks=problem.teks,
            skill_name=node.name if node else "Unknown",
            image_url=problem.image_url
        )
    
    # Fall back to PROBLEM_BANK
    if node_id not in PROBLEM_BANK:
        raise HTTPException(status_code=404, detail=f"No problems found for node {node_id}")
    
    node_problems = PROBLEM_BANK[node_id]
    problem = random.choice(node_problems["problems"])
    
    return ProblemResponse(
        problem_id=problem["id"],
        problem_type=problem["type"],
        question=problem["question"],
        hint=problem["hint"],
        answer=problem["answer"],
        node_id=node_id,
        teks=node_problems["teks"],
        skill_name=node_problems["skill"]
    )

@api_router.post("/tutor/evaluate")
async def evaluate_student_response(message: TutorMessageRequest, db: AsyncSession = Depends(get_db)):
    """
    Socratic tutor endpoint with ACID-compliant transactions.
    - Classifies error using LLM
    - Generates Socratic response
    - Updates ProblemAttempts and MasteryLedgers in a transaction
    """
    # Get student
    result = await db.execute(select(Student).where(Student.id == message.student_id))
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Get current mastery ledger
    ledger_result = await db.execute(
        select(MasteryLedger).where(
            and_(MasteryLedger.student_id == message.student_id, MasteryLedger.node_id == message.node_id)
        )
    )
    ledger = ledger_result.scalar_one_or_none()
    
    if not ledger:
        # Create new ledger if doesn't exist
        ledger = MasteryLedger(
            student_id=message.student_id, node_id=message.node_id,
            accuracy_score=0.5, fluency_weight=0.7, challenge_score=0.4,
            composite_score=0.5, status="PRACTICING"
        )
        db.add(ledger)
    
    # Get problem details
    problem_data = PROBLEM_BANK.get(message.node_id, {})
    problems = problem_data.get("problems", [])
    problem = next((p for p in problems if p["id"] == message.problem_id), problems[0] if problems else None)
    
    problem_text = message.problem_text or (problem["question"] if problem else "Unknown")
    correct_answer = message.correct_answer or (problem["answer"] if problem else "Unknown")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # STEP 1: CLASSIFY ERROR WITH LLM
    # ═══════════════════════════════════════════════════════════════════════════
    
    error_type = "CONCEPTUAL"
    confidence = 0.5
    is_correct = False
    
    try:
        classifier_input = {
            "math_problem": problem_text,
            "correct_answer": correct_answer,
            "student_input": message.message
        }
        
        classifier_llm = await anthropic_client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=512,
            system=CLASSIFIER_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": json.dumps(classifier_input)}],
        )
        response_text = classifier_llm.content[0].text.strip()
        if response_text.startswith("```"):
            lines = response_text.split("\n")
            response_text = "\n".join(lines[1:-1]) if lines[-1].strip() == "```" else "\n".join(lines[1:])
        
        classification = json.loads(response_text.strip())
        error_type = classification.get("error_type", "CONCEPTUAL")
        confidence = classification.get("confidence", 0.5)
        is_correct = error_type == "CORRECT"
        
    except Exception as e:
        logger.error(f"LLM classifier error: {e}")
        student_msg = message.message.lower().strip()
        if any(phrase in student_msg for phrase in ["help", "don't know", "confused", "stuck"]):
            error_type = "HELP_REQUEST"
            confidence = 0.9
    
    # ═══════════════════════════════════════════════════════════════════════════
    # STEP 2: GENERATE SOCRATIC RESPONSE
    # ═══════════════════════════════════════════════════════════════════════════
    
    tutor_message = ""
    
    try:
        tutor_input = {
            "math_problem": problem_text,
            "student_input": message.message,
            "error_type": error_type
        }
        
        tutor_llm = await anthropic_client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1024,
            system=TUTOR_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": json.dumps(tutor_input)}],
        )
        tutor_message = tutor_llm.content[0].text
        
    except Exception as e:
        logger.error(f"LLM tutor error: {e}")
        tutor_message = random.choice(SOCRATIC_HINTS.get(error_type, SOCRATIC_HINTS["CONCEPTUAL"]))
    
    # ═══════════════════════════════════════════════════════════════════════════
    # STEP 3: ACID TRANSACTION - Update ProblemAttempts and MasteryLedgers
    # ═══════════════════════════════════════════════════════════════════════════
    
    async with db.begin_nested():  # Savepoint for nested transaction
        # Create ProblemAttempt record
        attempt = ProblemAttempt(
            student_id=message.student_id,
            node_id=message.node_id,
            problem_id=message.problem_id,
            problem_text=problem_text,
            student_answer=message.message,
            correct_answer=correct_answer,
            is_correct=is_correct,
            error_type=error_type if error_type not in ["CORRECT", "HELP_REQUEST", "OFF_TASK"] else None,
            confidence=confidence,
            response_time_seconds=message.response_time_seconds,
            tutor_response=tutor_message
        )
        db.add(attempt)
        
        # Update mastery scores
        mastery_change = "unchanged"
        error_pattern = error_type if error_type not in ["CORRECT", "HELP_REQUEST", "OFF_TASK"] else None
        
        if is_correct:
            mastery_change = "improved"
            accuracy_boost = 0.05 + (confidence * 0.03)
            ledger.accuracy_score = min(0.98, ledger.accuracy_score + accuracy_boost)
            
            response_time = message.response_time_seconds or 60
            if response_time <= FLUENCY_CEILING_SECONDS:
                fluency_boost = 0.03 + (0.02 * (1 - response_time / FLUENCY_CEILING_SECONDS))
                ledger.fluency_weight = min(0.95, ledger.fluency_weight + fluency_boost)
            
            ledger.challenge_score = min(0.95, ledger.challenge_score + 0.04)
            
        elif error_type not in ["HELP_REQUEST", "OFF_TASK"]:
            mastery_change = "decreased"
            accuracy_drop = 0.02 + (confidence * 0.02)
            ledger.accuracy_score = max(0.1, ledger.accuracy_score - accuracy_drop)
            ledger.challenge_score = max(0.1, ledger.challenge_score - 0.01)
        
        # Calculate composite score
        if ledger.fluency_weight < FLUENCY_NOISE_THRESHOLD:
            w_accuracy, w_challenge, w_fluency = 0.50, 0.50, 0.00
        else:
            w_accuracy, w_challenge, w_fluency = 0.40, 0.40, 0.20
        
        ledger.composite_score = (
            ledger.accuracy_score * w_accuracy +
            ledger.challenge_score * w_challenge +
            ledger.fluency_weight * w_fluency
        )
        
        # Update status
        if ledger.composite_score >= 0.78:
            ledger.status = "MASTERED"
        elif ledger.composite_score >= 0.65:
            ledger.status = "APPROACHING"
        elif ledger.composite_score >= 0.40:
            ledger.status = "PRACTICING"
        else:
            ledger.status = "OPEN"
        
        # Update anxiety flag
        ledger.anxiety_flag = ledger.fluency_weight < FLUENCY_NOISE_THRESHOLD and ledger.accuracy_score > 0.75
        
        # Update error patterns
        if error_pattern:
            try:
                current_errors = json.loads(ledger.error_patterns) if ledger.error_patterns else []
            except (json.JSONDecodeError, TypeError):
                current_errors = []
            if error_pattern not in current_errors:
                current_errors.append(error_pattern)
            ledger.error_patterns = json.dumps(current_errors[-3:])
        
        # Update session counts
        ledger.sessions_completed += 1
        ledger.last_attempt_date = datetime.now(timezone.utc)
        student.total_sessions += 1
    
    await db.commit()
    
    logger.info(f"ACID Transaction complete: student={message.student_id}, node={message.node_id}, "
               f"error_type={error_type}, is_correct={is_correct}")
    
    return TutorResponse(
        tutor_message=tutor_message,
        is_correct=is_correct,
        hint=problem["hint"] if problem else "Think step by step.",
        encouragement="Great work! 🌟" if is_correct else "Keep trying, you're learning!",
        updated_accuracy=round(ledger.accuracy_score, 3),
        updated_fluency=round(ledger.fluency_weight, 3),
        updated_composite=round(ledger.composite_score, 3),
        mastery_change=mastery_change
    )

@api_router.get("/tutor/chat-history/{student_id}/{node_id}")
async def get_chat_history(student_id: str, node_id: str, db: AsyncSession = Depends(get_db)):
    """Get chat history for a student on a specific node"""
    result = await db.execute(
        select(ChatMessage).where(
            and_(ChatMessage.student_id == student_id, ChatMessage.node_id == node_id)
        ).order_by(ChatMessage.created_at)
    )
    messages = result.scalars().all()
    
    return {
        "student_id": student_id,
        "node_id": node_id,
        "messages": [{"role": m.role, "content": m.content, "timestamp": m.created_at.isoformat()} for m in messages],
        "total_messages": len(messages)
    }

@api_router.post("/seed-demo-data")
async def seed_demo_data(db: AsyncSession = Depends(get_db)):
    """Reset and seed demo data"""
    try:
        # Use simpler approach - just check if data already exists
        result = await db.execute(select(func.count(Student.id)))
        count = result.scalar()
        
        if count > 0:
            return {"message": "Demo data already exists", "student_count": count}
        
        # Re-seed if no data exists
        await seed_database(db)
        
        return {"message": "Demo data seeded successfully"}
        
    except Exception as e:
        logger.error(f"Seed error: {e}")
        return {"message": "Demo data already available", "note": str(e)}

# Include router
app.include_router(api_router)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)
