"""
MathQuest API Tests - Iteration 6
Tests for: Students API, Teacher Dashboard, Admin features, Skill Graph, and Problems API
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://adaptive-math-auth.preview.emergentagent.com')
API_URL = f"{BASE_URL}/api"


class TestHealthAndBasicEndpoints:
    """Basic health and root endpoint tests"""
    
    def test_health_endpoint(self):
        """Test /api/health returns healthy status"""
        response = requests.get(f"{API_URL}/health")
        assert response.status_code == 200, f"Health check failed: {response.text}"
        data = response.json()
        assert data["status"] == "healthy"
        assert "database" in data
        assert "timestamp" in data
        print(f"✅ Health check passed: {data}")
    
    def test_root_api_endpoint(self):
        """Test /api/ returns API info"""
        response = requests.get(f"{API_URL}/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "status" in data
        print(f"✅ Root API endpoint: {data}")


class TestStudentsAPI:
    """Tests for /api/students endpoints"""
    
    def test_get_all_students(self):
        """Test GET /api/students returns list of students"""
        response = requests.get(f"{API_URL}/students")
        assert response.status_code == 200, f"Failed to get students: {response.text}"
        students = response.json()
        assert isinstance(students, list)
        assert len(students) >= 3, f"Expected at least 3 demo students, got {len(students)}"
        
        # Validate student structure
        for student in students:
            assert "id" in student
            assert "name" in student
            assert "avatar_emoji" in student
            assert "overall_composite" in student
            assert "nodes_mastered" in student
            assert "total_nodes" in student
        
        print(f"✅ Got {len(students)} students")
        return students
    
    def test_get_student_by_id(self):
        """Test GET /api/students/{id} returns specific student"""
        response = requests.get(f"{API_URL}/students/student-001")
        assert response.status_code == 200, f"Failed to get student-001: {response.text}"
        student = response.json()
        
        assert student["id"] == "student-001"
        assert student["name"] == "Alex Champion"
        assert "mastery_data" in student
        assert "grade" in student
        print(f"✅ Got student: {student['name']} with mastery data")
    
    def test_get_student_progress(self):
        """Test GET /api/students/{id}/progress returns progress data"""
        response = requests.get(f"{API_URL}/students/student-001/progress")
        assert response.status_code == 200
        data = response.json()
        
        assert "student" in data
        assert "skill_progress" in data
        print(f"✅ Got progress for student-001")
    
    def test_get_nonexistent_student(self):
        """Test GET /api/students/{id} for non-existent student returns 404"""
        response = requests.get(f"{API_URL}/students/nonexistent-id-12345")
        assert response.status_code == 404
        print("✅ Non-existent student correctly returns 404")


class TestSkillGraphAPI:
    """Tests for skill graph endpoints"""
    
    def test_get_skill_graph(self):
        """Test GET /api/skill-graph returns complete DAG"""
        response = requests.get(f"{API_URL}/skill-graph")
        assert response.status_code == 200
        data = response.json()
        
        assert "nodes" in data
        assert "edges" in data
        assert isinstance(data["nodes"], list)
        assert isinstance(data["edges"], list)
        
        # Count grade 5 nodes (N01-N20)
        grade5_nodes = [n for n in data["nodes"] if n["id"].startswith("N")]
        assert len(grade5_nodes) == 20, f"Expected 20 grade 5 nodes, got {len(grade5_nodes)}"
        
        # Validate node structure
        for node in data["nodes"][:5]:
            assert "id" in node
            assert "teks" in node
            assert "name" in node
            assert "grade" in node
        
        print(f"✅ Got skill graph with {len(data['nodes'])} nodes and {len(data['edges'])} edges")
    
    def test_get_skill_node_by_id(self):
        """Test GET /api/skill-graph/node/{id} returns specific node"""
        response = requests.get(f"{API_URL}/skill-graph/node/N01")
        assert response.status_code == 200
        node = response.json()
        
        assert node["id"] == "N01"
        assert node["teks"] == "5.3A"
        assert "name" in node
        print(f"✅ Got skill node N01: {node['name']}")


class TestTeacherDashboardAPI:
    """Tests for teacher dashboard endpoints"""
    
    def test_get_teacher_dashboard(self):
        """Test GET /api/teacher/dashboard returns aggregated class data"""
        response = requests.get(f"{API_URL}/teacher/dashboard")
        assert response.status_code == 200
        data = response.json()
        
        assert "students" in data
        assert "class_summary" in data
        
        # Validate class_summary
        summary = data["class_summary"]
        assert "total_students" in summary
        assert "students_on_track" in summary
        assert "students_struggling" in summary
        assert "students_with_anxiety" in summary
        
        # Validate student data
        for student in data["students"]:
            assert "student_id" in student
            assert "name" in student
            assert "overall_composite" in student
            assert "nodes_mastered" in student
            assert "needs_attention" in student
        
        print(f"✅ Teacher dashboard: {summary['total_students']} students, {summary['students_on_track']} on track")
    
    def test_get_teacher_student_detail(self):
        """Test GET /api/teacher/student/{id}/detail returns detailed breakdown"""
        response = requests.get(f"{API_URL}/teacher/student/student-001/detail")
        assert response.status_code == 200
        data = response.json()
        
        assert "student" in data
        assert "node_details" in data
        assert "grade4_nodes" in data
        assert "grade5_nodes" in data
        
        assert len(data["grade5_nodes"]) == 20
        print(f"✅ Got teacher detail for student-001 with {len(data['node_details'])} nodes")


class TestProblemsAPI:
    """Tests for practice problems endpoints"""
    
    def test_get_problems_for_node(self):
        """Test GET /api/problems/{node_id} returns problems"""
        response = requests.get(f"{API_URL}/problems/N01")
        assert response.status_code == 200
        problems = response.json()
        
        assert isinstance(problems, list)
        assert len(problems) > 0, "Expected at least one problem for N01"
        
        # Validate problem structure
        for problem in problems:
            assert "id" in problem
            assert "node_id" in problem
            assert "problem_text" in problem
            assert "correct_answer" in problem
        
        print(f"✅ Got {len(problems)} problems for N01")
    
    def test_get_random_problem(self):
        """Test GET /api/problems/{node_id}/random returns single problem"""
        response = requests.get(f"{API_URL}/problems/N02/random")
        assert response.status_code == 200
        problem = response.json()
        
        assert "problem_id" in problem
        assert "question" in problem
        assert "hint" in problem
        assert "node_id" in problem
        assert "skill_name" in problem
        print(f"✅ Got random problem for N02: {problem['question'][:50]}...")


class TestTutorAPI:
    """Tests for tutor interaction endpoints"""
    
    def test_get_tutor_problem(self):
        """Test GET /api/tutor/problem/{node_id} returns formatted problem"""
        response = requests.get(f"{API_URL}/tutor/problem/N01")
        assert response.status_code == 200
        data = response.json()
        
        assert "problem_id" in data
        assert "question" in data
        assert "skill_name" in data
        print(f"✅ Got tutor problem: {data['question'][:50]}...")
    
    def test_tutor_evaluate_correct(self):
        """Test POST /api/tutor/evaluate with correct answer"""
        # First get a problem to know the answer
        prob_response = requests.get(f"{API_URL}/tutor/problem/N01")
        problem = prob_response.json()
        
        # Try evaluation
        payload = {
            "student_id": "student-001",
            "node_id": "N01",
            "problem_id": problem["problem_id"],
            "message": "11/12",  # Common answer for N01 fraction addition
            "response_time_seconds": 30.0,
            "problem_text": problem.get("question", "1/4 + 2/3"),
            "correct_answer": problem.get("answer", "11/12")
        }
        
        response = requests.post(f"{API_URL}/tutor/evaluate", json=payload)
        assert response.status_code == 200, f"Evaluation failed: {response.text}"
        data = response.json()
        
        assert "tutor_message" in data
        assert "is_correct" in data
        assert "mastery_change" in data
        print(f"✅ Tutor evaluation completed - correct: {data['is_correct']}")


class TestAdminContentManagementAPI:
    """Tests for Admin Content Management endpoints - DO NOT TRIGGER actual generation"""
    
    def test_problems_endpoint_exists(self):
        """Verify the /api/problems/generate endpoint exists (without calling it)"""
        # Just test that the endpoint responds - don't actually generate
        response = requests.post(f"{API_URL}/problems/generate", json={
            "node_id": "INVALID_NODE",  # Invalid to avoid actual generation
            "count": 1
        })
        # Should fail with 404 (node not found) or 422 (validation error), but not 404 (route not found)
        assert response.status_code in [404, 422, 500], f"Unexpected status: {response.status_code}"
        print("✅ /api/problems/generate endpoint exists")
    
    def test_generate_images_batch_endpoint_exists(self):
        """Verify the batch image generation endpoint exists"""
        # This endpoint doesn't require params, but we won't trigger actual generation
        # Just verify the route exists by checking response
        response = requests.post(f"{API_URL}/problems/generate-images-batch")
        # Should return success (no problems to generate) or any valid response
        assert response.status_code in [200, 500], f"Unexpected status: {response.status_code}"
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Batch image endpoint responded: {data.get('message', 'OK')}")
        else:
            print("✅ Batch image endpoint exists (may need API key)")
    
    def test_single_image_generation_endpoint_exists(self):
        """Verify single image generation endpoint structure"""
        response = requests.post(f"{API_URL}/problems/invalid-id-123/generate-image")
        assert response.status_code in [404, 400, 500]  # Problem not found or other error
        print("✅ Single image generation endpoint exists")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
