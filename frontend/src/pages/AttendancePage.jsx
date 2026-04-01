import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from 'react-router-dom';
import WebcamBox from "../components/WebcamBox";
import * as faceapi from "face-api.js";
import axios from "axios";
import { Html5Qrcode } from 'html5-qrcode';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export default function AttendancePage() {
  const navigate = useNavigate();
  const webcamRef = useRef(null);
  const overlayRef = useRef(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [status, setStatus] = useState("");
  const [lastMarked, setLastMarked] = useState({}); // Prevent duplicate marking per student/day
  const faceMatcherRef = useRef(null);
  const [mode, setMode] = useState('multiple'); // 'single' or 'multiple'
  const [scanMode, setScanMode] = useState('face'); // 'face' or 'qr'
  // tuning for robustness
  const matchCountsRef = useRef({}); // consecutive match counters per label
  const MATCH_THRESHOLD = 0.48; // lower distance is stricter (0.48 is stricter than 0.6)
  const REQUIRED_CONSECUTIVE = 3; // require N consecutive frames to confirm
  const MIN_BOX_SIZE = 60; // ignore detections smaller than this (px)
  const [recent, setRecent] = useState([]); // recent attendance shown in UI
  const lastScannedQrRef = useRef(null);
  const qrScannerRef = useRef(null);
  const qrRegionId = 'qr-region';

  // Load models once
  useEffect(() => {
    const load = async () => {
      const MODEL_URL = process.env.PUBLIC_URL + "/models";
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
      // fetch labeled embeddings from server for client-side matching
      try {
        setStatus('Loading known students...');
        const res = await axios.get(`${API_BASE_URL}/api/students/public`);
        const students = res.data || [];

        // Build labeled descriptors. If the server already provides embeddings,
        // use them. Otherwise, if a photo URL exists, fetch the photo and
        // compute a descriptor client-side so the matcher can work without
        // forcing re-registration.
        const detectorOptions = new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 });

        const labeled = [];

        // Process students sequentially to avoid overwhelming the browser
        for (const s of students) {
          try {
            let descriptors = [];

            if (s.embeddings && Array.isArray(s.embeddings) && s.embeddings.length) {
              descriptors = s.embeddings.map(e => new Float32Array(e));
            } else if (s.embedding && Array.isArray(s.embedding) && s.embedding.length) {
              descriptors = [new Float32Array(s.embedding)];
            } else if (s.photo) {
              // attempt to fetch photo and compute descriptor
              try {
                const imgUrl = `${API_BASE_URL}${s.photo}`;
                const img = await faceapi.fetchImage(imgUrl);
                const det = await faceapi.detectSingleFace(img, detectorOptions).withFaceLandmarks().withFaceDescriptor();
                if (det && det.descriptor) descriptors = [new Float32Array(det.descriptor)];
              } catch (innerErr) {
                console.warn(`Could not compute descriptor for ${s.name}:`, innerErr.message || innerErr);
              }
            }

            if (descriptors && descriptors.length) {
              labeled.push(new faceapi.LabeledFaceDescriptors(s.name, descriptors));
            }
          } catch (studentErr) {
            console.warn('Error processing student', s && s.name, studentErr.message || studentErr);
          }
        }

        if (labeled.length === 0) {
          console.warn('No labeled descriptors available (server embeddings missing and photo-based computation failed).');
          setStatus('No labeled faces available for recognition');
        } else {
          faceMatcherRef.current = new faceapi.FaceMatcher(labeled, 0.6);
          setStatus('Models and labeled faces loaded');
        }
      } catch (err) {
        console.warn('Could not load labeled descriptors', err.message || err);
        setStatus('Failed to load known students');
      }
      setModelsLoaded(true);
    };
    load();
  }, []);

  // Automatic detection loop
  useEffect(() => {
    if (!modelsLoaded || scanMode !== 'face') return;

    // tuned tiny face detector options for better accuracy
    const detectorOptions = new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 });

    const interval = setInterval(async () => {
      if (!webcamRef.current) return;
      const videoEl = webcamRef.current.video;
      if (!videoEl || videoEl.readyState !== 4) return; // ensure video has data

      // buffer for names marked this tick
      const marked = [];

      // detect directly on the video element for live multi-face detection
      const detections = await faceapi
        .detectAllFaces(videoEl, detectorOptions)
        .withFaceLandmarks()
        .withFaceDescriptors();

      // draw detections on overlay canvas
      const canvas = overlayRef.current;
      if (canvas) {
        const displaySize = { width: videoEl.videoWidth, height: videoEl.videoHeight };
        canvas.width = displaySize.width;
        canvas.height = displaySize.height;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (!detections || detections.length === 0) {
          setStatus("No faces detected");
          return;
        }

        let resized = faceapi.resizeResults(detections, displaySize);
        // filter out very small detections to avoid false positives
        resized = resized.filter(r => r.detection.box.width >= MIN_BOX_SIZE && r.detection.box.height >= MIN_BOX_SIZE);

        if (resized.length === 0) {
          setStatus("No sufficiently large faces detected");
          return;
        }

        // If single mode, pick the detection closest to the center (more stable)
        if (mode === 'single' && resized.length > 1) {
          const cx = displaySize.width / 2;
          const cy = displaySize.height / 2;
          resized = [resized.reduce((best, cur) => {
            const curCenterX = cur.detection.box.x + cur.detection.box.width / 2;
            const curCenterY = cur.detection.box.y + cur.detection.box.height / 2;
            const bestCenterX = best.detection.box.x + best.detection.box.width / 2;
            const bestCenterY = best.detection.box.y + best.detection.box.height / 2;
            const curDist = Math.hypot(curCenterX - cx, curCenterY - cy);
            const bestDist = Math.hypot(bestCenterX - cx, bestCenterY - cy);
            return curDist < bestDist ? cur : best;
          })];
        }

        // draw boxes for selected detections
        // faceapi.draw.drawDetections(canvas, resized);

        const frameMatches = [];
        const seenLabels = new Set();
        let unknownFaces = 0;

        for (const d of resized) {
          if (!faceMatcherRef.current) continue;
          const best = faceMatcherRef.current.findBestMatch(d.descriptor);

          if (best && best.label && best.label !== 'unknown') {
            const distance = best.distance != null ? best.distance : 1.0;
            if (distance < MATCH_THRESHOLD) {
              frameMatches.push({ label: best.label, distance });
              seenLabels.add(best.label);
            }
          } else {
            unknownFaces++;
          }
        }

        // update consecutive counters and determine which to mark
        const toMark = [];
        for (const m of frameMatches) {
          matchCountsRef.current[m.label] = (matchCountsRef.current[m.label] || 0) + 1;
          if (matchCountsRef.current[m.label] >= REQUIRED_CONSECUTIVE) {
            toMark.push(m.label);
            matchCountsRef.current[m.label] = 0;
          }
        }

        // decay counters for labels not seen
        Object.keys(matchCountsRef.current).forEach((lbl) => {
          if (!seenLabels.has(lbl)) matchCountsRef.current[lbl] = 0;
        });

        // marking: ensure no duplicates per day and send marks
        for (const label of toMark) {
          const key = label + new Date().toISOString().split('T')[0];
          if (!lastMarked[key]) {
            try {
              const res = await axios.post(`${API_BASE_URL}/api/attendance/mark`, { name: label });
              if (res.data.matched) {
                marked.push(res.data.name);
                setLastMarked((prev) => ({ ...prev, [key]: true }));
              }
            } catch (err) {
              console.error(err);
              setStatus('Error marking attendance');
            }
          }
        }

        if (marked.length > 0) {
          const now = new Date();
          const time = now.toLocaleTimeString();
          setStatus(`Attendance marked for: ${marked.join(", ")}`);
          setRecent((r) => [
            ...marked.map((m) => ({ name: m, time })),
            ...r,
          ].slice(0, 8));
        } else if (unknownFaces > 0) {
          setStatus("your face is not registered contact admin to register");
        } else {
          setStatus("No new recognized faces");
        }
      }
    }, 1000); // run every 1 second

    return () => clearInterval(interval);
  }, [modelsLoaded, lastMarked, mode, scanMode]);

  // New QR handler receives plain text from the scanner
  const handleQrResult = async (text) => {
    if (!text) return;
    try {
      const registerNumber = text;
      if (registerNumber && registerNumber !== lastScannedQrRef.current) {
        lastScannedQrRef.current = registerNumber;
        setTimeout(() => {
          lastScannedQrRef.current = null;
        }, 5000);
        const res = await axios.post(`${API_BASE_URL}/api/attendance/mark`, { registerNumber });
        if (res.data.matched) {
          const key = res.data.name + new Date().toISOString().split('T')[0];
          setLastMarked((prev) => ({ ...prev, [key]: true }));
          const now = new Date();
          const time = now.toLocaleTimeString();
          setStatus(`Attendance marked for: ${res.data.name}`);
          setRecent((r) => [ { name: res.data.name, time }, ...r ].slice(0,8));
        } else {
          setStatus('Invalid QR Code');
        }
      }
    } catch (err) {
      console.error(err);
      setStatus('Error marking attendance');
    }
  }

  // start/stop html5-qrcode scanner when scanMode changes
  useEffect(() => {
    if (scanMode !== 'qr') {
      // stop scanner if running
      if (qrScannerRef.current) {
        qrScannerRef.current.stop().catch(() => {});
        qrScannerRef.current = null;
      }
      return;
    }

    let mounted = true;
    const regionId = qrRegionId;

    const startScanner = async () => {
      try {
        const html5Qr = new Html5Qrcode(regionId, { verbose: false });
        qrScannerRef.current = html5Qr;
        await html5Qr.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: 250 },
          (decodedText) => { if (mounted) handleQrResult(decodedText); },
          (errorMessage) => { /* ignore scan errors */ }
        );
      } catch (err) {
        console.warn('QR scanner start failed', err);
        setStatus('Camera/QR init failed');
      }
    };

    startScanner();

    return () => {
      mounted = false;
      if (qrScannerRef.current) {
        qrScannerRef.current.stop().catch(() => {});
        qrScannerRef.current.clear().catch(() => {});
        qrScannerRef.current = null;
      }
    };
  }, [scanMode]);

  return (
    <div className="min-h-screen py-6">
      <header className="text-center mb-5">
        <div className="flex flex-col sm:flex-row items-center justify-between max-w-5xl mx-auto px-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Panimalar Engineering College</h1>
            <p className="text-sm text-gray-500">Automated Attendance</p>
          </div>
          <div>
            <button onClick={() => navigate('/login')} className="px-3 py-2 rounded-md bg-blue-600 text-white text-sm">Admin Login</button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4">
        <div className="flex flex-col md:flex-row gap-5">
          <div className="flex-1">
            <div className="bg-white rounded-xl shadow-md p-5">
              <h2 className="text-lg font-medium text-gray-900">Live Camera</h2>
              <div className="flex flex-col lg:flex-row gap-4 items-start mt-3">
                <div className="w-full sm:w-[420px] h-64 sm:h-[320px] bg-black rounded-md overflow-hidden flex items-center justify-center">
                  <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                  {scanMode === 'face' ? (
                    <>
                      <WebcamBox ref={webcamRef} />
                      <canvas ref={overlayRef} style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none', width: '100%', height: '100%' }} />
                    </>
                  ) : (
                    <div id={qrRegionId} style={{ width: '100%', height: '100%' }} />
                  )}
                  </div>
                </div>

                <div className="flex-1 w-full">
                  <div className="p-2 rounded-md bg-slate-50 min-h-[60px]">
                    <div className="text-xs text-gray-500">Status</div>
                    <div className="mt-1 text-gray-900 font-semibold">{status || 'Waiting for face...'}</div>
                  </div>

                  <div className="mt-3 flex gap-2 items-center">
                    <div className="flex items-center space-x-2">
                      <button onClick={() => setScanMode('face')} className={`px-3 py-2 rounded-md text-sm ${scanMode === 'face' ? 'bg-blue-600 text-white' : 'bg-white border'}`}>Face Recognition</button>
                      <button onClick={() => setScanMode('qr')} className={`px-3 py-2 rounded-md text-sm ${scanMode === 'qr' ? 'bg-blue-600 text-white' : 'bg-white border'}`}>QR Code Scanner</button>
                    </div>
                  </div>

                  {scanMode === 'face' && (
                    <div className="mt-3 flex gap-2 items-center">
                      <div className="flex items-center space-x-2">
                        <button onClick={() => setMode('single')} className={`px-3 py-2 rounded-md text-sm ${mode === 'single' ? 'bg-blue-600 text-white' : 'bg-white border'}`}>Single Face</button>
                        <button onClick={() => setMode('multiple')} className={`px-3 py-2 rounded-md text-sm ${mode === 'multiple' ? 'bg-blue-600 text-white' : 'bg-white border'}`}>Multiple Faces</button>
                      </div>
                      <button onClick={() => setLastMarked({})} className="px-3 py-2 rounded-md border bg-white text-sm">Reset Marks</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <aside className="w-full md:w-80">
            <div className="bg-white rounded-xl shadow-md p-4">
              <h3 className="text-md font-medium text-gray-900">Recent Attendance</h3>
              <ul className="mt-3 divide-y divide-slate-100">
                {recent.length === 0 ? (
                  <li className="text-sm text-gray-500 py-2">No recent entries</li>
                ) : (
                  recent.map((r, idx) => (
                    <li key={idx} className="py-2 flex justify-between items-center">
                      <div className="text-sm font-semibold text-gray-900">{r.name}</div>
                      <div className="text-sm text-gray-500">{r.time}</div>
                    </li>
                  ))
                )}
              </ul>

              <div className="mt-3 text-sm text-gray-500">
                Tip: Ensure the face is centered and well-lit. Re-register students with multiple images if misidentification persists.
              </div>
            </div>
          </aside>
        </div>

        
      </div>
    </div>
  );
}
