# CareLink Backend API

The Express.js backend system for the CareLink Healthcare platform. 

Designed modularly with Sequelize ORM and configured out-of-the-box with SQLite, allowing easy transitioning to other SQL databases (e.g. PostgreSQL/MySQL) in the future.

## Prerequisites

- [Node.js](https://nodejs.org/) (v16 or higher recommended)
- npm (Node Package Manager)

## Getting Started

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Setup Environment Variables:**
   A local `.env` file has been pre-configured. To customize settings, review `.env`:
   - `PORT`: Server port (default `5000`)
   - `JWT_SECRET`: Key for token generation
   - `DB_STORAGE`: File path for the SQLite database

3. **Start the Development Server:**
   ```bash
   npm run dev
   ```
   This runs the application with `nodemon` for auto-reloading upon file changes.

---

## API Endpoints

### 🩺 Health & System
- **`GET /api/health`** — Basic service health check.

### 🔐 Authentication & Profiles (Group 1)
- **`POST /api/auth/register`** — Register a new patient, doctor, nurse or admin.
- **`POST /api/auth/login`** — Log in existing users.
- **`GET /api/auth/profile`** — Fetch detailed profile (requires Bearer token).

### 🤖 Symptom Entry & AI Triage (Group 2 & 3)
- **`POST /api/triage/assess`** — Assess severity and triage priority based on symptom description. (Requires Patient role token).
- **`POST /api/triage/diagnose`** — Diagnose symptoms from a symptom list and forward the list to the Python ML service. (Requires Patient role token).
- **`GET /api/triage/history`** — Retrieve patient triage assessment records. (Requires Patient role token).
- **`GET /api/triage/recommend-doctors`** — Suggest matching doctors based on symptom keywords. (Requires auth token).

### 📅 Appointments & Consultation (Group 5 & 6)
- **`POST /api/appointments`** — Book a doctor slot. (Requires Patient token).
- **`GET /api/appointments`** — Retrieve list of appointments (role-sensitive: shows appointments matching Doctor, Patient or Admin).
- **`POST /api/appointments/prescription`** — Submit medicine list and dosage details. (Requires Doctor token).
- **`GET /api/appointments/prescriptions`** — Fetch issued/dispensed prescriptions.

### 🏥 Hospital Admission & Nursing (Group 7 & 8)
- **`GET /api/admin/admissions`** — List active admissions. (Requires Nurse/Admin token).
- **`POST /api/admin/admissions`** — Log new hospital admission entries. (Requires Nurse token).
- **`GET /api/admin/stats`** — Overview statistics of the healthcare network. (Requires Admin token).

---

## Connecting the AI/ML Model

The AI Triage service in `src/services/triageMl.service.js` can call the Python microservice at `http://127.0.0.1:5001` by default.

Set `ML_SERVICE_URL` if your Python server is running somewhere else.

Example request for the new diagnosis endpoint:

```json
POST /api/triage/diagnose
{
   "symptoms": ["fever", "cough"]
}
```

Recommended local startup order:

1. Start the Python service in `ml-service` with `uvicorn app:app --reload --port 5001`.
2. Start the Node backend with `npm run dev`.
3. Call `POST /api/triage/diagnose` with a Bearer token for a patient account.
