import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import AdminDashboard from "./pages/AdminDashboard";
import AttendancePage from "./pages/AttendancePage";

function App() {
  const Protected = ({ children }) => {
    const token = localStorage.getItem("token");
    return token ? children : <Navigate to="/login" />;
  };

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/attendance" />} />
        <Route path="/login" element={<Login />} />
        <Route path="/admin" element={<Protected><AdminDashboard /></Protected>} />
        <Route path="/attendance" element={<AttendancePage />} />
      </Routes>
    </Router>
  );
}

export default App;
