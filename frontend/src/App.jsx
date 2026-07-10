import React, { useState, useEffect, useRef } from 'react';
import {
  Upload, Play, Pause, RotateCcw, Mail, FileText,
  CheckCircle2, AlertTriangle, Eye, Code, Terminal,
  HelpCircle, Layers, Hourglass, ShieldCheck
} from 'lucide-react';

const BACKEND_URL = 'http://localhost:5000';

function App() {
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [activeTab, setActiveTab] = useState('edit'); // 'edit' or 'preview'

  const [stats, setStats] = useState({
    status: 'idle',
    total: 0,
    sent: 0,
    remaining: 0,
    errors: 0,
    logs: []
  });
  const [connectionStatus, setConnectionStatus] = useState('disconnected');

  const fileInputRef = useRef(null);
  const logsEndRef = useRef(null);

  // Setup EventSource for SSE status updates
  useEffect(() => {
    let eventSource = null;

    const connectSSE = () => {
      setConnectionStatus('connecting');
      eventSource = new EventSource(`${BACKEND_URL}/status/events`);

      eventSource.onopen = () => {
        setConnectionStatus('connected');
        setUploadError(null);
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setStats(data);
        } catch (err) {
          console.error('Error parsing SSE data:', err);
        }
      };

      eventSource.onerror = (err) => {
        console.error('SSE Error:', err);
        setConnectionStatus('disconnected');
        eventSource.close();
        // Retry connection in 3 seconds
        setTimeout(connectSSE, 3000);
      };
    };

    connectSSE();

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, []);

  // Auto-scroll logs to bottom when new logs arrive
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [stats.logs]);

  // Handle CSV file upload
  const handleFileUpload = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv')) {
      setUploadError('Invalid format. Please select a CSV file.');
      return;
    }

    setFile(selectedFile);
    setUploadError(null);
    setIsUploading(true);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await fetch(`${BACKEND_URL}/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to upload contacts');
      }

      // Upload succeeds, stats will update automatically via SSE
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  // Start campaign
  const handleStart = async () => {
    if (!subject.trim() || !body.trim()) {
      alert('Please fill out both Subject and Body.');
      return;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, body })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to start sending');
      }
    } catch (err) {
      alert(`Error starting sender: ${err.message}`);
    }
  };

  // Pause campaign
  const handlePause = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/pause`, {
        method: 'POST'
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to pause sending');
      }
    } catch (err) {
      alert(`Error pausing sender: ${err.message}`);
    }
  };

  // Reset campaign state
  const handleReset = async () => {
    if (!confirm('Are you sure you want to clear campaign progress? This resets counters, uploads, and sent history.')) {
      return;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/reset`, {
        method: 'POST'
      });

      if (response.ok) {
        setFile(null);
        setSubject('');
        setBody('');
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Reset failed');
      }
    } catch (err) {
      alert(`Error resetting: ${err.message}`);
    }
  };

  const getProgressPercentage = () => {
    if (stats.total === 0) return 0;
    return Math.round((stats.sent / stats.total) * 100);
  };

  const isSending = stats.status === 'sending';
  const isPaused = stats.status === 'paused';
  const isCompleted = stats.status === 'completed';

  return (
    <div className="min-h-screen bg-[#070b15] text-[#e2e8f0] pb-12 font-sans selection:bg-cyan-500/20 selection:text-cyan-300">

      {/* Glow Effects Background */}
      <div className="absolute top-0 left-1/4 w-[400px] h-[400px] bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-[30vh] right-1/4 w-[350px] h-[350px] bg-violet-600/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Header */}
      <header className="border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-tr from-cyan-400 to-violet-500 p-2 rounded-xl shadow-lg shadow-cyan-500/10">
              <Mail className="h-6 w-6 text-slate-950 stroke-[2]" />
            </div>
            <div>
              <h1 className="text-xl font-display font-bold tracking-tight text-white m-0 leading-none">
                Aether<span className="text-cyan-400">Mail</span>
              </h1>
              <p className="text-xs text-slate-400 m-0 mt-1">High-Performance Mass Mail Engine</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <span className="flex items-center text-xs space-x-2 bg-slate-900 px-3 py-1.5 rounded-full border border-slate-800">
              <span className={`h-2.5 w-2.5 rounded-full ${connectionStatus === 'connected' ? 'bg-emerald-500 shadow-md shadow-emerald-500/50' :
                connectionStatus === 'connecting' ? 'bg-amber-500 animate-pulse' : 'bg-red-500'
                }`} />
              <span className="text-slate-300 capitalize font-medium">{connectionStatus}</span>
            </span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-6 mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* Left Form Column (Lg: 7 cols) */}
        <section className="lg:col-span-7 space-y-6">

          {/* File Upload Card */}
          <div className="bg-slate-900/40 border border-slate-800/75 rounded-2xl p-6 backdrop-blur-md relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <h2 className="text-lg font-display font-semibold text-white mb-4 flex items-center space-x-2">
              <Layers className="h-5 w-5 text-cyan-400" />
              <span>Contact Directory</span>
            </h2>

            <div
              onClick={() => !isSending && fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer ${isSending ? 'border-slate-800 bg-slate-950/20 cursor-not-allowed opacity-50' :
                file ? 'border-cyan-500/40 bg-cyan-950/5' : 'border-slate-800 hover:border-slate-700 bg-slate-950/40'
                }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".csv"
                className="hidden"
                disabled={isSending}
              />

              {isUploading ? (
                <div className="space-y-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400 mx-auto" />
                  <p className="text-sm text-cyan-300">Reading records and analyzing structure...</p>
                </div>
              ) : file ? (
                <div className="space-y-2">
                  <CheckCircle2 className="h-8 w-8 text-cyan-400 mx-auto" />
                  <p className="text-sm font-semibold text-white">{file.name}</p>
                  <p className="text-xs text-slate-400">
                    {(file.size / 1024).toFixed(1)} KB • {stats.total.toLocaleString()} records detected
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 bg-slate-900 rounded-lg w-fit mx-auto border border-slate-850">
                    <Upload className="h-6 w-6 text-slate-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-200">Click to upload CSV spreadsheet</p>
                    <p className="text-xs text-slate-500 mt-1">First column must contain the email address</p>
                  </div>
                </div>
              )}
            </div>

            {uploadError && (
              <div className="mt-4 flex items-center space-x-2 bg-red-950/20 border border-red-900/30 text-red-400 p-3.5 rounded-lg text-xs">
                <AlertTriangle className="h-4.5 w-4.5 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}
          </div>

          {/* Email Template Composer */}
          <div className="bg-slate-900/40 border border-slate-800/75 rounded-2xl p-6 backdrop-blur-md relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-violet-500/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-display font-semibold text-white flex items-center space-x-2">
                <FileText className="h-5 w-5 text-violet-400" />
                <span>Campaign Blueprint</span>
              </h2>

              <div className="flex bg-slate-950 border border-slate-800 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setActiveTab('edit')}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeTab === 'edit'
                    ? 'bg-slate-900 text-cyan-400 border border-slate-850 shadow-inner'
                    : 'text-slate-400 hover:text-slate-200'
                    }`}
                >
                  <Code className="h-3.5 w-3.5" />
                  <span>HTML Source</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('preview')}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeTab === 'preview'
                    ? 'bg-slate-900 text-cyan-400 border border-slate-850 shadow-inner'
                    : 'text-slate-400 hover:text-slate-200'
                    }`}
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span>Live Render</span>
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Subject Header</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  disabled={isSending}
                  placeholder="e.g. Launch Update: Introducing AetherMail v2.0"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30 transition-all text-white placeholder-slate-655"
                />
              </div>

              {activeTab === 'edit' ? (
                <div>
                  <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">HTML Newsletter Template</label>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    disabled={isSending}
                    placeholder="<div><h1>Welcome Aboard!</h1><p>Thank you for signing up.</p></div>"
                    rows="12"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30 transition-all text-slate-300 placeholder-slate-655 resize-none"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">HTML Visualized Preview</label>
                  <div className="w-full min-h-[296px] max-h-[400px] overflow-y-auto bg-slate-950 border border-slate-800 rounded-xl p-4 text-slate-300 text-sm">
                    {body.trim() ? (
                      <div dangerouslySetInnerHTML={{ __html: body }} />
                    ) : (
                      <div className="flex flex-col items-center justify-center min-h-[260px] text-slate-500 space-y-2">
                        <Eye className="h-8 w-8 opacity-30" />
                        <p className="text-xs">Preview will render here once HTML is written</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Right Dashboard Column (Lg: 5 cols) */}
        <section className="lg:col-span-5 space-y-6">

          {/* Controls & Progress */}
          <div className="bg-slate-900/40 border border-slate-800/75 rounded-2xl p-6 backdrop-blur-md">

            {/* Play/Pause control center */}
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-display font-semibold text-white flex items-center space-x-2">
                <Hourglass className="h-5 w-5 text-cyan-400" />
                <span>Active Campaign State</span>
              </h2>

              <div className="flex items-center space-x-1">
                <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-widest ${isSending ? 'bg-cyan-950 border border-cyan-800 text-cyan-300' :
                  isPaused ? 'bg-amber-950 border border-amber-800 text-amber-300' :
                    isCompleted ? 'bg-emerald-950 border border-emerald-800 text-emerald-300' :
                      'bg-slate-950 border border-slate-800 text-slate-400'
                  }`}>
                  {stats.status}
                </span>
              </div>
            </div>

            {/* Progress metrics */}
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-400 mb-1.5">
                  <span>Batch Sending Status</span>
                  <span className="text-cyan-400 font-mono">{getProgressPercentage()}% Complete</span>
                </div>

                {/* Progress bar container */}
                <div className="h-3 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-850 p-0.5">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-violet-500 rounded-full transition-all duration-500 ease-out relative"
                    style={{ width: `${getProgressPercentage()}%` }}
                  >
                    <div className="absolute right-0 top-0 w-2 h-full bg-white opacity-40 blur-[1px] animate-pulse" />
                  </div>
                </div>
              </div>

              {/* Counters Grid */}
              <div className="grid grid-cols-2 gap-4 mt-6">
                <div className="bg-slate-950/60 border border-slate-850 p-3.5 rounded-xl text-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Targets</p>
                  <p className="text-xl font-display font-semibold text-white mt-1 font-mono">
                    {stats.total.toLocaleString()}
                  </p>
                </div>

                <div className="bg-slate-950/60 border border-slate-850 p-3.5 rounded-xl text-center relative overflow-hidden group">
                  <div className="absolute bottom-0 left-0 w-full h-[2px] bg-cyan-500/20" />
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sent</p>
                  <p className="text-xl font-display font-semibold text-cyan-400 mt-1 font-mono">
                    {stats.sent.toLocaleString()}
                  </p>
                </div>

                <div className="bg-slate-950/60 border border-slate-850 p-3.5 rounded-xl text-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Remaining</p>
                  <p className="text-xl font-display font-semibold text-slate-300 mt-1 font-mono">
                    {stats.remaining.toLocaleString()}
                  </p>
                </div>

                <div className="bg-slate-950/60 border border-slate-850 p-3.5 rounded-xl text-center relative overflow-hidden">
                  <div className="absolute bottom-0 left-0 w-full h-[2px] bg-rose-500/20" />
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-sans">Errors</p>
                  <p className="text-xl font-display font-semibold text-rose-400 mt-1 font-mono">
                    {stats.errors.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Controls buttons */}
              <div className="flex space-x-3 mt-6 pt-2">
                {!isSending ? (
                  <button
                    onClick={handleStart}
                    disabled={stats.total === 0 || !subject.trim() || !body.trim()}
                    className="flex-1 bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-cyan-300 disabled:from-slate-850 disabled:to-slate-850 disabled:text-slate-550 text-slate-950 font-semibold py-3 px-4 rounded-xl shadow-lg shadow-cyan-500/10 flex items-center justify-center space-x-2 transition-all cursor-pointer disabled:cursor-not-allowed transform hover:-translate-y-0.5 active:translate-y-0"
                  >
                    <Play className="h-4.5 w-4.5 fill-current" />
                    <span>{isPaused ? 'Resume Sending' : 'Launch Campaign'}</span>
                  </button>
                ) : (
                  <button
                    onClick={handlePause}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center space-x-2 transition-all cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0"
                  >
                    <Pause className="h-4.5 w-4.5 fill-current" />
                    <span>Pause Stream</span>
                  </button>
                )}

                <button
                  onClick={handleReset}
                  className="bg-slate-950 border border-slate-800 hover:bg-slate-900 text-slate-400 hover:text-white p-3 rounded-xl transition-all cursor-pointer"
                  title="Clear Campaign History"
                >
                  <RotateCcw className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Logs Console Card */}
          <div className="bg-slate-900/40 border border-slate-800/75 rounded-2xl p-6 backdrop-blur-md">
            <h2 className="text-lg font-display font-semibold text-white mb-4 flex items-center space-x-2">
              <Terminal className="h-5 w-5 text-cyan-400" />
              <span>Real-Time Output Stream</span>
            </h2>

            <div className="w-full h-64 bg-slate-950 border border-slate-850 rounded-xl p-4 font-mono text-xs overflow-y-auto space-y-2 select-text">
              {stats.logs.length === 0 ? (
                <div className="text-slate-600 italic h-full flex items-center justify-center text-center">
                  Terminal standby. Start campaign to view output stream.
                </div>
              ) : (
                stats.logs.map((log) => {
                  let textClass = 'text-slate-400';
                  if (log.message.includes('[Batch Success]')) textClass = 'text-emerald-400';
                  if (log.message.includes('[Sending]')) textClass = 'text-cyan-400';
                  if (log.message.includes('[Error]') || log.message.includes('[Batch Error]')) textClass = 'text-rose-400';
                  if (log.message.includes('[System]')) textClass = 'text-amber-400 font-bold';

                  return (
                    <div key={log.id} className="flex space-x-2 leading-relaxed">
                      <span className="text-slate-600 select-none">{log.timestamp}</span>
                      <span className={textClass}>{log.message}</span>
                    </div>
                  );
                })
              )}
              <div ref={logsEndRef} />
            </div>

            <div className="flex items-center justify-between mt-3 text-[10px] text-slate-500 font-mono">
              <span className="flex items-center space-x-1">
                <ShieldCheck className="h-3.5 w-3.5 text-cyan-500/80" />
                <span>Direct State: fs.createReadStream backed</span>
              </span>
              <span>Rate Limit: 1s Delay / 1k chunk</span>
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}

export default App;
