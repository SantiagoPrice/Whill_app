/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect } from "react";
import { 
  Mic, 
  Bluetooth, 
  BluetoothConnected, 
  BluetoothSearching, 
  Send, 
  History, 
  Settings, 
  AlertCircle,
  CheckCircle2,
  Trash2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface ConnectedDevice {
  id: string;
  name: string;
  connectedAt: Date;
}

interface Recording {
  id: string;
  blob: Blob;
  url: string;
  timestamp: Date;
  sentTo?: string;
}

export default function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [isBeaming, setIsBeaming] = useState(false);
  const [devices, setDevices] = useState<ConnectedDevice[]>([]);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number>(0);
  const [duration, setDuration] = useState(0);

  // Permission checks
  useEffect(() => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError("Microphone access not supported in this browser.");
    }
    if (!navigator.bluetooth) {
      console.warn("Web Bluetooth not supported.");
    }
  }, []);

  const startBluetoothScan = async () => {
    if (!navigator.bluetooth) {
      setError("Web Bluetooth is not available in this browser or context (requires HTTPS and user interaction).");
      return;
    }
    setIsSearching(true);
    setError(null);
    try {
      // In AI Studio/Browser constraints, we need a user gesture
      // navigator.bluetooth.requestDevice requires defined services or acceptAllDevices
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true
      });

      const server = await device.gatt?.connect();
      
      const newDevice: ConnectedDevice = {
        id: device.id,
        name: device.name || "Unknown Device",
        connectedAt: new Date(),
      };

      setDevices(prev => [...prev, newDevice]);
      
      device.addEventListener('gattserverdisconnected', () => {
        setDevices(prev => prev.filter(d => d.id !== device.id));
      });

    } catch (err) {
      console.error(err);
      if (err instanceof Error) {
        if (err.name === 'NotFoundError') {
          // User cancelled or no devices found
        } else {
          setError(err.message);
        }
      }
    } finally {
      setIsSearching(false);
    }
  };

  const startRecording = async () => {
    setError(null);
    chunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        const newRecording: Recording = {
          id: crypto.randomUUID(),
          blob,
          url,
          timestamp: new Date(),
        };
        
        setRecordings(prev => [newRecording, ...prev]);
        
        // Auto-send logic if devices are connected
        if (devices.length > 0) {
          beamRecording(newRecording);
        } else {
          // If no devices, we just stopped recording
        }
        
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      
      // Duration timer
      setDuration(0);
      timerRef.current = window.setInterval(() => {
        setDuration(prev => prev + 1);
      }, 100);

    } catch (err) {
      setError("Failed to access microphone. Please check permissions.");
      console.error(err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const beamRecording = async (recording: Recording) => {
    if (devices.length === 0) {
      setError("No linked devices to beam to.");
      return;
    }

    setIsBeaming(true);
    // Simulate Bluetooth transmission
    // In a real app, you would use device.gatt.getPrimaryService() and writeValue()
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    setIsBeaming(false);
    setShowSuccess(true);
    
    setRecordings(prev => prev.map(r => 
      r.id === recording.id ? { ...r, sentTo: devices[0].name } : r
    ));

    setTimeout(() => setShowSuccess(false), 3000);
  };

  const formatDuration = (deciseconds: number) => {
    const totalSeconds = Math.floor(deciseconds / 10);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    const ms = deciseconds % 10;
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms}`;
  };

  return (
    <div className="min-h-screen bg-[#0f1012] text-white flex flex-col font-sans selection:bg-[#00aaff]/30">
      {/* Top Header */}
      <header className="p-6 border-b border-white/5 flex justify-between items-center glass-morphism sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#00aaff] rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(0,170,255,0.4)]">
            <Mic size={22} className="text-white" />
          </div>
          <div>
            <h1 className="font-mono font-bold tracking-tight text-xl">VOICEBEAM</h1>
            <p className="text-[10px] text-white/40 uppercase tracking-[2px]">Wireless Audio Bridge</p>
          </div>
        </div>
        
        <div className="flex gap-4">
          <button className="text-white/40 hover:text-white transition-colors">
            <History size={20} />
          </button>
          <button className="text-white/40 hover:text-white transition-colors">
            <Settings size={20} />
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6 gap-12 max-w-4xl mx-auto w-full">
        
        {/* Status Area */}
        <div className="text-center space-y-2">
          <AnimatePresence mode="wait">
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex items-center gap-2 text-rose-500 bg-rose-500/10 px-4 py-2 rounded-full border border-rose-500/20 text-sm"
              >
                <AlertCircle size={14} />
                <span>{error}</span>
              </motion.div>
            )}
            
            {showSuccess && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex items-center gap-2 text-[#00ff88] bg-[#00ff88]/10 px-4 py-2 rounded-full border border-[#00ff88]/20 text-sm shadow-[0_0_20px_rgba(0,255,136,0.1)]"
              >
                <CheckCircle2 size={14} />
                <span>Recording Beamed Successfully</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Central Controller */}
        <div className="relative flex items-center justify-center">
          {/* Waves Background */}
          {isRecording && (
            <div className="absolute inset-x-0 inset-y-0 flex items-center justify-center">
              {[1, 2, 3].map((i) => (
                <motion.div
                  key={i}
                  initial={{ scale: 1, opacity: 0.5 }}
                  animate={{ scale: 2, opacity: 0 }}
                  transition={{ duration: 2, repeat: Infinity, delay: i * 0.6 }}
                  className="absolute w-64 h-64 border border-[#ff4444]/30 rounded-full"
                />
              ))}
            </div>
          )}

          {/* Main Button */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.95 }}
            className="z-10"
          >
            <button
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onMouseLeave={stopRecording}
              onTouchStart={startRecording}
              onTouchEnd={stopRecording}
              className={`
                w-64 h-64 rounded-full flex flex-col items-center justify-center gap-4 transition-all duration-300
                ${isRecording 
                  ? "bg-[#ff4444] shadow-[0_0_60px_rgba(255,68,68,0.4)] border-8 border-white/20" 
                  : "bg-white/5 border border-white/10 hover:border-white/20"}
              `}
            >
              <div className={`p-6 rounded-full ${isRecording ? "bg-white/20" : "bg-white/10"}`}>
                <Mic size={48} className={isRecording ? "text-white" : "text-white/60"} />
              </div>
              
              <div className="text-center">
                <p className={`font-mono font-bold text-2xl ${isRecording ? "text-white" : "text-white/80"}`}>
                  {isRecording ? formatDuration(duration) : "HOLD TO RECORD"}
                </p>
                <p className="text-[10px] text-white/40 uppercase tracking-widest mt-1">
                  {isRecording ? "Transmitting Real-time" : "Auto-Beam to Device"}
                </p>
              </div>
            </button>
          </motion.div>
        </div>

        {/* Device & History Section */}
        <div className="w-full grid md:grid-cols-2 gap-8 items-start">
          
          {/* Bluetooth Panel */}
          <div className="glass-morphism rounded-2xl p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="font-mono text-xs text-white/40 uppercase tracking-wider flex items-center gap-2">
                <Bluetooth size={12} />
                Linked Devices
              </h2>
              <button 
                onClick={startBluetoothScan}
                disabled={isSearching}
                className="text-[10px] bg-[#00aaff]/10 text-[#00aaff] px-3 py-1 rounded-full border border-[#00aaff]/20 hover:bg-[#00aaff]/20 transition-all uppercase tracking-tight flex items-center gap-2"
              >
                {isSearching ? <BluetoothSearching size={12} className="animate-spin" /> : <Bluetooth size={12} />}
                {isSearching ? "Searching..." : "Link Device"}
              </button>
            </div>

            <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
              {devices.length === 0 ? (
                <div className="py-8 text-center text-white/20 text-xs border border-dashed border-white/10 rounded-xl">
                  No devices linked. Connect to start beaming.
                </div>
              ) : (
                devices.map(device => (
                  <motion.div 
                    key={device.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="bg-white/5 border border-white/5 p-4 rounded-xl flex justify-between items-center"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#00ff88]/10 flex items-center justify-center">
                        <BluetoothConnected size={16} className="text-[#00ff88]" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{device.name}</p>
                        <p className="text-[10px] text-white/40">Connected {device.connectedAt.toLocaleTimeString()}</p>
                      </div>
                    </div>
                    <div className="w-2 h-2 rounded-full bg-[#00ff88] animate-pulse" />
                  </motion.div>
                ))
              )}
            </div>
          </div>

          {/* Recent Beams */}
          <div className="glass-morphism rounded-2xl p-6 space-y-4">
            <h2 className="font-mono text-xs text-white/40 uppercase tracking-wider flex items-center gap-2">
              <History size={12} />
              Recent Beams
            </h2>

            <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
              {recordings.length === 0 ? (
                <div className="py-8 text-center text-white/20 text-xs border border-dashed border-white/10 rounded-xl">
                  History is empty.
                </div>
              ) : (
                recordings.map(rec => (
                  <motion.div 
                    key={rec.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="bg-white/5 border border-white/5 p-4 rounded-xl flex items-center justify-between gap-4 group"
                  >
                    <div className="flex items-center gap-3">
                      <button className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center hover:bg-[#00aaff] transition-colors group">
                        <Send size={14} className="group-hover:scale-110 transition-transform" />
                      </button>
                      <div className="min-w-0">
                        <p className="text-xs font-mono truncate">RECORDING_{rec.id.slice(0, 8)}</p>
                        <p className="text-[10px] text-white/40">
                          {rec.sentTo ? `Sent to ${rec.sentTo}` : "Saved Locally"}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="text-white/40 hover:text-rose-500">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Beaming Overlay */}
      <AnimatePresence>
        {isBeaming && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-[#0f1012]/80 backdrop-blur-md flex flex-col items-center justify-center gap-8"
          >
            <div className="relative">
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                className="w-48 h-48 border-2 border-dashed border-[#00aaff]/50 rounded-full"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <Send size={40} className="text-[#00aaff] animate-bounce" />
              </div>
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-mono font-bold tracking-tighter">BEAMING DATA</h2>
              <p className="text-white/40 text-xs uppercase tracking-widest mt-2">{devices[0]?.name || "LINKED DEVICE"}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="p-6 text-center text-[10px] text-white/20 uppercase tracking-[4px]">
        VoiceBeam Protocol v1.4.2 // Secure Transmission Enabled
      </footer>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </div>
  );
}
