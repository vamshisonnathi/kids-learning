#!/usr/bin/env python3

import requests
import json
import sys
from datetime import datetime
import time

class LLMIntegrationTester:
    def __init__(self, base_url="https://adaptive-math-auth.preview.emergentagent.com"):
        self.base_url = base_url
        self.api = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.student_id = "student-001"  # Using demo student Alex Champion

    def run_test(self, name, method, endpoint, expected_status, data=None, check_response=None):
        """Run a single API test with optional response validation"""
        url = f"{self.api}/{endpoint}" if not endpoint.startswith('http') else endpoint
        headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=30)

            success = response.status_code == expected_status
            response_data = {}
            
            if success:
                try:
                    response_data = response.json()
                    if check_response and not check_response(response_data):
                        success = False
                        print(f"❌ Failed - Response validation failed")
                    else:
                        self.tests_passed += 1
                        print(f"✅ Passed - Status: {response.status_code}")
                except json.JSONDecodeError:
                    if expected_status == 200:
                        success = False
                        print(f"❌ Failed - Invalid JSON response")
                    else:
                        print(f"✅ Passed - Status: {response.status_code} (no JSON expected)")
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                if response.text:
                    print(f"   Response: {response.text[:200]}...")

            return success, response_data

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_basic_api_health(self):
        """Test basic API connectivity and PostgreSQL status"""
        print("\n" + "="*60)
        print("TESTING BASIC API CONNECTIVITY & POSTGRESQL")
        print("="*60)
        
        self.run_test("API Root", "GET", "", 200)
        
        # Test health check specifically for PostgreSQL
        success, response = self.run_test(
            "Health Check - PostgreSQL", 
            "GET", 
            "health", 
            200,
            check_response=lambda r: r.get("database") == "PostgreSQL" and r.get("status") == "healthy"
        )
        
        if success:
            print(f"   ✅ Database confirmed as: {response.get('database')}")
            print(f"   ✅ Status: {response.get('status')}")
        else:
            print(f"   ❌ Expected database: PostgreSQL, got: {response.get('database', 'unknown')}")
        
        return success
        
    def test_demo_data_setup(self):
        """Ensure demo data is available"""
        print("\n" + "="*60)
        print("TESTING DEMO DATA SETUP")
        print("="*60)
        
        # Seed demo data first
        self.run_test("Seed Demo Data", "POST", "seed-demo-data", 200)
        
        # Verify students exist with correct data structure
        success, response = self.run_test(
            "Get Students - 3 Demo Students", 
            "GET", 
            "students", 
            200,
            check_response=lambda r: len(r) == 3 and all("name" in student and "overall_composite" in student for student in r)
        )
        
        if success:
            print(f"   Found {len(response)} demo students")
            for student in response:
                print(f"   - {student['name']}: {student['overall_composite']:.2f} composite score")
        
        return success

    def test_skill_graph_structure(self):
        """Test skill graph returns 43 nodes and edges correctly"""
        print("\n" + "="*60)
        print("TESTING SKILL GRAPH - 43 NODES AND EDGES")
        print("="*60)
        
        success, response = self.run_test(
            "Get Complete Skill Graph",
            "GET",
            "skill-graph",
            200,
            check_response=lambda r: "nodes" in r and "edges" in r and len(r["nodes"]) == 43
        )
        
        if success:
            nodes = response.get("nodes", [])
            edges = response.get("edges", [])
            
            print(f"   Total nodes: {len(nodes)}")
            print(f"   Total edges: {len(edges)}")
            
            # Check node structure
            grade4_nodes = [n for n in nodes if n.get("grade") == 4]
            grade5_nodes = [n for n in nodes if n.get("grade") == 5]
            
            print(f"   Grade 4 nodes (prerequisites): {len(grade4_nodes)}")
            print(f"   Grade 5 nodes (N01-N20): {len(grade5_nodes)}")
            
            # Verify N-series nodes exist
            n_nodes = [n for n in nodes if n.get("id", "").startswith("N")]
            print(f"   N-series nodes (N01-N20): {len(n_nodes)}")
            
            # Check that edges connect nodes properly
            node_ids = {n["id"] for n in nodes}
            valid_edges = 0
            for edge in edges:
                if edge.get("from") in node_ids and edge.get("to") in node_ids:
                    valid_edges += 1
            
            print(f"   Valid edges: {valid_edges}/{len(edges)}")
            
            if len(nodes) == 43 and valid_edges == len(edges):
                print(f"   ✅ Skill graph structure correct")
                return True
            else:
                print(f"   ❌ Skill graph structure issues detected")
                
        return False

    def test_problem_retrieval(self):
        """Test problem bank access"""
        print("\n" + "="*60)
        print("TESTING PROBLEM RETRIEVAL")
        print("="*60)
        
        # Test N01 problem retrieval
        success, problem = self.run_test(
            "Get N01 Problem",
            "GET",
            "tutor/problem/N01",
            200,
            check_response=lambda r: all(k in r for k in ["problem_id", "question", "answer", "hint"])
        )
        
        if success:
            print(f"   Problem: {problem['question'][:50]}...")
            print(f"   Answer: {problem['answer']}")
            
        return problem if success else None

    def test_llm_classifier_correct_answer(self):
        """Test LLM classifier with CORRECT answer"""
        print("\n" + "="*60)
        print("TESTING LLM CLASSIFIER - CORRECT ANSWERS")
        print("="*60)
        
        test_cases = [
            {
                "name": "Correct Fraction Addition",
                "student_answer": "11/12",
                "node_id": "N01", 
                "problem_id": "N01-P1",
                "problem_text": "What is 1/4 + 2/3?",
                "correct_answer": "11/12"
            },
            {
                "name": "Correct Alternative Format",
                "student_answer": "1 1/10", 
                "node_id": "N01",
                "problem_id": "N01-P2", 
                "problem_text": "Calculate: 3/5 + 1/2",
                "correct_answer": "11/10 or 1 1/10"
            }
        ]
        
        correct_classifications = 0
        
        for case in test_cases:
            success, response = self.run_test(
                f"LLM Classifier - {case['name']}",
                "POST", 
                "tutor/evaluate",
                200,
                data={
                    "student_id": self.student_id,
                    "node_id": case["node_id"],
                    "problem_id": case["problem_id"],
                    "message": case["student_answer"],
                    "response_time_seconds": 15.0,
                    "problem_text": case["problem_text"],
                    "correct_answer": case["correct_answer"]
                },
                check_response=lambda r: "tutor_message" in r and "is_correct" in r
            )
            
            if success:
                is_correct = response.get("is_correct", False)
                tutor_msg = response.get("tutor_message", "")
                error_pattern = response.get("error_pattern_detected")
                
                print(f"   Classified as: {'CORRECT' if is_correct else 'INCORRECT'}")
                print(f"   Error pattern: {error_pattern}")
                print(f"   Tutor message: {tutor_msg[:80]}...")
                
                if is_correct:
                    correct_classifications += 1
                    print(f"   ✅ Correctly identified as CORRECT")
                else:
                    print(f"   ❌ Should have been classified as CORRECT")
        
        success_rate = correct_classifications / len(test_cases) if test_cases else 0
        print(f"\n📊 CORRECT Classification Success Rate: {correct_classifications}/{len(test_cases)} ({success_rate*100:.1f}%)")
        
        return success_rate > 0.5

    def test_llm_classifier_error_patterns(self):
        """Test LLM classifier with different error patterns"""
        print("\n" + "="*60)
        print("TESTING LLM CLASSIFIER - ERROR PATTERNS")
        print("="*60)
        
        test_cases = [
            {
                "name": "Conceptual Error - Wrong Operation",
                "student_answer": "5/12",  # Student subtracted instead of added
                "node_id": "N01",
                "problem_id": "N01-P1", 
                "problem_text": "What is 1/4 + 2/3?",
                "correct_answer": "11/12",
                "expected_pattern": "CONCEPTUAL"
            },
            {
                "name": "Procedural Error - Arithmetic Mistake",
                "student_answer": "10/12", # Right approach, calculation error
                "node_id": "N01",
                "problem_id": "N01-P1",
                "problem_text": "What is 1/4 + 2/3?", 
                "correct_answer": "11/12",
                "expected_pattern": "PROCEDURAL"
            },
            {
                "name": "Help Request",
                "student_answer": "I don't know how to do this",
                "node_id": "N01",
                "problem_id": "N01-P1",
                "problem_text": "What is 1/4 + 2/3?",
                "correct_answer": "11/12", 
                "expected_pattern": "HELP_REQUEST"
            },
            {
                "name": "Vocabulary Error",
                "student_answer": "3/12", # Confused 'sum' with 'product'
                "node_id": "N01", 
                "problem_id": "N01-P1",
                "problem_text": "What is 1/4 + 2/3?",
                "correct_answer": "11/12",
                "expected_pattern": "VOCABULARY"
            }
        ]
        
        pattern_matches = 0
        
        for case in test_cases:
            # Wait 2 seconds between LLM calls to avoid rate limiting
            time.sleep(2)
            
            success, response = self.run_test(
                f"Error Pattern - {case['name']}", 
                "POST",
                "tutor/evaluate",
                200,
                data={
                    "student_id": self.student_id,
                    "node_id": case["node_id"],
                    "problem_id": case["problem_id"], 
                    "message": case["student_answer"],
                    "response_time_seconds": 25.0,
                    "problem_text": case["problem_text"],
                    "correct_answer": case["correct_answer"]
                },
                check_response=lambda r: "tutor_message" in r
            )
            
            if success:
                is_correct = response.get("is_correct", False)
                error_pattern = response.get("error_pattern_detected")
                tutor_msg = response.get("tutor_message", "")
                
                print(f"   Detected pattern: {error_pattern}")
                print(f"   Expected pattern: {case['expected_pattern']}")
                print(f"   Is correct: {is_correct}")
                print(f"   Tutor response: {tutor_msg[:80]}...")
                
                # Check if pattern matches expectation (or reasonable alternative)
                reasonable_patterns = {
                    "CONCEPTUAL": ["CONCEPTUAL", "PREREQ_GAP"],
                    "PROCEDURAL": ["PROCEDURAL", "CARELESS"],
                    "HELP_REQUEST": ["HELP_REQUEST"], 
                    "VOCABULARY": ["VOCABULARY", "CONCEPTUAL"]
                }
                
                expected_patterns = reasonable_patterns.get(case['expected_pattern'], [case['expected_pattern']])
                if error_pattern in expected_patterns or (case['expected_pattern'] == "HELP_REQUEST" and not is_correct):
                    pattern_matches += 1
                    print(f"   ✅ Pattern classification acceptable")
                else:
                    print(f"   ⚠️  Pattern classification unexpected but may be valid")
        
        success_rate = pattern_matches / len(test_cases) if test_cases else 0
        print(f"\n📊 Error Pattern Detection Success Rate: {pattern_matches}/{len(test_cases)} ({success_rate*100:.1f}%)")
        
        return success_rate > 0.5

    def test_socratic_tutor_responses(self):
        """Test that Socratic tutor provides guiding questions, not direct answers"""
        print("\n" + "="*60)
        print("TESTING SOCRATIC TUTOR RESPONSES")
        print("="*60)
        
        test_cases = [
            {
                "name": "Incorrect Answer - Should Ask Guiding Question",
                "student_answer": "5/6",  # Wrong answer
                "node_id": "N01",
                "problem_id": "N01-P1",
                "problem_text": "What is 1/4 + 2/3?",
                "correct_answer": "11/12"
            },
            {
                "name": "Help Request - Should Guide Discovery", 
                "student_answer": "Can you help me with this?",
                "node_id": "N01",
                "problem_id": "N01-P2",
                "problem_text": "Calculate: 3/5 + 1/2", 
                "correct_answer": "11/10 or 1 1/10"
            }
        ]
        
        socratic_responses = 0
        
        for case in test_cases:
            # Wait 2 seconds between LLM calls
            time.sleep(2)
            
            success, response = self.run_test(
                f"Socratic Response - {case['name']}",
                "POST",
                "tutor/evaluate", 
                200,
                data={
                    "student_id": self.student_id,
                    "node_id": case["node_id"],
                    "problem_id": case["problem_id"],
                    "message": case["student_answer"],
                    "response_time_seconds": 30.0,
                    "problem_text": case["problem_text"],
                    "correct_answer": case["correct_answer"]
                }
            )
            
            if success:
                tutor_msg = response.get("tutor_message", "").lower()
                correct_answer = case["correct_answer"].lower()
                
                print(f"   Tutor response: {response.get('tutor_message', '')}")
                
                # Check that response is Socratic (asks questions, doesn't give answer)
                has_question = "?" in tutor_msg
                reveals_answer = any(ans in tutor_msg for ans in correct_answer.split(" or "))
                is_encouraging = any(word in tutor_msg for word in ["think", "what", "how", "can you", "let's"])
                
                if has_question and not reveals_answer and is_encouraging:
                    socratic_responses += 1
                    print(f"   ✅ Good Socratic response - asks questions without revealing answer")
                elif has_question and not reveals_answer:
                    socratic_responses += 0.5  # Partial credit
                    print(f"   ⚠️  Acceptable response - has question but could be more guiding") 
                else:
                    print(f"   ❌ Not ideal - may reveal answer or not ask guiding questions")
                    if reveals_answer:
                        print(f"      Problem: Reveals answer directly")
                    if not has_question:
                        print(f"      Problem: Doesn't ask guiding questions")
        
        success_rate = socratic_responses / len(test_cases) if test_cases else 0
        print(f"\n📊 Socratic Response Quality: {socratic_responses}/{len(test_cases)} ({success_rate*100:.1f}%)")
        
        return success_rate > 0.5

    def test_conversation_history_storage(self):
        """Test that conversation history is stored in MongoDB"""
        print("\n" + "="*60)
        print("TESTING CONVERSATION HISTORY STORAGE")
        print("="*60)
        
        # Send a few messages to create history
        problem_id = "N01-P1"
        
        messages = [
            "What is 1/4 + 2/3?",
            "I need help with this problem", 
            "11/12"
        ]
        
        for i, message in enumerate(messages):
            time.sleep(1)  # Small delay between messages
            
            success, _ = self.run_test(
                f"Send Message {i+1}",
                "POST", 
                "tutor/evaluate",
                200,
                data={
                    "student_id": self.student_id,
                    "node_id": "N01",
                    "problem_id": problem_id,
                    "message": message,
                    "response_time_seconds": 20.0,
                    "problem_text": "What is 1/4 + 2/3?",
                    "correct_answer": "11/12"
                }
            )
        
        # Now test the chat history endpoint
        success, history = self.run_test(
            "Get Chat History",
            "GET",
            f"tutor/chat-history/{self.student_id}/N01",
            200,
            check_response=lambda r: "messages" in r and len(r["messages"]) >= 0
        )
        
        if success:
            messages_count = len(history.get("messages", []))
            print(f"   Found {messages_count} messages in history")
            
            if messages_count >= 4:  # At least 2 student messages + 2 tutor responses
                print(f"   ✅ Conversation history successfully stored")
                return True
            else:
                print(f"   ⚠️  Limited message history (expected at least 4)")
                return False
        
        return False

    def test_mastery_score_updates(self):
        """Test that mastery scores update based on correct/incorrect answers"""
        print("\n" + "="*60)
        print("TESTING MASTERY SCORE UPDATES")
        print("="*60)
        
        # Get initial mastery for student
        success, student = self.run_test(
            "Get Initial Student Data",
            "GET",
            f"students/{self.student_id}",
            200
        )
        
        if not success:
            return False
            
        initial_mastery = student.get("mastery_data", {}).get("N01", {})
        initial_accuracy = initial_mastery.get("accuracy_score", 0.5)
        print(f"   Initial accuracy for N01: {initial_accuracy}")
        
        # Send a correct answer
        time.sleep(2)
        success, response = self.run_test(
            "Send Correct Answer",
            "POST",
            "tutor/evaluate", 
            200,
            data={
                "student_id": self.student_id,
                "node_id": "N01",
                "problem_id": "mastery-test-1",
                "message": "11/12",
                "response_time_seconds": 15.0,
                "problem_text": "What is 1/4 + 2/3?",
                "correct_answer": "11/12"
            }
        )
        
        if success:
            updated_accuracy = response.get("updated_accuracy")
            mastery_change = response.get("mastery_change", "unchanged")
            
            print(f"   Updated accuracy: {updated_accuracy}")
            print(f"   Mastery change: {mastery_change}")
            
            if updated_accuracy and updated_accuracy > initial_accuracy:
                print(f"   ✅ Mastery score increased correctly")
                return True
            else:
                print(f"   ⚠️  Mastery score should have increased")
        
        return False

    def test_teacher_dashboard_updates(self):
        """Test that teacher dashboard shows updated error patterns"""
        print("\n" + "="*60)
        print("TESTING TEACHER DASHBOARD UPDATES")
        print("="*60)
        
        # Get dashboard data
        success, dashboard = self.run_test(
            "Get Teacher Dashboard",
            "GET",
            "teacher/dashboard",
            200,
            check_response=lambda r: "students" in r and len(r["students"]) > 0
        )
        
        if success:
            students = dashboard.get("students", [])
            test_student = next((s for s in students if s["student_id"] == self.student_id), None)
            
            if test_student:
                error_patterns = test_student.get("error_patterns", [])
                anxiety_flags = test_student.get("anxiety_flags", 0)
                sessions_total = test_student.get("sessions_total", 0)
                
                print(f"   Student: {test_student['name']}")
                print(f"   Error patterns: {error_patterns}")
                print(f"   Anxiety flags: {anxiety_flags}")
                print(f"   Total sessions: {sessions_total}")
                
                if sessions_total > 0:
                    print(f"   ✅ Dashboard shows student activity")
                    return True
                else:
                    print(f"   ⚠️  Dashboard should show session activity")
            else:
                print(f"   ❌ Test student not found in dashboard")
        
        return False

    def run_full_test_suite(self):
        """Run all LLM integration tests"""
        print("🧠 LLM INTEGRATION TESTING - Claude 3.5 Haiku")
        print("=" * 80)
        
        results = {}
        
        # Basic connectivity
        self.test_basic_api_health()
        
        # Setup
        results["demo_data"] = self.test_demo_data_setup()
        results["skill_graph"] = self.test_skill_graph_structure()
        
        # Core LLM functionality
        problem = self.test_problem_retrieval()
        if problem:
            results["correct_classification"] = self.test_llm_classifier_correct_answer()
            results["error_patterns"] = self.test_llm_classifier_error_patterns()
            results["socratic_responses"] = self.test_socratic_tutor_responses()
            results["conversation_history"] = self.test_conversation_history_storage()
            results["mastery_updates"] = self.test_mastery_score_updates()
            results["dashboard_updates"] = self.test_teacher_dashboard_updates()
        
        # Print final results
        print("\n" + "="*80)
        print("LLM INTEGRATION TEST RESULTS")
        print("="*80)
        
        print(f"📊 Overall Tests: {self.tests_passed}/{self.tests_run} ({self.tests_passed/self.tests_run*100:.1f}% pass rate)")
        
        print("\n🧠 LLM Feature Results:")
        for feature, passed in results.items():
            status = "✅ PASS" if passed else "❌ FAIL"
            print(f"   {feature.replace('_', ' ').title()}: {status}")
        
        llm_features_passed = sum(1 for result in results.values() if result)
        llm_success_rate = llm_features_passed / len(results) if results else 0
        
        print(f"\n🎯 LLM Integration Success: {llm_features_passed}/{len(results)} features ({llm_success_rate*100:.1f}%)")
        
        if llm_success_rate >= 0.7:
            print("🌟 LLM INTEGRATION SUCCESSFUL - Claude 3.5 Haiku working correctly")
            return 0
        else:
            print("⚠️  LLM INTEGRATION NEEDS ATTENTION - Some features not working")
            return 1

def main():
    tester = LLMIntegrationTester()
    return tester.run_full_test_suite()

if __name__ == "__main__":
    sys.exit(main())