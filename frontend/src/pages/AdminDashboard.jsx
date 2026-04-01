import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from 'react-router-dom';
import WebcamBox from "../components/WebcamBox";
import * as faceapi from "face-api.js";
import api from "../api";

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const webcamRef = useRef(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");   // ✅ added email state
  const [workingStart, setWorkingStart] = useState("");
  const [workingEnd, setWorkingEnd] = useState("");
  const [department, setDepartment] = useState("");
  const [year, setYear] = useState("");
  const [section, setSection] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [registerNumber, setRegisterNumber] = useState("");
  const [role, setRole] = useState("student");
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [students, setStudents] = useState([]);

  useEffect(() => {
    const load = async () => {
      const MODEL_URL = process.env.PUBLIC_URL + "/models";
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
      setModelsLoaded(true);
    };
    load();
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      const res = await api.get("/students");
      setStudents(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const captureAndRegister = async () => {
  if (!modelsLoaded) return alert("Models not loaded yet");
  if (!name || !email) return alert("Enter student name and email");

  const imageSrc = webcamRef.current.getScreenshot();

  // Convert screenshot to file
  const res = await fetch(imageSrc);
  const blob = await res.blob();
  const file = new File([blob], `${name}.jpg`, { type: "image/jpeg" });

  // Detect face embedding
  const img = await faceapi.fetchImage(imageSrc);
  // use stricter detector options to avoid poor captures
  const detectorOptions = new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 });
  const detection = await faceapi
    .detectSingleFace(img, detectorOptions)
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!detection) return alert("No face detected");

  const embedding = Array.from(detection.descriptor);

  try {
    // ✅ Use FormData
    const formData = new FormData();
    formData.append("name", name);
    formData.append("email", email);
  formData.append("workingStart", workingStart);
  formData.append("workingEnd", workingEnd);
  formData.append("department", department);
  formData.append("year", year);
  formData.append("section", section);
  formData.append("rollNumber", rollNumber);
  formData.append("registerNumber", registerNumber);
  formData.append("role", role);
    formData.append("embedding", JSON.stringify(embedding));
    formData.append("photo", file);

    await api.post("/students/register", formData, {
      headers: {
        // NOTE: Do not set Content-Type when sending FormData; the browser
        // will set the correct multipart boundary. Manually setting it can
        // cause the server to reject the body or the header to be malformed.
      },
    });

    alert("Student registered successfully");
    setName("");
    setEmail("");
    setWorkingStart("");
    setWorkingEnd("");
    fetchStudents();
  } catch (err) {
    console.error(err);
    alert("Register error: " + (err.response?.data?.error || err.message));
  }
};


  const downloadCSV = () => {
    api
      .get("/attendance/csvpath")
      .then(() => {
        window.open(`${API_BASE_URL}/attendance.csv`, "_blank");
      })
      .catch(() => {
        alert("Could not get CSV path. Make sure server is running.");
      });
  };

  const logout = () => {
    localStorage.removeItem("token");
    navigate('/attendance');
  };
  return (
    <div className="min-h-screen py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Admin Dashboard</h1>
            <p className="text-sm text-gray-500">Manage students and export attendance</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={downloadCSV} className="px-3 py-2 rounded-md bg-white border">Export CSV</button>
            <button onClick={logout} className="px-3 py-2 rounded-md bg-red-600 text-white">Logout</button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left: Registration Card */}
          <div className="md:col-span-1 bg-white p-4 rounded-xl shadow">
            <h2 className="text-lg font-medium text-gray-900">Register Student</h2>
            <div className="mt-3">
              <div className="w-full h-64 bg-black rounded-md overflow-hidden flex items-center justify-center">
                <WebcamBox ref={webcamRef} />
              </div>

              <div className="mt-3 space-y-3">
                <input className="w-full border rounded-md px-3 py-2" placeholder="Student name" value={name} onChange={(e) => setName(e.target.value)} />
                <input className="w-full border rounded-md px-3 py-2" placeholder="Student email" value={email} onChange={(e) => setEmail(e.target.value)} />
                <input className="w-full border rounded-md px-3 py-2" placeholder="Department (e.g., CSE)" value={department} onChange={(e) => setDepartment(e.target.value)} />

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-sm text-gray-600">Year</label>
                    <input className="w-full border rounded-md px-2 py-2" placeholder="e.g., 3" value={year} onChange={(e) => setYear(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Section</label>
                    <input className="w-full border rounded-md px-2 py-2" placeholder="e.g., A" value={section} onChange={(e) => setSection(e.target.value)} />
                  </div>
                </div>

                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-sm text-gray-600">Working start</label>
                    <input className="w-full border rounded-md px-2 py-2" type="time" value={workingStart} onChange={(e) => setWorkingStart(e.target.value)} />
                  </div>
                  <div className="flex-1">
                    <label className="text-sm text-gray-600">Working end</label>
                    <input className="w-full border rounded-md px-2 py-2" type="time" value={workingEnd} onChange={(e) => setWorkingEnd(e.target.value)} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <input className="w-full border rounded-md px-3 py-2" placeholder="Roll Number" value={rollNumber} onChange={(e) => setRollNumber(e.target.value)} />
                  <input className="w-full border rounded-md px-3 py-2" placeholder="Register Number" value={registerNumber} onChange={(e) => setRegisterNumber(e.target.value)} />
                </div>

                <div>
                  <label className="text-sm text-gray-600">Role</label>
                  <select className="w-full border rounded-md px-2 py-2" value={role} onChange={(e) => setRole(e.target.value)}>
                    <option value="student">Student</option>
                    <option value="teacher">Teacher</option>
                  </select>
                </div>

                <div className="flex gap-2 mt-2">
                  <button onClick={captureAndRegister} className="flex-1 px-3 py-2 rounded-md bg-blue-600 text-white">Register Face</button>
                </div>
              </div>
            </div>
          </div>

          <div className="md:col-span-2 bg-white p-4 rounded-xl shadow">
            <h2 className="text-lg font-medium text-gray-900">Registered Students</h2>
            <div className="mt-3 overflow-auto" style={{ maxHeight: '56vh' }}>
              <ul className="divide-y divide-slate-100">
                {students.map((s) => (
                  <li key={s._id} className="py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {s.photo ? (
                        <img src={`${API_BASE_URL}${s.photo}`} alt={s.name} className="w-14 h-14 rounded-lg object-cover" />
                      ) : (
                        <div className="w-14 h-14 rounded-lg bg-slate-100 flex items-center justify-center text-sm text-gray-400">No Photo</div>
                      )}

                      <div>
                        <div className="font-semibold text-gray-900">{s.name}</div>
                        <div className="text-sm text-gray-500">{s.email} {s.department ? (<span className="text-xs text-slate-400">• {s.department}</span>) : null} {s.year ? (<span className="text-xs text-slate-400">• Year {s.year}</span>) : null} {s.section ? (<span className="text-xs text-slate-400">• Sec {s.section}</span>) : null}</div>
                        <div className="text-sm text-gray-500">{s.rollNumber ? (<span className="text-xs text-slate-400">Roll: {s.rollNumber}</span>) : null} {s.registerNumber ? (<span className="text-xs text-slate-400"> • Reg: {s.registerNumber}</span>) : null}</div>
                        <div className="text-sm text-gray-400">{new Date(s.createdAt).toLocaleString()}</div>
                        {s.workingTime && (s.workingTime.start || s.workingTime.end) ? (
                          <div className="text-sm text-gray-500">Working: {s.workingTime.start || '--'} to {s.workingTime.end || '--'}</div>
                        ) : null}
                        <div className="text-sm text-gray-500">{s.role}</div>
                      </div>
                    </div>
                    <div className="text-sm text-gray-500">{/* reserved for actions in future */}</div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
