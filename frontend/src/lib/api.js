import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const api = {
  getStudents: () => axios.get(`${API}/students`),
  getStudent: (id) => axios.get(`${API}/students/${id}`),
  getStudentProgress: (id) => axios.get(`${API}/students/${id}/progress`),
  getSkillGraph: () => axios.get(`${API}/skill-graph`),
  getTeacherDashboard: () => axios.get(`${API}/teacher/dashboard`),
  getTeacherStudentDetail: (id) => axios.get(`${API}/teacher/student/${id}/detail`),
  seedDemoData: () => axios.post(`${API}/seed-demo-data`),
};

export { API, BACKEND_URL };
