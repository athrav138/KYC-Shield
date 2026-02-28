import { useState, useEffect } from 'react';
import { 
  Users, ShieldCheck, ShieldAlert, ShieldX, 
  Search, Filter, Download, ExternalLink,
  TrendingUp, BarChart3, PieChart as PieChartIcon,
  Loader2, Video, Sparkles, X, ChevronRight
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { generateKYCReport } from '../../lib/reportGenerator';
import { db } from '../../lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { GoogleGenAI } from "@google/genai";
import ReactMarkdown from 'react-markdown';

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  
  // Summary states
  const [summary, setSummary] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // 1. Fetch from Local API
      const [statsRes, usersRes] = await Promise.all([
        fetch('/api/admin/stats', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } }),
        fetch('/api/admin/users', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } })
      ]);
      
      const statsData = await statsRes.json();
      const usersData = await usersRes.json();
      
      // 2. Fetch from Firestore (if configured)
      let firestoreUsers: any[] = [];
      if (db) {
        try {
          const q = query(collection(db, "kyc_users"), orderBy("createdAt", "desc"));
          const querySnapshot = await getDocs(q);
          firestoreUsers = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            full_name: doc.data().name,
            status: doc.data().status?.toLowerCase() || 'verified',
            risk_score: doc.data().riskLevel === 'High' ? 80 : doc.data().riskLevel === 'Medium' ? 50 : 20,
            kyc_date: doc.data().createdAt || new Date().toISOString(),
            isFirestore: true
          }));
        } catch (fbErr) {
          console.warn("Firestore fetch failed:", fbErr);
        }
      }

      // Merge users
      const allUsers = [...firestoreUsers, ...usersData].sort((a, b) => 
        new Date(b.kyc_date || b.createdAt).getTime() - new Date(a.kyc_date || a.createdAt).getTime()
      );

      // Recalculate stats to include Firestore
      const updatedStats = {
        ...statsData,
        stats: statsData?.stats ? {
          ...statsData.stats,
          total: (statsData.stats.total || 0) + firestoreUsers.length,
          verified: (statsData.stats.verified || 0) + firestoreUsers.filter(u => u.status === 'accepted' || u.status === 'verified').length,
          fake: (statsData.stats.fake || 0) + firestoreUsers.filter(u => u.status === 'rejected' || u.status === 'fake').length,
        } : {
          total: firestoreUsers.length,
          verified: firestoreUsers.filter(u => u.status === 'accepted' || u.status === 'verified').length,
          fake: firestoreUsers.filter(u => u.status === 'rejected' || u.status === 'fake').length,
          suspicious: 0,
          totalVideos: 0,
          videoDeepfakes: 0
        }
      };
      
      setStats(updatedStats);
      setUsers(allUsers);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const generateSummary = async () => {
    setSummarizing(true);
    setShowSummary(true);
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("Gemini API key is not configured.");
      
      const genAI = new GoogleGenAI({ apiKey });
      const model = "gemini-3-flash-preview";
      
      const recentData = users.slice(0, 20).map(u => ({
        name: u.full_name,
        status: u.status,
        risk: u.risk_score,
        date: u.kyc_date
      }));

      const prompt = `As a security analyst for a KYC platform, summarize the following recent activity data. 
      Identify key trends, potential fraud patterns, and areas that require immediate attention.
      Keep it professional, concise, and use markdown for formatting.
      
      Stats:
      - Total Users: ${stats.stats.total}
      - Verified: ${stats.stats.verified}
      - Fraud Detected: ${stats.stats.fake}
      - Video Scans: ${stats.stats.totalVideos}
      - Video Deepfakes: ${stats.stats.videoDeepfakes}
      
      Recent Activity (Last 20):
      ${JSON.stringify(recentData, null, 2)}`;

      const response = await genAI.models.generateContent({
        model,
        contents: prompt
      });

      setSummary(response.text || "Failed to generate summary.");
    } catch (err: any) {
      console.error("Summary error:", err);
      setSummary("Error generating summary: " + err.message);
    } finally {
      setSummarizing(false);
    }
  };

  const filteredUsers = users.filter(u => {
    const status = u.status?.toLowerCase();
    const matchesFilter = filter === 'all' || 
      (filter === 'verified' && (status === 'verified' || status === 'accepted')) ||
      (filter === 'fake' && (status === 'fake' || status === 'rejected')) ||
      status === filter;
    
    const matchesSearch = u.full_name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const chartData = [
    { name: 'Verified', value: stats?.stats.verified || 0, color: '#10b981' },
    { name: 'Suspicious', value: stats?.stats.suspicious || 0, color: '#f59e0b' },
    { name: 'Fraud Detected', value: stats?.stats.fake || 0, color: '#ef4444' },
  ];

  const trendData = [
    { name: 'Mon', attempts: 45, fraud: 2 },
    { name: 'Tue', attempts: 52, fraud: 5 },
    { name: 'Wed', attempts: 48, fraud: 3 },
    { name: 'Thu', attempts: 61, fraud: 8 },
    { name: 'Fri', attempts: 55, fraud: 4 },
    { name: 'Sat', attempts: 67, fraud: 12 },
    { name: 'Sun', attempts: 58, fraud: 7 },
  ];

  const fraudRate = stats?.stats.total > 0 
    ? ((stats.stats.fake / stats.stats.total) * 100).toFixed(1) 
    : "0.0";

  const exportToCSV = () => {
    const headers = ['Name', 'Email', 'Status', 'Risk Score', 'Confidence Score', 'Date'];
    const rows = users.map(u => [
      u.full_name,
      u.email,
      u.status,
      u.risk_score,
      u.confidence_score,
      new Date(u.kyc_date).toLocaleDateString()
    ]);
    
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `KYC_Export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex justify-between items-end mb-12">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">Admin Command Center</h1>
          <p className="opacity-50">Real-time identity fraud monitoring and analytics.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={generateSummary}
            className="bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 text-emerald-500 hover:bg-emerald-500 hover:text-black transition-all"
          >
            <Sparkles className="w-4 h-4" /> AI Summary
          </button>
          <button 
            onClick={exportToCSV}
            className="bg-app-card border border-app-border px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-app-card/80 transition-all"
          >
            <Download className="w-4 h-4" /> Export Data
          </button>
        </div>
      </div>

      {/* AI Summary Modal/Overlay */}
      <AnimatePresence>
        {showSummary && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSummary(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-app-card border border-app-border rounded-[32px] overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-app-border flex items-center justify-between bg-emerald-500/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">AI Activity Summary</h2>
                    <p className="text-xs opacity-40 font-bold uppercase tracking-widest">Powered by Gemini AI</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowSummary(false)}
                  className="p-2 hover:bg-app-bg rounded-xl transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-8 max-h-[60vh] overflow-y-auto">
                {summarizing ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-4">
                    <Loader2 className="w-12 h-12 animate-spin text-emerald-500" />
                    <p className="font-bold animate-pulse">Analyzing recent activity patterns...</p>
                  </div>
                ) : (
                  <div className="markdown-body text-sm leading-relaxed opacity-90">
                    <ReactMarkdown>{summary || ""}</ReactMarkdown>
                  </div>
                )}
              </div>

              <div className="p-6 bg-app-bg/50 border-t border-app-border flex justify-end">
                <button 
                  onClick={() => setShowSummary(false)}
                  className="px-8 py-3 bg-emerald-500 text-black font-bold rounded-2xl hover:bg-emerald-400 transition-all"
                >
                  Close Summary
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 mb-12">
        {[
          { label: 'Total Users', value: stats?.stats.total, icon: Users, color: 'text-blue-400', bg: 'bg-blue-400/10' },
          { label: 'Verified', value: stats?.stats.verified, icon: ShieldCheck, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
          { label: 'Fraud Detected', value: stats?.stats.fake, icon: ShieldX, color: 'text-red-500', bg: 'bg-red-500/10' },
          { label: 'Fraud Rate', value: `${fraudRate}%`, icon: TrendingUp, color: 'text-purple-400', bg: 'bg-purple-400/10' },
          { label: 'Video Scans', value: stats?.stats.totalVideos, icon: Video, color: 'text-indigo-400', bg: 'bg-indigo-400/10' },
          { label: 'Video Deepfakes', value: stats?.stats.videoDeepfakes, icon: ShieldAlert, color: 'text-pink-500', bg: 'bg-pink-500/10' },
        ].map((s, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-app-card border border-app-border rounded-3xl p-6"
          >
            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-4", s.bg)}>
              <s.icon className={cn("w-6 h-6", s.color)} />
            </div>
            <p className="text-sm font-bold opacity-40 uppercase tracking-widest mb-1">{s.label}</p>
            <p className="text-3xl font-bold">{s.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
        <div className="lg:col-span-2 bg-app-card border border-app-border rounded-3xl p-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <BarChart3 className="w-5 h-5 text-emerald-500" />
              <h3 className="font-bold">Verification Activity & Fraud Trends</h3>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--app-border)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--app-text)" opacity={0.4} fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--app-text)" opacity={0.4} fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--app-bg)', border: '1px solid var(--app-border)', borderRadius: '12px', color: 'var(--app-text)' }}
                />
                <Bar dataKey="attempts" fill="#10b981" radius={[4, 4, 0, 0]} name="Total Attempts" />
                <Bar dataKey="fraud" fill="#ef4444" radius={[4, 4, 0, 0]} name="Fraud Detected" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-app-card border border-app-border rounded-3xl p-8">
          <div className="flex items-center gap-3 mb-8">
            <PieChartIcon className="w-5 h-5 text-blue-400" />
            <h3 className="font-bold">Status Distribution</h3>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--app-bg)', border: '1px solid var(--app-border)', borderRadius: '12px', color: 'var(--app-text)' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-3 mt-4">
            {chartData.map((c, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }} />
                  <span className="opacity-60">{c.name}</span>
                </div>
                <span className="font-mono font-bold">{c.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* User Table */}
      <div className="bg-app-card border border-app-border rounded-3xl overflow-hidden">
        <div className="p-6 border-b border-app-border flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-20" />
            <input 
              type="text" 
              placeholder="Search users by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-app-bg border border-app-border rounded-xl py-2 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-app-bg border border-app-border rounded-xl p-1">
              {['all', 'verified', 'suspicious', 'fake'].map(f => (
                <button 
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-xs font-bold capitalize transition-all",
                    filter === f ? "bg-app-text text-app-bg" : "opacity-40 hover:opacity-100"
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-xs font-bold uppercase tracking-widest opacity-30 border-b border-app-border">
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Risk Score</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border/50">
              {filteredUsers.map((u, i) => (
                <tr key={i} className="group hover:bg-app-text/[0.02] transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 font-bold">
                        {u.full_name[0]}
                      </div>
                      <div>
                        <p className="font-bold">{u.full_name}</p>
                        <p className="text-xs opacity-40">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                      u.status === 'verified' ? "bg-emerald-500/10 text-emerald-500" :
                      u.status === 'suspicious' ? "bg-orange-500/10 text-orange-500" :
                      u.status === 'fake' ? "bg-red-500/10 text-red-500" : "bg-app-bg text-app-text/40"
                    )}>
                      {u.status || 'Pending'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-app-bg rounded-full overflow-hidden">
                        <div 
                          className={cn("h-full", u.risk_score < 30 ? "bg-emerald-500" : u.risk_score < 70 ? "bg-orange-500" : "bg-red-500")} 
                          style={{ width: `${u.risk_score || 0}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono opacity-40">{u.risk_score || 0}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs opacity-40 font-mono">
                    {u.kyc_date ? new Date(u.kyc_date).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {u.status === 'verified' || u.status === 'accepted' && (
                        <button 
                          onClick={() => {
                            if (u.isFirestore) {
                              generateKYCReport({
                                userName: u.name,
                                date: new Date(u.kyc_date).toLocaleDateString(),
                                status: u.status,
                                confidenceScore: u.confidenceScore,
                                riskScore: u.risk_score,
                                explanation: u.status === 'accepted' ? 'Verification Successful' : 'Verification Rejected',
                                aadhaarDetails: { aadhaarNumber: u.aadhaarNumber },
                                faceDetails: u.faceResult,
                                voiceDetails: u.voiceResult
                              });
                            } else {
                              generateKYCReport({
                                userName: u.full_name,
                                date: new Date(u.kyc_date).toLocaleDateString(),
                                status: u.status,
                                confidenceScore: u.confidence_score,
                                riskScore: u.risk_score,
                                explanation: u.final_decision,
                                aadhaarDetails: JSON.parse(u.aadhaar_analysis || '{}'),
                                faceDetails: JSON.parse(u.face_analysis || '{}'),
                                voiceDetails: JSON.parse(u.voice_analysis || '{}')
                              });
                            }
                          }}
                          className="p-2 rounded-lg bg-app-bg hover:bg-app-bg/80 opacity-60 hover:opacity-100 transition-all"
                          title="Download Report"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      )}
                      <button className="p-2 rounded-lg bg-app-bg hover:bg-app-bg/80 opacity-60 hover:opacity-100 transition-all">
                        <ExternalLink className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
