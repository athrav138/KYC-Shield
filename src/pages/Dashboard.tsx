import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Shield, CheckCircle2, AlertCircle, Clock, ArrowRight, Fingerprint, Camera, Mic, Video, ShieldX, ShieldCheck, Calendar } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

export default function Dashboard({ user }: { user: any }) {
  const navigate = useNavigate();
  const [videoHistory, setVideoHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVideoHistory = async () => {
      try {
        const res = await fetch('/api/video/history', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (res.ok) {
          const data = await res.json();
          setVideoHistory(data.slice(0, 3)); // Show only top 3 recent
        }
      } catch (err) {
        console.error("Failed to fetch video history:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchVideoHistory();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-12">
        <h1 className="text-4xl font-bold tracking-tight mb-2">Welcome, {user.fullName}</h1>
        <p className="opacity-50">Manage your identity verification and security settings.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Verification Status Card */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-app-card border border-app-border rounded-3xl p-8 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
              <Shield className="w-32 h-32" />
            </div>
            
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-emerald-500/20 rounded-lg">
                  <Fingerprint className="w-6 h-6 text-emerald-500" />
                </div>
                <h2 className="text-xl font-bold">Identity Verification</h2>
              </div>

              <div className="flex items-center gap-4 mb-8">
                <div className="flex-1 h-2 bg-app-card rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 w-1/4" />
                </div>
                <span className="text-xs font-mono opacity-40 uppercase tracking-widest">Step 1 of 4</span>
              </div>

                <div className="space-y-4 mb-8">
                <div className="flex items-center gap-3 opacity-70">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  <span>Account Created</span>
                </div>
                <div className="flex items-center gap-3 opacity-30">
                  <Clock className="w-5 h-5" />
                  <span>Aadhaar Verification</span>
                </div>
                <div className="flex items-center gap-3 opacity-30">
                  <Clock className="w-5 h-5" />
                  <span>Face Liveness Check</span>
                </div>
                <div className="flex items-center gap-3 opacity-30">
                  <Clock className="w-5 h-5" />
                  <span>Voice Authentication</span>
                </div>
              </div>

              <button 
                onClick={() => navigate('/kyc')}
                className="bg-app-text text-app-bg font-bold px-8 py-4 rounded-2xl flex items-center gap-2 hover:bg-emerald-500 hover:text-black transition-all group"
              >
                Start KYC Verification
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-app-card border border-app-border rounded-3xl p-6">
              <Camera className="w-8 h-8 text-blue-400 mb-4" />
              <h3 className="font-bold mb-2">Biometric Security</h3>
              <p className="text-sm opacity-50">Our AI-powered face detection ensures only you can access your account.</p>
            </div>
            <div className="bg-app-card border border-app-border rounded-3xl p-6">
              <Mic className="w-8 h-8 text-purple-400 mb-4" />
              <h3 className="font-bold mb-2">Voice Recognition</h3>
              <p className="text-sm opacity-50">Advanced voice analysis detects deepfake audio and synthetic speech.</p>
            </div>
            <div 
              onClick={() => navigate('/video-lab')}
              className="bg-indigo-500/10 border border-indigo-500/20 rounded-3xl p-6 cursor-pointer hover:bg-indigo-500/20 transition-all group md:col-span-2"
            >
              <div className="flex items-center justify-between">
                <div>
                  <Video className="w-8 h-8 text-indigo-400 mb-4 group-hover:scale-110 transition-transform" />
                  <h3 className="font-bold mb-2">Video Deepfake Lab</h3>
                  <p className="text-sm opacity-50">Upload videos for advanced AI analysis to detect synthetic manipulations.</p>
                </div>
                <ArrowRight className="w-6 h-6 opacity-20 group-hover:opacity-100 group-hover:translate-x-2 transition-all" />
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-3xl p-6">
            <div className="flex items-center gap-2 mb-4 text-emerald-500">
              <AlertCircle className="w-5 h-5" />
              <span className="font-bold text-sm uppercase tracking-wider">Security Tip</span>
            </div>
            <p className="text-sm text-emerald-500/80 leading-relaxed">
              Always ensure you are in a well-lit room before starting the face verification process. Avoid wearing hats or sunglasses.
            </p>
          </div>

          <div className="bg-app-card border border-app-border rounded-3xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold">Recent Video Analyses</h3>
              <button 
                onClick={() => navigate('/history')}
                className="text-[10px] font-black uppercase tracking-widest text-emerald-500 hover:text-emerald-400 transition-colors"
              >
                View All
              </button>
            </div>
            
            <div className="space-y-4">
              {loading ? (
                <div className="flex justify-center py-4">
                  <Clock className="w-5 h-5 animate-spin opacity-20" />
                </div>
              ) : videoHistory.length === 0 ? (
                <p className="text-xs opacity-40 text-center py-4">No recent analyses found.</p>
              ) : (
                videoHistory.map((record) => (
                  <div 
                    key={record.id}
                    className="p-3 bg-app-bg border border-app-border rounded-xl hover:border-emerald-500/30 transition-all cursor-pointer group"
                    onClick={() => navigate('/history')}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center border shrink-0",
                        record.is_deepfake ? "text-red-500 bg-red-500/10 border-red-500/20" : "text-emerald-500 bg-emerald-500/10 border-emerald-500/20"
                      )}>
                        {record.is_deepfake ? <ShieldX className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate">{record.video_name}</p>
                        <div className="flex items-center gap-1.5 opacity-30 text-[8px] font-bold uppercase tracking-widest">
                          <Calendar className="w-2.5 h-2.5" />
                          {new Date(record.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={cn(
                        "text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border",
                        record.is_deepfake ? "text-red-500 border-red-500/20" : "text-emerald-500 border-emerald-500/20"
                      )}>
                        {record.is_deepfake ? 'Deepfake' : 'Authentic'}
                      </span>
                      <span className={cn(
                        "text-[8px] font-black uppercase tracking-widest",
                        record.risk_level === 'high' ? "text-red-500" : record.risk_level === 'medium' ? "text-orange-500" : "text-emerald-500"
                      )}>
                        Risk: {record.risk_level}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-app-card border border-app-border rounded-3xl p-6">
            <h3 className="font-bold mb-4">Recent Activity</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="opacity-50">Login from Chrome</span>
                <span className="opacity-30 font-mono">2m ago</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="opacity-50">Account created</span>
                <span className="opacity-30 font-mono">1h ago</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
