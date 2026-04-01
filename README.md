# Facial Attendance — Local Repair Notes

Quick steps to get the project running locally for development.

Backend (backend/)
- Copy `backend/.env.example` (or create `backend/.env`) and set these values:
	- `MONGO_URI` (recommended) OR `MONGO_USER`, `MONGO_PASS`, `MONGO_CLUSTER`, `MONGO_DB` for Atlas
	- `PORT` (default 5000)
	- `JWT_SECRET`
	- `EMAIL_USER`, `EMAIL_PASS` (for sending emails via Gmail app password)
	- `ADMIN_USER`, `ADMIN_PASS` (used by `/api/auth/setup-admin`)
- If no Atlas credentials are provided, the server will automatically fall back to a local MongoDB at `mongodb://127.0.0.1:27017/<db>`.
- Install and run:
	```bash
	cd backend
	npm install
	npm run dev    # uses nodemon
	```

Frontend (frontend/)
- Install and run the React dev server:
	```bash
	cd frontend
	npm install --legacy-peer-deps   # resolves a peer dependency for react-qr-reader
	npm start
	```

Notes and troubleshooting
- If the backend cannot connect to Atlas (DNS SRV errors), either provide `MONGO_URI` or run a local MongoDB instance.
- Ensure `uploads/students` and `qrcodes` folders exist (the server creates them on startup if missing).
- If email sending fails, verify `EMAIL_USER` and `EMAIL_PASS` (Gmail requires an app password and proper account settings).

If you want, I can:
- Run the servers and capture remaining runtime errors.
- Replace the QR library to avoid `--legacy-peer-deps` installs.
- Add a simple local-data fallback (JSON) to run without MongoDB.
