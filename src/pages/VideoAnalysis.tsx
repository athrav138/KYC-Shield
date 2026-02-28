import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Video, Upload, ShieldCheck, ShieldAlert, ShieldX, 
  Loader2, AlertCircle, FileVideo, Play, Info, BarChart3
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { cn } from '../lib/utils';

const getFriendlyErrorMessage = (err: any): string => {
  const msg = err?.message || '';
  if (msg.includes('429') || msg.includes('Quota exceeded') || msg.includes('RESOURCE_EXHAUSTED')) {
    return 'API Rate Limit Exceeded. Please wait a moment and try again.';
  }
  if (msg.includes('API key not valid')) {
    return 'Invalid API Key. Please check your configuration.';
  }
  return msg || 'An unexpected error occurred.';
};

export default function VideoAnalysis() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const onVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 20 * 1024 * 1024) {
        setError('Video file is too large. Please upload a video under 20MB.');
        return;
      }
      setVideoFile(file);
      setVideoPreview(URL.createObjectURL(file));
      setError('');
      setResult(null);
    }
  };

  const getAI = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Gemini API key is not configured.");
    return new GoogleGenAI({ apiKey });
  };

  const analyzeVideo = async () => {
    if (!videoFile) return;
    setLoading(true);
    setError('');

    try {
      const ai = getAI();
      
      // Convert file to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
      });
      reader.readAsDataURL(videoFile);
      const base64Data = await base64Promise;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            parts: [
              { text: `Analyze this video for deepfake manipulations and synthetic content.
              
              Rigorous Security Task:
              1. Visual Artifacts: Look for inconsistent lighting, unnatural eye blinking, lip-sync errors, or blending issues around the face and neck.
              2. Temporal Consistency: Check for jitter, flickering, or sudden changes in facial features across frames.
              3. Background Analysis: Look for warping or distortions in the background that occur when a subject's face is digitally manipulated.
              4. Audio-Visual Sync: If audio is present, check if the speech matches the lip movements perfectly or if there's a synthetic delay/robotic quality.
              
              Return a JSON object with: 
              { 
                isDeepfake: boolean, 
                confidenceScore: number (0-100), 
                riskLevel: "low" | "medium" | "high",
                detectedAnomalies: string[],
                explanation: string,
                frameAnalysis: { timestamp: string, issue: string }[]
              }.` },
              { inlineData: { mimeType: videoFile.type, data: base64Data } }
            ]
          }
        ],
        config: { responseMimeType: "application/json" }
      });

      const data = JSON.parse(response.text || "{}");
      setResult(data);

      // Save to DB
      await fetch('/api/video/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          videoName: videoFile.name,
          isDeepfake: data.isDeepfake,
          riskLevel: data.riskLevel,
          confidenceScore: data.confidenceScore,
          analysisData: data
        })
      });
    } catch (err: any) {
      console.error("Video Analysis Error:", err);
      setError(getFriendlyErrorMessage(err) || 'Video analysis failed. Please ensure the file is a valid video format.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex items-center gap-4 mb-12">
        <div className="p-4 bg-indigo-500/10 rounded-3xl border border-indigo-500/20">
          <Video className="w-8 h-8 text-indigo-500" />
        </div>
        <div>
          <h1 className="text-4xl font-black tracking-tight">Video <span className="text-indigo-500">Deepfake Lab</span></h1>
          <p className="opacity-50">Upload a video to detect AI-generated manipulations and synthetic faces.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Upload Section */}
        <div className="space-y-6">
          <div className={cn(
            "border-2 border-dashed rounded-[40px] p-12 flex flex-col items-center justify-center gap-6 transition-all relative overflow-hidden min-h-[400px]",
            videoPreview ? "border-indigo-500/30 bg-indigo-500/5" : "border-app-border hover:border-indigo-500/50"
          )}>
            {videoPreview ? (
              <div className="w-full space-y-6">
                <video 
                  ref={videoRef}
                  src={videoPreview} 
                  controls 
                  className="w-full rounded-2xl shadow-2xl border border-indigo-500/20"
                />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-500/20 rounded-lg">
                      <FileVideo className="w-5 h-5 text-indigo-500" />
                    </div>
                    <div>
                      <p className="text-sm font-bold truncate max-w-[200px]">{videoFile?.name}</p>
                      <p className="text-[10px] opacity-40 uppercase tracking-widest">{(videoFile!.size / (1024 * 1024)).toFixed(2)} MB</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => { setVideoFile(null); setVideoPreview(null); setResult(null); }}
                    className="text-xs font-bold text-red-500 hover:underline"
                  >
                    Remove Video
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="w-20 h-20 bg-indigo-500/10 rounded-full flex items-center justify-center">
                  <Upload className="w-10 h-10 text-indigo-500 opacity-40" />
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold mb-2">Drop your video here</p>
                  <p className="text-sm opacity-40">MP4, WebM, or MOV (Max 20MB)</p>
                </div>
                <input 
                  type="file" 
                  accept="video/*" 
                  onChange={onVideoUpload} 
                  className="absolute inset-0 opacity-0 cursor-pointer" 
                />
              </>
            )}
          </div>

          {videoFile && !result && (
            <button
              onClick={analyzeVideo}
              disabled={loading}
              className="w-full bg-indigo-500 text-white font-black py-4 rounded-2xl hover:bg-indigo-400 transition-all flex items-center justify-center gap-3 shadow-xl shadow-indigo-500/20 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  Analyzing Video Frames...
                </>
              ) : (
                <>
                  <Play className="w-6 h-6" />
                  Start Deepfake Analysis
                </>
              )}
            </button>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-center gap-3 text-red-500 text-sm">
              <AlertCircle className="w-5 h-5" />
              {error}
            </div>
          )}
        </div>

        {/* Results Section */}
        <div className="space-y-6">
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div 
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="bg-app-card border border-app-border rounded-[40px] p-12 h-full flex flex-col items-center justify-center text-center space-y-6"
              >
                <div className="relative">
                  <div className="w-24 h-24 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                  <Video className="w-8 h-8 text-indigo-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">Scanning for Manipulations</h3>
                  <p className="text-sm opacity-50 max-w-xs">Our AI is examining every frame for temporal jitter, facial artifacts, and synthetic patterns.</p>
                </div>
              </motion.div>
            ) : result ? (
              <motion.div 
                key="result"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                {/* Main Decision Card */}
                <div className={cn(
                  "p-8 rounded-[40px] border flex flex-col items-center text-center gap-4",
                  result.isDeepfake 
                    ? "bg-red-500/10 border-red-500/20" 
                    : "bg-emerald-500/10 border-emerald-500/20"
                )}>
                  <div className={cn(
                    "w-20 h-20 rounded-full flex items-center justify-center border",
                    result.isDeepfake ? "bg-red-500/20 border-red-500/30" : "bg-emerald-500/20 border-emerald-500/30"
                  )}>
                    {result.isDeepfake ? <ShieldX className="w-10 h-10 text-red-500" /> : <ShieldCheck className="w-10 h-10 text-emerald-500" />}
                  </div>
                  <div>
                    <h2 className="text-3xl font-black tracking-tight">
                      {result.isDeepfake ? 'Deepfake Detected' : 'Likely Authentic'}
                    </h2>
                    <p className="opacity-60 text-sm mt-2 max-w-sm">{result.explanation}</p>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-app-card p-6 rounded-3xl border border-app-border">
                    <p className="text-[10px] uppercase tracking-widest opacity-40 font-bold mb-1">Confidence Score</p>
                    <p className="text-3xl font-black text-indigo-500">{result.confidenceScore}%</p>
                  </div>
                  <div className="bg-app-card p-6 rounded-3xl border border-app-border">
                    <p className="text-[10px] uppercase tracking-widest opacity-40 font-bold mb-1">Risk Level</p>
                    <p className={cn(
                      "text-3xl font-black capitalize",
                      result.riskLevel === 'high' ? 'text-red-500' : result.riskLevel === 'medium' ? 'text-orange-500' : 'text-emerald-500'
                    )}>
                      {result.riskLevel}
                    </p>
                  </div>
                </div>

                {/* Anomalies */}
                <div className="bg-app-card p-8 rounded-[40px] border border-app-border">
                  <div className="flex items-center gap-2 mb-6">
                    <ShieldAlert className="w-5 h-5 text-indigo-500" />
                    <h3 className="font-bold uppercase tracking-widest text-xs">Detected Anomalies</h3>
                  </div>
                  <div className="space-y-3">
                    {result.detectedAnomalies.map((anomaly: string, i: number) => (
                      <div key={i} className="flex items-start gap-3 bg-app-bg/50 p-4 rounded-2xl border border-app-border/50">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                        <p className="text-sm opacity-80">{anomaly}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Frame Analysis */}
                {result.frameAnalysis && result.frameAnalysis.length > 0 && (
                  <div className="bg-app-card p-8 rounded-[40px] border border-app-border">
                    <div className="flex items-center gap-2 mb-6">
                      <BarChart3 className="w-5 h-5 text-indigo-500" />
                      <h3 className="font-bold uppercase tracking-widest text-xs">Frame-by-Frame Breakdown</h3>
                    </div>
                    <div className="space-y-4">
                      {result.frameAnalysis.map((frame: any, i: number) => (
                        <div key={i} className="flex items-center justify-between p-4 bg-app-bg/30 rounded-2xl border border-app-border/30">
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] font-mono bg-indigo-500/10 text-indigo-500 px-2 py-1 rounded">
                              {frame.timestamp}
                            </span>
                            <p className="text-xs opacity-70">{frame.issue}</p>
                          </div>
                          <AlertCircle className="w-4 h-4 text-orange-500/50" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            ) : (
              <div className="bg-app-card border border-app-border rounded-[40px] p-12 h-full flex flex-col items-center justify-center text-center opacity-40">
                <Info className="w-12 h-12 mb-4" />
                <h3 className="text-xl font-bold mb-2">Waiting for Analysis</h3>
                <p className="text-sm max-w-xs">Upload a video and click "Start Deepfake Analysis" to see the results here.</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
