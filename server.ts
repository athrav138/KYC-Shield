import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("kyc.db");
const JWT_SECRET = process.env.JWT_SECRET || "kyc-buster-secret-2026";

// Initialize DB
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    password TEXT,
    full_name TEXT,
    role TEXT DEFAULT 'user',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS kyc_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    status TEXT DEFAULT 'pending', -- pending, verified, suspicious, fake
    aadhaar_data TEXT,
    aadhaar_analysis TEXT,
    face_analysis TEXT,
    voice_analysis TEXT,
    final_decision TEXT,
    risk_score INTEGER,
    confidence_score INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS video_analyses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    video_name TEXT,
    is_deepfake BOOLEAN,
    risk_level TEXT,
    confidence_score INTEGER,
    analysis_data TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

// Seed Admin if not exists
const adminExists = db.prepare("SELECT * FROM users WHERE role = 'admin'").get();
if (!adminExists) {
  const hashedPassword = bcrypt.hashSync("admin123", 10);
  db.prepare("INSERT INTO users (email, password, full_name, role) VALUES (?, ?, ?, ?)").run(
    "admin@kycbuster.com",
    hashedPassword,
    "System Admin",
    "admin"
  );
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '50mb' }));

  // Auth Middleware
  const authenticate = (req: any, res: any, next: any) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      next();
    } catch (err) {
      res.status(401).json({ error: "Invalid token" });
    }
  };

  // API Routes
  app.post("/api/auth/signup", (req, res) => {
    const { email, password, fullName } = req.body;
    try {
      const hashedPassword = bcrypt.hashSync(password, 10);
      const result = db.prepare("INSERT INTO users (email, password, full_name) VALUES (?, ?, ?)").run(email, hashedPassword, fullName);
      res.json({ id: result.lastInsertRowid });
    } catch (err: any) {
      res.status(400).json({ error: "Email already exists" });
    }
  });

  app.post("/api/auth/login", (req, res) => {
    const { email, password } = req.body;
    const user: any = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    if (!bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role, fullName: user.full_name }, JWT_SECRET);
    res.json({ token, user: { id: user.id, email: user.email, role: user.role, fullName: user.full_name } });
  });

  // KYC Routes
  app.get("/api/kyc/history", authenticate, (req: any, res) => {
    try {
      const records = db.prepare(`
        SELECT * FROM kyc_records 
        WHERE user_id = ? 
        ORDER BY created_at DESC
      `).all(req.user.id);
      res.json(records);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch history" });
    }
  });

  app.post("/api/kyc/finalize", authenticate, async (req: any, res) => {
    const { aadhaar, face, voice, final, userId } = req.body;
    try {
      db.prepare(`
        INSERT INTO kyc_records (user_id, status, aadhaar_data, aadhaar_analysis, face_analysis, voice_analysis, final_decision, risk_score, confidence_score)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        userId,
        final.decision,
        JSON.stringify(aadhaar),
        JSON.stringify(aadhaar),
        JSON.stringify(face),
        JSON.stringify(voice),
        final.explanation,
        final.riskScore,
        final.confidenceScore
      );

      res.json(final);
    } catch (err) {
      console.error("Finalization DB Error:", err);
      res.status(500).json({ error: "Finalization failed" });
    }
  });

  app.post("/api/video/analyze", authenticate, (req: any, res) => {
    const { videoName, isDeepfake, riskLevel, confidenceScore, analysisData } = req.body;
    try {
      db.prepare(`
        INSERT INTO video_analyses (user_id, video_name, is_deepfake, risk_level, confidence_score, analysis_data)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(req.user.id, videoName, isDeepfake ? 1 : 0, riskLevel, confidenceScore, JSON.stringify(analysisData));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to save analysis" });
    }
  });

  app.get("/api/video/history", authenticate, (req: any, res) => {
    try {
      const records = db.prepare(`
        SELECT * FROM video_analyses 
        WHERE user_id = ? 
        ORDER BY created_at DESC
      `).all(req.user.id);
      res.json(records);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch video history" });
    }
  });

  // Admin Routes
  app.get("/api/admin/stats", authenticate, (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    
    const totalUsers = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'user'").get() as any;
    const verified = db.prepare("SELECT COUNT(*) as count FROM kyc_records WHERE status = 'verified'").get() as any;
    const suspicious = db.prepare("SELECT COUNT(*) as count FROM kyc_records WHERE status = 'suspicious'").get() as any;
    const fake = db.prepare("SELECT COUNT(*) as count FROM kyc_records WHERE status = 'fake'").get() as any;
    const totalVideos = db.prepare("SELECT COUNT(*) as count FROM video_analyses").get() as any;
    const videoDeepfakes = db.prepare("SELECT COUNT(*) as count FROM video_analyses WHERE is_deepfake = 1").get() as any;
    
    const recentActivity = db.prepare(`
      SELECT u.full_name, k.status, k.risk_score, k.created_at 
      FROM kyc_records k 
      JOIN users u ON k.user_id = u.id 
      ORDER BY k.created_at DESC LIMIT 10
    `).all();

    res.json({
      stats: { 
        total: totalUsers.count, 
        verified: verified.count, 
        suspicious: suspicious.count, 
        fake: fake.count,
        totalVideos: totalVideos.count,
        videoDeepfakes: videoDeepfakes.count
      },
      recentActivity
    });
  });

  app.get("/api/admin/users", authenticate, (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    const users = db.prepare(`
      SELECT u.id, u.email, u.full_name, k.status, k.risk_score, k.created_at as kyc_date
      FROM users u
      LEFT JOIN kyc_records k ON u.id = k.user_id
      WHERE u.role = 'user'
    `).all();
    res.json(users);
  });

  // Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(3000, "0.0.0.0", () => {
    console.log("Server running on http://localhost:3000");
  });
}

startServer();
