"""
Backend API tests for STAAR Diagnostic Flow
Tests the /api/tutor/problem/{node_id} endpoint for diagnostic nodes N01, N04, N05, N15, N17
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://adaptive-math-auth.preview.emergentagent.com')

# Diagnostic nodes used in the 5-question diagnostic
DIAGNOSTIC_NODES = ['N01', 'N04', 'N05', 'N15', 'N17']


class TestHealthEndpoint:
    """Health check tests"""
    
    def test_health_endpoint(self):
        """Test that health endpoint returns healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get('status') == 'healthy'
        print(f"✅ Health check passed: {data}")


class TestDiagnosticProblemAPI:
    """Tests for /api/tutor/problem/{node_id} endpoint used in diagnostic"""
    
    @pytest.mark.parametrize("node_id", DIAGNOSTIC_NODES)
    def test_get_problem_for_diagnostic_node(self, node_id):
        """Test that each diagnostic node returns a valid problem"""
        response = requests.get(f"{BASE_URL}/api/tutor/problem/{node_id}")
        
        # Status code assertion
        assert response.status_code == 200, f"Failed to get problem for {node_id}"
        
        # Data assertions
        data = response.json()
        
        # Required fields for diagnostic
        assert 'problem_id' in data, f"Missing problem_id for {node_id}"
        assert 'question' in data, f"Missing question for {node_id}"
        assert 'answer' in data, f"Missing answer for {node_id}"
        assert 'node_id' in data, f"Missing node_id for {node_id}"
        
        # Verify node_id matches
        assert data['node_id'] == node_id, f"node_id mismatch: expected {node_id}, got {data['node_id']}"
        
        # Verify question and answer are non-empty strings
        assert isinstance(data['question'], str) and len(data['question']) > 0, f"Empty question for {node_id}"
        assert isinstance(data['answer'], str) and len(data['answer']) > 0, f"Empty answer for {node_id}"
        
        print(f"✅ Problem for {node_id}: {data['question'][:50]}... Answer: {data['answer'][:30]}...")
    
    def test_problem_has_skill_metadata(self):
        """Test that problems include skill metadata (teks, skill_name)"""
        response = requests.get(f"{BASE_URL}/api/tutor/problem/N01")
        assert response.status_code == 200
        
        data = response.json()
        
        # Check for skill metadata
        assert 'teks' in data, "Missing TEKS standard"
        assert 'skill_name' in data, "Missing skill_name"
        
        print(f"✅ Skill metadata: TEKS={data['teks']}, skill_name={data['skill_name']}")
    
    def test_problem_has_problem_type(self):
        """Test that problems include problem_type field"""
        response = requests.get(f"{BASE_URL}/api/tutor/problem/N04")
        assert response.status_code == 200
        
        data = response.json()
        assert 'problem_type' in data, "Missing problem_type"
        print(f"✅ Problem type: {data['problem_type']}")


class TestStudentsAPI:
    """Tests for students endpoint used in login flow"""
    
    def test_get_students_list(self):
        """Test that students list is returned for student picker"""
        response = requests.get(f"{BASE_URL}/api/students")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list), "Students should be a list"
        assert len(data) > 0, "Should have at least one student"
        
        # Check first student has required fields
        student = data[0]
        assert 'id' in student, "Student missing id"
        assert 'name' in student, "Student missing name"
        
        print(f"✅ Found {len(data)} students")


class TestSkillGraphAPI:
    """Tests for skill graph endpoint used in map"""
    
    def test_get_skill_graph(self):
        """Test that skill graph returns nodes and edges"""
        response = requests.get(f"{BASE_URL}/api/skill-graph")
        assert response.status_code == 200
        
        data = response.json()
        assert 'nodes' in data, "Missing nodes in skill graph"
        assert 'edges' in data, "Missing edges in skill graph"
        
        # Verify diagnostic nodes exist in graph
        node_ids = [n['node_id'] for n in data['nodes']]
        for diag_node in DIAGNOSTIC_NODES:
            assert diag_node in node_ids, f"Diagnostic node {diag_node} not in skill graph"
        
        print(f"✅ Skill graph has {len(data['nodes'])} nodes and {len(data['edges'])} edges")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
