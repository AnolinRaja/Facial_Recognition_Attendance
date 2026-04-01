import React, { useState } from "react";
import api from "../api";
import { Navigate, useNavigate } from "react-router-dom";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const nav = useNavigate();

  const handleLogin = async () => {
    try {
      const res = await api.post("/auth/login", { username, password });
      localStorage.setItem("token", res.data.token);
      nav("/admin");
    } catch (err) {
      alert("Login failed");
    }
  };

  const setupAdmin = async () => {
    try {
      await api.post("/auth/setup-admin");
      alert("Admin setup attempted. If not created earlier, check .env values.");
    } catch (err) {
      alert("Setup admin error");
    }
  };

  return (
    <div style={{ textAlign: "center", marginTop: 40 }}>
      <h2>Admin Login</h2>
      <input placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} />
      <br /><br />
      <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
      <br /><br />
      <button onClick={handleLogin}>Login</button>
      <br /><br />
      <small>First time setup? Click below to run setup (creates admin from .env)</small>
      <br />
      <button onClick={setupAdmin}>Run Setup Admin</button>
    </div>
  );
}

