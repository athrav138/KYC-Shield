import { useState, useRef, useEffect, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, FileText, Camera, Mic, CheckCircle2, 
  AlertCircle, Loader2, ArrowRight, ArrowLeft, 
  Upload, ShieldCheck, ShieldAlert, ShieldX, Download
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { generateKYCReport } from '../../lib/reportGenerator';
import { cn } from '../../lib/utils';
import { db } from '../../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

type Step = 'details' | 'aadhaar' | 'face' | 'voice' | 'result';

export default function KYCWorkflow({ user }: { user: any }) {
  const [step, setStep] = useState<Step>('details');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Data
  const [personalDetails, setPersonalDetails] = useState({ fullName: user.fullName, dob: '', address: '' });
  const [aadhaarImage, setAadhaarImage] = useState<string | null>(null);
  const [faceImage, setFaceImage] = useState<string | null>(null);
  const [livenessFrames, setLivenessFrames] = useState<string[]>([]);
  const [livenessStepIndex, setLivenessStepIndex] = useState(-1);
  const [livenessStatus, setLivenessStatus] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  
  // Results
  const [aadhaarResult, setAadhaarResult] = useState<any>(null);
  const [faceResult, setFaceResult] = useState<any>(null);
  const [voiceResult, setVoiceResult] = useState<any>(null);
  const [finalResult, setFinalResult] = useState<any>(null);
  const [permissions, setPermissions] = useState<{ camera: boolean | null, microphone: boolean | null }>({ camera: null, microphone: null });

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Gemini Initialization
  const getAI = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Gemini API key is not configured in the Secrets panel.");
    return new GoogleGenAI({ apiKey });
  };

  // --- Permission Handlers ---
  const checkPermissions = async () => {
    try {
      const camStatus = await navigator.permissions.query({ name: 'camera' as any });
      const micStatus = await navigator.permissions.query({ name: 'microphone' as any });
      
      setPermissions({
        camera: camStatus.state === 'granted',
        microphone: micStatus.state === 'granted'
      });

      camStatus.onchange = () => setPermissions(prev => ({ ...prev, camera: camStatus.state === 'granted' }));
      micStatus.onchange = () => setPermissions(prev => ({ ...prev, microphone: micStatus.state === 'granted' }));
    } catch (e) {
      console.warn('Permissions API not fully supported', e);
    }
  };

  useEffect(() => {
    checkPermissions();
  }, []);

  const requestPermissions = async (type: 'camera' | 'microphone') => {
    try {
      if (type === 'camera') {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(t => t.stop());
        setPermissions(prev => ({ ...prev, camera: true }));
      } else {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(t => t.stop());
        setPermissions(prev => ({ ...prev, microphone: true }));
      }
      setError('');
    } catch (err) {
      setError(`${type.charAt(0).toUpperCase() + type.slice(1)} access denied. Please enable it in browser settings.`);
    }
  };

  // --- Step Handlers ---

  const handleNext = () => {
    if (step === 'details') setStep('aadhaar');
    else if (step === 'aadhaar') setStep('face');
    else if (step === 'face') {
      setStep('voice');
      setVerificationCode(Math.floor(1000 + Math.random() * 9000).toString());
    }
    else if (step === 'voice') finalizeKYC();
  };

  const handleBack = () => {
    if (step === 'aadhaar') setStep('details');
    else if (step === 'face') setStep('aadhaar');
    else if (step === 'voice') setStep('face');
  };

  // --- Aadhaar Upload ---
  const onAadhaarUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setAadhaarImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const verifyAadhaar = async () => {
    if (!aadhaarImage) return;
    setLoading(true);
    setError('');
    try {
      const ai = getAI();
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            parts: [
              { text: `Analyze this Aadhaar card image. Extract the name, Aadhaar number, DOB, and Address. 
              Compare it with the provided details: ${JSON.stringify(personalDetails)}.
              Check for signs of tampering, fake fonts, or inconsistent layouts.
              Return a JSON object with: { name, aadhaarNumber, dob, address, isTampered, confidence, reasoning }.` },
              { inlineData: { mimeType: "image/jpeg", data: aadhaarImage.split(",")[1] } }
            ]
          }
        ],
        config: { responseMimeType: "application/json" }
      });

      const data = JSON.parse(response.text || "{}");
      setAadhaarResult(data);
      if (data.address) {
        setPersonalDetails(prev => ({ ...prev, address: data.address }));
      }
      handleNext();
    } catch (err: any) {
      console.error("Aadhaar Verification Error:", err);
      setError(err.message || 'Aadhaar verification failed');
    } finally {
      setLoading(false);
    }
  };

  // --- Face Capture ---
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) videoRef.current.srcObject = stream;
      setPermissions(prev => ({ ...prev, camera: true }));
    } catch (err) {
      setError('Camera access denied. Please check your browser settings.');
      setPermissions(prev => ({ ...prev, camera: false }));
    }
  };

  const captureFace = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        context.drawImage(videoRef.current, 0, 0, 640, 480);
        const data = canvasRef.current.toDataURL('image/jpeg');
        return data;
      }
    }
    return null;
  };

  const livenessSteps = [
    { id: 'straight', label: 'Look straight into the camera', icon: User },
    { id: 'blink', label: 'Blink your eyes twice', icon: Camera },
    { id: 'smile', label: 'Smile naturally', icon: CheckCircle2 },
    { id: 'turn', label: 'Turn head left and right', icon: ArrowRight },
    { id: 'forward', label: 'Move slightly forward', icon: ArrowRight },
  ];

  const startLivenessSession = async () => {
    await startCamera();
    setLivenessStepIndex(0);
    setLivenessFrames([]);
    setLivenessStatus('Get ready...');
    setCountdown(3);
  };

  useEffect(() => {
    let timer: any;
    if (livenessStepIndex >= 0 && livenessStepIndex < livenessSteps.length) {
      if (countdown > 0) {
        timer = setTimeout(() => setCountdown(prev => prev - 1), 1000);
      } else {
        // Capture frame
        const frame = captureFace();
        if (frame) {
          setLivenessFrames(prev => [...prev, frame]);
          
          const stepId = livenessSteps[livenessStepIndex].id;
          if (stepId === 'blink') setLivenessStatus('Blink captured');
          else if (stepId === 'smile') setLivenessStatus('Expression captured');
          else if (stepId === 'turn') setLivenessStatus('Movement captured');
          else if (stepId === 'forward') setLivenessStatus('Depth captured');
          else setLivenessStatus('Position captured');
          
          if (livenessStepIndex === livenessSteps.length - 1) {
            // Finished all steps
            setTimeout(() => {
              setLivenessStepIndex(-1);
              setLivenessStatus('All frames captured');
              if (videoRef.current && videoRef.current.srcObject) {
                const stream = videoRef.current.srcObject as MediaStream;
                stream.getTracks().forEach(track => track.stop());
              }
            }, 1000);
          } else {
            // Next step
            setTimeout(() => {
              setLivenessStepIndex(prev => prev + 1);
              setCountdown(3);
            }, 1000);
          }
        }
      }
    }
    return () => clearTimeout(timer);
  }, [livenessStepIndex, countdown]);

  const verifyFace = async () => {
    if (livenessFrames.length === 0 || !aadhaarImage) return;
    setLoading(true);
    setError('');
    try {
      const ai = getAI();
      const parts = [
        { inlineData: { mimeType: "image/jpeg", data: aadhaarImage.split(",")[1] } }, // Aadhaar photo for comparison
        ...livenessFrames.map((img: string) => ({
          inlineData: { mimeType: "image/jpeg", data: img.split(",")[1] }
        }))
      ];

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            parts: [
              { text: `Analyze the provided images for advanced KYC face liveness, deepfake detection, and identity matching.
              
              Input:
              - Image 1: User's Aadhaar card photo.
              - Images 2-6: A sequence of 5 frames representing a user following these instructions:
                1. Look straight
                2. Blink eyes
                3. Smile
                4. Turn head
                5. Move forward
              
              Rigorous Security Task:
              1. Face Match: Compare the face on the Aadhaar card (Image 1) with the face in the live frames (Images 2-6). Calculate a match score (0-100) based on facial features, geometry, and landmarks.
              2. Liveness Verification: Verify if the user followed each instruction across the frames. Check for micro-movements (blinking, smile, head turn, depth change).
              3. Deepfake Detection: Detect signs of spoofing: 
                * Photo-of-photo: Look for moiré patterns, static textures, or glare.
                * Video replay: Look for screen borders, unnatural reflections, or pixelation.
                * Deepfake/Synthetic: Look for facial artifacts, inconsistent skin texture, unnatural eye movement, lip-sync issues, or blending errors at the edges of the face.
                * Masks: Look for unnatural edges or rigid facial structures.
              
              Return a JSON object with: 
              { 
                isLive: boolean, 
                humanDetected: boolean,
                confidence: number (0-100), 
                riskLevel: "low" | "medium" | "high",
                detectedMovements: { blink: boolean, smile: boolean, headTurn: boolean, depthChange: boolean },
                matchScore: number (0-100),
                reasoning: string,
                explanation: string (detailed summary for user)
              }.` },
              ...parts
            ]
          }
        ],
        config: { responseMimeType: "application/json" }
      });

      const data = JSON.parse(response.text || "{}");
      setFaceResult(data);
      setFaceImage(livenessFrames[0]);
    } catch (err: any) {
      console.error("Face Verification Error:", err);
      setError(err.message || 'Face verification failed');
    } finally {
      setLoading(false);
    }
  };

  // --- Voice Verification ---
  const startVoiceRecording = async () => {
    setError('');
    setVoiceTranscript('');
    setAudioBase64(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setPermissions(prev => ({ ...prev, microphone: true }));
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          setAudioBase64(base64);
        };
        reader.readAsDataURL(audioBlob);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
        setIsRecording(false);
      };

      // Also try SpeechRecognition for live feedback, but don't rely on it for the final result
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        recognition.continuous = false;
        recognition.interimResults = true;

        recognition.onresult = (event: any) => {
          const transcript = Array.from(event.results)
            .map((result: any) => result[0].transcript)
            .join('');
          setVoiceTranscript(transcript);
        };

        recognition.onerror = (event: any) => {
          console.warn('Speech recognition non-fatal error:', event.error);
          // We don't set global error here because we have the raw audio backup
          if (event.error === 'network') {
            setVoiceTranscript('(Network error: Live transcript unavailable, but audio is being recorded)');
          }
        };

        recognition.start();
      }

      mediaRecorder.start();
      setIsRecording(true);

      // Automatically stop after 5 seconds
      setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
      }, 5000);

    } catch (err: any) {
      console.error('Microphone access error:', err);
      setError('Could not access microphone. Please check permissions.');
      setPermissions(prev => ({ ...prev, microphone: false }));
      setIsRecording(false);
    }
  };

  const verifyVoice = async () => {
    if (!audioBase64) {
      setError('No audio recorded. Please try again.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const ai = getAI();
      const expectedText = `My verification code is ${verificationCode}`;
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            parts: [
              { text: `Analyze the provided audio for KYC voice liveness and deepfake detection.
              Expected phrase to be spoken: "${expectedText}"
              The user MUST say the specific code: ${verificationCode}.
              
              Rigorous Security Task:
              1. Transcription & Code Match: Transcribe the audio. Does it contain the correct 4-digit code?
              2. Deepfake Detection: Check for robotic cadence, frequency artifacts, unnatural breathing, or signs of AI voice cloning (e.g., lack of emotional inflection, consistent background noise that sounds synthetic).
              3. Liveness Verification: Evaluate if the voice sounds like a live human in a real-world environment (look for natural mouth sounds, slight background variance, and human-like prosody).
              4. Replay Attack Detection: Check for "room-within-a-room" acoustics or screen-playback artifacts.
              
              Return a JSON object with: { 
                matchesText: boolean, 
                codeVerified: boolean,
                isNatural: boolean, 
                riskLevel: number (0-100), 
                reasoning: string,
                transcript: string,
                confidence: number (0-100)
              }.` },
              { inlineData: { mimeType: "audio/webm", data: audioBase64 } }
            ]
          }
        ],
        config: { responseMimeType: "application/json" }
      });

      const data = JSON.parse(response.text || "{}");
      if (data.transcript) setVoiceTranscript(data.transcript);
      setVoiceResult(data);
      finalizeKYC(data);
    } catch (err: any) {
      console.error("Voice Verification Error:", err);
      setError(err.message || 'Voice verification failed');
    } finally {
      setLoading(false);
    }
  };

  const finalizeKYC = async (vResult?: any) => {
    setLoading(true);
    setError('');
    try {
      const ai = getAI();
      const currentVoiceResult = vResult || voiceResult;
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            parts: [
              { text: `Finalize KYC decision based on these components:
              Aadhaar Analysis: ${JSON.stringify(aadhaarResult)}
              Face Liveness Analysis: ${JSON.stringify(faceResult)}
              Voice Analysis: ${JSON.stringify(currentVoiceResult)}
              
              Generate a final decision (verified, suspicious, fake), a total risk score (0-100), a confidence score, and a detailed explanation.
              Return as JSON: { decision, riskScore, confidenceScore, explanation }.` }
            ]
          }
        ],
        config: { responseMimeType: "application/json" }
      });

      const final = JSON.parse(response.text || "{}");
      
      // Save to Firestore (if configured)
      if (db) {
        try {
          await addDoc(collection(db, "kyc_users"), {
            userId: user.id,
            name: personalDetails.fullName,
            email: user.email,
            aadhaarNumber: aadhaarResult?.aadhaarNumber ? `XXXX-XXXX-${aadhaarResult.aadhaarNumber.slice(-4)}` : 'N/A',
            faceResult: {
              matchScore: faceResult?.matchScore,
              isLive: faceResult?.isLive,
              riskLevel: faceResult?.riskLevel
            },
            voiceResult: {
              matchesText: currentVoiceResult?.matchesText,
              confidence: currentVoiceResult?.confidence,
              riskLevel: currentVoiceResult?.riskLevel
            },
            status: final.decision === 'verified' ? 'Accepted' : 'Rejected',
            confidenceScore: final.confidenceScore,
            riskLevel: final.riskScore > 70 ? 'High' : final.riskScore > 30 ? 'Medium' : 'Low',
            timestamp: serverTimestamp(),
            createdAt: new Date().toISOString()
          });
        } catch (fbErr) {
          console.warn("Firestore save failed:", fbErr);
        }
      }

      // Save to local DB as well (keep existing logic for compatibility)
      const res = await fetch('/api/kyc/finalize', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ 
          aadhaar: aadhaarResult, 
          face: faceResult, 
          voice: currentVoiceResult,
          final: final,
          userId: user.id
        })
      });
      
      if (!res.ok) throw new Error("Failed to save verification results to the server.");
      
      setFinalResult(final);
      setStep('result');
    } catch (err: any) {
      console.error("Finalization Error:", err);
      setError(err.message || 'Finalization failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      {/* Progress Bar */}
      <div className="flex items-center justify-between mb-12">
        {(['details', 'aadhaar', 'face', 'voice', 'result'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center flex-1 last:flex-none">
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all",
              step === s ? "border-emerald-500 bg-emerald-500/20 text-emerald-500" : 
              i < ['details', 'aadhaar', 'face', 'voice', 'result'].indexOf(step) ? "border-emerald-500 bg-emerald-500 text-black" : "border-app-border opacity-20"
            )}>
              {i < ['details', 'aadhaar', 'face', 'voice', 'result'].indexOf(step) ? <CheckCircle2 className="w-6 h-6" /> : i + 1}
            </div>
            {i < 4 && <div className={cn("h-[2px] flex-1 mx-2", i < ['details', 'aadhaar', 'face', 'voice', 'result'].indexOf(step) ? "bg-emerald-500" : "bg-app-border")} />}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="bg-app-card border border-app-border rounded-3xl p-8"
        >
          {step === 'details' && (
            <div className="space-y-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-blue-500/20 rounded-2xl text-blue-400">
                  <User className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">Personal Details</h2>
                  <p className="opacity-50 text-sm">Please confirm your basic information.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest opacity-40">Full Name</label>
                  <input 
                    type="text" 
                    value={personalDetails.fullName}
                    onChange={(e) => setPersonalDetails({...personalDetails, fullName: e.target.value})}
                    className="w-full bg-app-card border border-app-border rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest opacity-40">Date of Birth</label>
                  <input 
                    type="date" 
                    value={personalDetails.dob}
                    onChange={(e) => setPersonalDetails({...personalDetails, dob: e.target.value})}
                    className="w-full bg-app-card border border-app-border rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest opacity-40">Residential Address</label>
                  <textarea 
                    rows={3}
                    value={personalDetails.address}
                    onChange={(e) => setPersonalDetails({...personalDetails, address: e.target.value})}
                    className="w-full bg-app-card border border-app-border rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                </div>
              </div>
              <div className="pt-6 flex justify-end">
                <button 
                  onClick={handleNext}
                  className="bg-emerald-500 text-black font-bold px-8 py-3 rounded-xl flex items-center gap-2 hover:bg-emerald-400 transition-all"
                >
                  Continue <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {step === 'aadhaar' && (
            <div className="space-y-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-purple-500/20 rounded-2xl text-purple-400">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">Aadhaar Verification</h2>
                  <p className="opacity-50 text-sm">Upload a clear photo of your Aadhaar card.</p>
                </div>
              </div>

              <div className="border-2 border-dashed border-app-border rounded-3xl p-12 flex flex-col items-center justify-center gap-4 hover:border-emerald-500/50 transition-colors relative">
                {aadhaarImage ? (
                  <div className="relative w-full aspect-video rounded-xl overflow-hidden">
                    <img src={aadhaarImage} className="w-full h-full object-cover" />
                    <button onClick={() => setAadhaarImage(null)} className="absolute top-4 right-4 bg-app-card p-2 rounded-full hover:bg-red-500 transition-colors">
                      <ShieldX className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload className="w-12 h-12 opacity-20" />
                    <div className="text-center">
                      <p className="font-bold">Click to upload or drag and drop</p>
                      <p className="text-xs opacity-40 mt-1">PNG, JPG up to 10MB</p>
                    </div>
                    <input type="file" accept="image/*" onChange={onAadhaarUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                  </>
                )}
              </div>

              <div className="pt-6 flex justify-between">
                <button onClick={handleBack} className="opacity-50 font-bold px-8 py-3 rounded-xl flex items-center gap-2 hover:opacity-100 transition-all">
                  <ArrowLeft className="w-5 h-5" /> Back
                </button>
                <button 
                  onClick={verifyAadhaar}
                  disabled={!aadhaarImage || loading}
                  className="bg-emerald-500 text-black font-bold px-8 py-3 rounded-xl flex items-center gap-2 hover:bg-emerald-400 disabled:opacity-50 transition-all"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Verify Aadhaar <ArrowRight className="w-5 h-5" /></>}
                </button>
              </div>
            </div>
          )}

          {step === 'face' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-emerald-500/20 rounded-2xl text-emerald-400">
                    <Camera className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Advanced Face Verification</h2>
                    <p className="opacity-50 text-sm">
                      {faceResult ? 'Verification complete. Review your results below.' : 'Follow the instructions to confirm you are a real person.'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                  <div className={cn("w-2 h-2 rounded-full", permissions.camera ? "bg-emerald-500" : "bg-red-500")} />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-500">
                    {permissions.camera ? 'Camera Ready' : 'Camera Required'}
                  </span>
                </div>
              </div>

              {!permissions.camera && !faceResult && livenessStepIndex === -1 && (
                <div className="bg-emerald-500/5 border border-emerald-500/10 p-8 rounded-3xl text-center space-y-4 animate-in zoom-in-95 duration-300">
                  <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
                    <Camera className="w-8 h-8 text-emerald-500" />
                  </div>
                  <h3 className="text-xl font-bold">Camera Access Required</h3>
                  <p className="text-sm opacity-60 max-w-xs mx-auto">We need camera access to perform face liveness verification and deepfake detection.</p>
                  <button 
                    onClick={() => requestPermissions('camera')}
                    className="px-8 py-3 bg-emerald-500 text-black font-bold rounded-2xl hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20"
                  >
                    Grant Camera Permission
                  </button>
                </div>
              )}

              {faceResult ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="relative aspect-video bg-app-bg rounded-3xl overflow-hidden border border-app-border">
                      <img src={faceImage || ''} className="w-full h-full object-cover" />
                      <div className="absolute top-4 right-4 bg-emerald-500 text-black text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">
                        Verified
                      </div>
                    </div>
                    
                    <div className="bg-app-card p-6 rounded-3xl border border-app-border flex flex-col justify-center">
                      <p className="text-xs uppercase tracking-widest opacity-40 mb-4">Liveness Detection Results</p>
                      <div className="grid grid-cols-2 gap-4">
                        {faceResult.detectedMovements && Object.entries(faceResult.detectedMovements).map(([key, value]) => (
                          <div key={key} className="flex items-center gap-3 bg-app-bg/50 p-3 rounded-xl border border-app-border/50">
                            <div className={cn("w-2 h-2 rounded-full", value ? "bg-emerald-500" : "bg-red-500")} />
                            <span className="text-xs capitalize font-medium opacity-80">{key.replace(/([A-Z])/g, ' $1')}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {faceResult.matchScore !== undefined && (
                    <div className="bg-app-card p-6 rounded-3xl border border-app-border">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="text-xs uppercase tracking-widest opacity-40 mb-1">Face Match Score</p>
                          <p className="text-sm opacity-60">Confidence in identity matching</p>
                        </div>
                        <p className={cn(
                          "text-3xl font-bold",
                          faceResult.matchScore > 80 ? "text-emerald-500" : faceResult.matchScore > 50 ? "text-orange-500" : "text-red-500"
                        )}>
                          {faceResult.matchScore}%
                        </p>
                      </div>
                      <div className="w-full bg-app-bg rounded-full h-2 overflow-hidden">
                        <div 
                          className={cn(
                            "h-full transition-all duration-1000",
                            faceResult.matchScore > 80 ? "bg-emerald-500" : faceResult.matchScore > 50 ? "bg-orange-500" : "bg-red-500"
                          )}
                          style={{ width: `${faceResult.matchScore}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl flex items-start gap-3">
                    <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                    <p className="text-sm text-emerald-500/80 leading-relaxed">
                      {faceResult.explanation}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="relative aspect-video bg-app-bg rounded-3xl overflow-hidden border border-app-border">
                  {livenessStepIndex === -1 && livenessFrames.length === 0 ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-app-card/50 backdrop-blur-sm z-20">
                      <ShieldCheck className="w-16 h-16 text-emerald-500 mb-4" />
                      <h3 className="text-xl font-bold mb-2">Ready for Liveness Check?</h3>
                      <p className="text-sm opacity-60 mb-6 text-center max-w-xs">We will guide you through a few simple movements to verify your identity.</p>
                      <button onClick={startLivenessSession} className="bg-emerald-500 text-black px-8 py-3 rounded-2xl font-bold hover:bg-emerald-400 transition-all">
                        Start Verification
                      </button>
                    </div>
                  ) : null}

                  <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                  
                  {livenessStepIndex >= 0 && (
                    <div className="absolute inset-0 flex flex-col items-center justify-between p-8 z-30 pointer-events-none">
                      <div className="flex flex-col items-center gap-4">
                        <div className="bg-app-card/80 backdrop-blur-md px-6 py-3 rounded-2xl border border-app-border flex items-center gap-3">
                          <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse" />
                          <span className="text-lg font-bold text-app-text">{livenessSteps[livenessStepIndex].label}</span>
                        </div>
                        
                        {countdown > 0 && (
                          <motion.div 
                            key={countdown}
                            initial={{ scale: 1.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="text-6xl font-black text-emerald-500 drop-shadow-[0_0_15px_rgba(16,185,129,0.5)]"
                          >
                            {countdown}
                          </motion.div>
                        )}
                      </div>
                      
                      <div className="w-full max-w-md bg-app-bg/60 backdrop-blur-sm rounded-full h-2 overflow-hidden border border-app-border/50">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${((livenessStepIndex + 1) / livenessSteps.length) * 100}%` }}
                          className="h-full bg-emerald-500"
                        />
                      </div>
                    </div>
                  )}

                  {livenessStatus && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40">
                      <div className="bg-emerald-500 text-black text-[10px] font-bold uppercase tracking-widest px-4 py-1 rounded-full shadow-lg">
                        {livenessStatus}
                      </div>
                    </div>
                  )}

                  <div className="absolute inset-0 border-[40px] border-black/40 pointer-events-none">
                    <div className="w-full h-full border-2 border-dashed border-emerald-500/50 rounded-[100px]" />
                  </div>
                  
                  <canvas ref={canvasRef} width={640} height={480} className="hidden" />
                </div>
              )}

              <div className="pt-6 flex justify-between">
                <button 
                  onClick={() => {
                    if (faceResult) setFaceResult(null);
                    else handleBack();
                  }} 
                  className="opacity-50 font-bold px-8 py-3 rounded-xl flex items-center gap-2 hover:opacity-100 transition-all"
                >
                  <ArrowLeft className="w-5 h-5" /> {faceResult ? 'Re-verify' : 'Back'}
                </button>
                <button 
                  onClick={faceResult ? handleNext : verifyFace}
                  disabled={(!faceResult && livenessFrames.length < livenessSteps.length) || loading}
                  className="bg-emerald-500 text-black font-bold px-8 py-3 rounded-xl flex items-center gap-2 hover:bg-emerald-400 disabled:opacity-50 transition-all"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                    faceResult ? <>Continue to Voice <ArrowRight className="w-5 h-5" /></> : <>Complete Face Verification <ArrowRight className="w-5 h-5" /></>
                  )}
                </button>
              </div>
            </div>
          )}

          {step === 'voice' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-orange-500/20 rounded-2xl text-orange-400">
                    <Mic className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Voice Authentication</h2>
                    <p className="opacity-50 text-sm">Read the sentence below clearly into your microphone.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                  <div className={cn("w-2 h-2 rounded-full", permissions.microphone ? "bg-emerald-500" : "bg-red-500")} />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-500">
                    {permissions.microphone ? 'Mic Ready' : 'Mic Required'}
                  </span>
                </div>
              </div>

              {!permissions.microphone && !isRecording && (
                <div className="bg-orange-500/5 border border-orange-500/10 p-8 rounded-3xl text-center space-y-4 animate-in zoom-in-95 duration-300">
                  <div className="w-16 h-16 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto">
                    <Mic className="w-8 h-8 text-orange-500" />
                  </div>
                  <h3 className="text-xl font-bold">Microphone Access Required</h3>
                  <p className="text-sm opacity-60 max-w-xs mx-auto">We need microphone access to verify your voice and detect AI voice clones.</p>
                  <button 
                    onClick={() => requestPermissions('microphone')}
                    className="px-8 py-3 bg-orange-500 text-black font-bold rounded-2xl hover:bg-orange-400 transition-all shadow-lg shadow-orange-500/20"
                  >
                    Grant Mic Permission
                  </button>
                </div>
              )}

              <div className="bg-app-card border border-app-border rounded-3xl p-8 text-center relative overflow-hidden">
                {isRecording && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute inset-0 bg-emerald-500/5 flex items-center justify-center pointer-events-none"
                  >
                    <div className="flex gap-1">
                      {[0, 1, 2, 3, 4].map((i) => (
                        <motion.div
                          key={i}
                          animate={{ height: [10, 30, 10] }}
                          transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.1 }}
                          className="w-1 bg-emerald-500 rounded-full"
                        />
                      ))}
                    </div>
                  </motion.div>
                )}

                <p className="text-xl font-medium mb-2 opacity-60 relative z-10">
                  Please say clearly:
                </p>
                <p className="text-3xl font-black mb-8 text-emerald-400 relative z-10 tracking-tight">
                  "My verification code is <span className="text-white bg-emerald-500 px-3 py-1 rounded-lg ml-2">{verificationCode}</span>"
                </p>
                
                <div className="flex flex-col items-center gap-4 relative z-10">
                  <button 
                    onClick={startVoiceRecording}
                    disabled={isRecording}
                    className={cn(
                      "w-20 h-20 rounded-full flex items-center justify-center group transition-all relative",
                      isRecording 
                        ? "bg-red-500/20 border border-red-500/30" 
                        : "bg-emerald-500/20 border border-emerald-500/30 hover:bg-emerald-500/30"
                    )}
                  >
                    {isRecording ? (
                      <div className="w-4 h-4 bg-red-500 rounded-sm animate-pulse" />
                    ) : (
                      <Mic className="w-8 h-8 text-emerald-500 group-hover:scale-110 transition-transform" />
                    )}
                    
                    {isRecording && (
                      <motion.div 
                        layoutId="ring"
                        className="absolute inset-0 rounded-full border-2 border-red-500"
                        animate={{ scale: [1, 1.2], opacity: [1, 0] }}
                        transition={{ repeat: Infinity, duration: 1 }}
                      />
                    )}
                  </button>
                  <p className="text-xs uppercase tracking-widest opacity-40 font-bold">
                    {isRecording ? 'Recording (5s)...' : audioBase64 ? 'Recording captured' : 'Click to start speaking'}
                  </p>
                </div>

                {voiceTranscript && (
                  <div className="mt-8 p-4 bg-app-card rounded-xl border border-app-border animate-in fade-in slide-in-from-bottom-2">
                    <p className="text-xs opacity-40 uppercase tracking-widest mb-2">Transcript</p>
                    <p className="text-sm">{voiceTranscript}</p>
                  </div>
                )}
                
                {audioBase64 && !isRecording && (
                  <div className="mt-4 flex justify-center">
                    <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-500">Audio Ready for Analysis</span>
                    </div>
                  </div>
                )}
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-center gap-3 text-red-500 text-sm">
                  <AlertCircle className="w-5 h-5" />
                  {error}
                </div>
              )}

              <div className="pt-6 flex justify-between">
                <button onClick={handleBack} className="opacity-50 font-bold px-8 py-3 rounded-xl flex items-center gap-2 hover:opacity-100 transition-all">
                  <ArrowLeft className="w-5 h-5" /> Back
                </button>
                <button 
                  onClick={verifyVoice}
                  disabled={!voiceTranscript || loading}
                  className="bg-emerald-500 text-black font-bold px-8 py-3 rounded-xl flex items-center gap-2 hover:bg-emerald-400 disabled:opacity-50 transition-all"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Finalize Verification <ArrowRight className="w-5 h-5" /></>}
                </button>
              </div>
            </div>
          )}

          {step === 'result' && finalResult && (
            <div className="space-y-8 text-center py-8">
              <div className="flex flex-col items-center gap-4">
                {finalResult.decision === 'verified' ? (
                  <div className="w-24 h-24 bg-emerald-500/20 rounded-full flex items-center justify-center border border-emerald-500/30">
                    <ShieldCheck className="w-12 h-12 text-emerald-500" />
                  </div>
                ) : finalResult.decision === 'suspicious' ? (
                  <div className="w-24 h-24 bg-orange-500/20 rounded-full flex items-center justify-center border border-orange-500/30">
                    <ShieldAlert className="w-12 h-12 text-orange-500" />
                  </div>
                ) : (
                  <div className="w-24 h-24 bg-red-500/20 rounded-full flex items-center justify-center border border-red-500/30">
                    <ShieldX className="w-12 h-12 text-red-500" />
                  </div>
                )}
                <h2 className="text-3xl font-bold capitalize">Verification {finalResult.decision}</h2>
                <p className="opacity-50 max-w-md mx-auto">{finalResult.explanation}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-app-card p-6 rounded-2xl border border-app-border">
                  <p className="text-xs uppercase tracking-widest opacity-40 mb-1">Risk Score</p>
                  <p className={cn("text-3xl font-bold", finalResult.riskScore < 30 ? "text-emerald-500" : finalResult.riskScore < 70 ? "text-orange-500" : "text-red-500")}>
                    {finalResult.riskScore}/100
                  </p>
                </div>
                <div className="bg-app-card p-6 rounded-2xl border border-app-border">
                  <p className="text-xs uppercase tracking-widest opacity-40 mb-1">AI Confidence</p>
                  <p className="text-3xl font-bold text-blue-400">{finalResult.confidenceScore}%</p>
                </div>
              </div>

              {faceResult && faceResult.matchScore !== undefined && (
                <div className="bg-app-card p-6 rounded-2xl border border-app-border text-left overflow-hidden">
                  <p className="text-xs uppercase tracking-widest opacity-40 mb-6">Identity Match Analysis</p>
                  
                  <div className="flex flex-col md:flex-row gap-8 items-center mb-8">
                    <div className="flex-1 w-full">
                      <div className="relative aspect-square rounded-2xl overflow-hidden border border-app-border bg-app-bg">
                        <img src={aadhaarImage!} alt="Aadhaar Photo" className="w-full h-full object-cover" />
                        <div className="absolute bottom-0 inset-x-0 bg-black/60 backdrop-blur-md p-2 text-[10px] font-bold uppercase text-center">Aadhaar Photo</div>
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                        <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                      </div>
                      <div className="h-12 w-px bg-gradient-to-b from-emerald-500/50 to-transparent" />
                      <div className="text-xl font-black text-emerald-500">{faceResult.matchScore}%</div>
                      <div className="text-[10px] font-bold opacity-40 uppercase tracking-widest">Match</div>
                    </div>

                    <div className="flex-1 w-full">
                      <div className="relative aspect-square rounded-2xl overflow-hidden border border-app-border bg-app-bg">
                        <img src={faceImage!} alt="Live Selfie" className="w-full h-full object-cover" />
                        <div className="absolute bottom-0 inset-x-0 bg-black/60 backdrop-blur-md p-2 text-[10px] font-bold uppercase text-center">Live Capture</div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs uppercase tracking-widest opacity-40">Liveness Status</p>
                      <div className="flex items-center gap-2">
                        <div className={cn("w-2 h-2 rounded-full animate-pulse", faceResult.isLive ? "bg-emerald-500" : "bg-red-500")} />
                        <span className={cn("text-sm font-bold", faceResult.isLive ? "text-emerald-500" : "text-red-500")}>
                          {faceResult.isLive ? 'Live Human Verified' : 'Spoofing Detected'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-app-border">
                      {faceResult.detectedMovements && Object.entries(faceResult.detectedMovements).map(([key, value]) => (
                        <div key={key} className="flex items-center gap-2">
                          <div className={cn("w-2 h-2 rounded-full", value ? "bg-emerald-500" : "bg-red-500")} />
                          <span className="text-xs capitalize opacity-60">{key.replace(/([A-Z])/g, ' $1')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Fraud Risk Meter */}
              <div className="bg-app-card p-8 rounded-3xl border border-app-border text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5">
                  <ShieldCheck className="w-24 h-24" />
                </div>
                
                <p className="text-xs uppercase tracking-widest opacity-40 mb-8 font-black">AI Fraud Risk Assessment</p>
                
                <div className="relative w-48 h-24 mx-auto mb-8">
                  {/* Semi-circle Gauge */}
                  <div className="absolute inset-0 border-[12px] border-app-bg rounded-t-full" />
                  <div 
                    className={cn(
                      "absolute inset-0 border-[12px] rounded-t-full transition-all duration-1000",
                      finalResult.riskScore < 30 ? "border-emerald-500" : finalResult.riskScore < 70 ? "border-orange-500" : "border-red-500"
                    )}
                    style={{ 
                      clipPath: 'inset(0 0 0 0)',
                      transform: `rotate(${(finalResult.riskScore / 100) * 180 - 180}deg)`,
                      transformOrigin: 'bottom center'
                    }}
                  />
                  <div className="absolute bottom-0 inset-x-0 flex flex-col items-center">
                    <span className={cn(
                      "text-3xl font-black",
                      finalResult.riskScore < 30 ? "text-emerald-500" : finalResult.riskScore < 70 ? "text-orange-500" : "text-red-500"
                    )}>
                      {finalResult.riskScore}%
                    </span>
                    <span className="text-[10px] font-bold opacity-40 uppercase tracking-widest">Risk Score</span>
                  </div>
                </div>

                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-app-bg border border-app-border mb-6">
                  <span className={cn(
                    "w-2 h-2 rounded-full",
                    finalResult.decision === 'verified' ? "bg-emerald-500" : finalResult.decision === 'suspicious' ? "bg-orange-500" : "bg-red-500"
                  )} />
                  <span className={cn(
                    "text-xs font-bold uppercase tracking-widest",
                    finalResult.decision === 'verified' ? "text-emerald-500" : finalResult.decision === 'suspicious' ? "text-orange-500" : "text-red-500"
                  )}>
                    {finalResult.decision === 'verified' ? 'Low Risk - Verified' : finalResult.decision === 'suspicious' ? 'Medium Risk - Manual Review' : 'High Risk - Rejected'}
                  </span>
                </div>

                <p className="text-sm opacity-60 leading-relaxed max-w-lg mx-auto italic">
                  "{finalResult.explanation}"
                </p>
              </div>

              {aadhaarResult && (
                <div className="bg-app-card p-6 rounded-2xl border border-app-border text-left">
                  <p className="text-xs uppercase tracking-widest opacity-40 mb-4">Extracted Personal Details</p>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-[10px] uppercase tracking-widest opacity-40 mb-1">Name</p>
                        <p className="text-sm font-bold">{aadhaarResult.name || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-widest opacity-40 mb-1">Aadhaar Number</p>
                        <p className="text-sm font-bold font-mono">{aadhaarResult.aadhaarNumber || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-widest opacity-40 mb-1">DOB</p>
                        <p className="text-sm font-bold">{aadhaarResult.dob || 'N/A'}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-widest opacity-40 mb-1">Extracted Address</p>
                      <p className="text-sm opacity-80 leading-relaxed">{aadhaarResult.address || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              )}

              {voiceResult && (
                <div className="bg-app-card p-6 rounded-2xl border border-app-border text-left">
                  <p className="text-xs uppercase tracking-widest opacity-40 mb-4">Voice Liveness & Authenticity</p>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div>
                        <p className="text-[10px] uppercase tracking-widest opacity-40 mb-1">Code Verified</p>
                        <div className="flex items-center gap-2">
                          <div className={cn("w-2 h-2 rounded-full", voiceResult.codeVerified ? "bg-emerald-500" : "bg-red-500")} />
                          <span className="text-xs font-bold">{voiceResult.codeVerified ? 'Correct' : 'Incorrect'}</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-widest opacity-40 mb-1">Natural Speech</p>
                        <div className="flex items-center gap-2">
                          <div className={cn("w-2 h-2 rounded-full", voiceResult.isNatural ? "bg-emerald-500" : "bg-red-500")} />
                          <span className="text-xs font-bold">{voiceResult.isNatural ? 'Natural' : 'Synthetic/AI'}</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-widest opacity-40 mb-1">Voice Risk</p>
                        <p className={cn("text-xs font-bold", voiceResult.riskLevel < 30 ? "text-emerald-500" : voiceResult.riskLevel < 70 ? "text-orange-500" : "text-red-500")}>
                          {voiceResult.riskLevel}/100
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-widest opacity-40 mb-1">AI Confidence</p>
                        <p className="text-xs font-bold text-blue-400">{voiceResult.confidence || 0}%</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-widest opacity-40 mb-1">Transcript</p>
                      <p className="text-sm italic opacity-60">"{voiceTranscript}"</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button 
                  onClick={() => window.location.href = '/'}
                  className="bg-white text-black font-bold px-12 py-4 rounded-2xl hover:bg-emerald-400 transition-all flex-1"
                >
                  Return to Dashboard
                </button>
                {finalResult.decision === 'verified' && (
                  <button 
                    onClick={() => generateKYCReport({
                      userName: user.full_name,
                      date: new Date().toLocaleDateString(),
                      status: finalResult.decision,
                      confidenceScore: finalResult.confidenceScore,
                      riskScore: finalResult.riskScore,
                      explanation: finalResult.explanation,
                      aadhaarDetails: aadhaarResult,
                      faceDetails: faceResult,
                      voiceDetails: voiceResult
                    })}
                    className="bg-emerald-500 text-black font-bold px-12 py-4 rounded-2xl hover:bg-emerald-400 transition-all flex items-center justify-center gap-2 flex-1"
                  >
                    <Download className="w-5 h-5" /> Download Report
                  </button>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
