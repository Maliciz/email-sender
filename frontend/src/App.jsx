import React, { useState, useEffect, useRef } from 'react';
import {
  Upload, Play, Pause, RotateCcw, Mail, FileText,
  CheckCircle2, AlertTriangle, Eye, Code, Terminal,
  Layers, Hourglass, ShieldCheck
} from 'lucide-react';
import { createTheme, ThemeProvider, styled } from '@mui/material/styles';
import {
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Snackbar,
  Alert,
  Tabs,
  Tab,
  LinearProgress,
  CircularProgress,
  Tooltip,
  Box
} from '@mui/material';

const BACKEND_URL = 'http://localhost:5000';

// Custom MUI Crimson Dark Theme
const darkCrimsonTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#ef4444', // Scarlet red
      light: '#f87171',
      dark: '#b91c1c',
    },
    secondary: {
      main: '#991b1b', // Crimson red
    },
    background: {
      default: '#05070c',
      paper: '#090d16',
    },
    text: {
      primary: '#f3f4f6',
      secondary: '#94a3b8',
    },
  },
  typography: {
    fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
    button: {
      fontWeight: 600,
      textTransform: 'none',
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '12px',
          padding: '10px 20px',
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0 0 15px rgba(239, 68, 68, 0.2)',
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: '12px',
            backgroundColor: 'rgba(5, 7, 12, 0.65)',
            '& fieldset': {
              borderColor: 'rgba(239, 68, 68, 0.15)',
              transition: 'border-color 0.2s ease-in-out',
            },
            '&:hover fieldset': {
              borderColor: 'rgba(239, 68, 68, 0.35)',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#ef4444',
              boxShadow: '0 0 10px rgba(239, 68, 68, 0.15)',
            },
          },
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          fontFamily: "'Outfit', sans-serif",
          fontWeight: 600,
          textTransform: 'none',
          fontSize: '0.85rem',
          minHeight: '40px',
          padding: '6px 16px',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: '#090d16',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          borderRadius: '16px',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)',
        },
      },
    },
  },
});

// Styled Glowing Progress Bar
const GlowingLinearProgress = styled(LinearProgress)(() => ({
  height: 10,
  borderRadius: 5,
  backgroundColor: 'rgba(5, 7, 12, 0.8)',
  border: '1px solid rgba(239, 68, 68, 0.12)',
  '& .MuiLinearProgress-bar': {
    borderRadius: 5,
    background: 'linear-gradient(90deg, #991b1b 0%, #ef4444 100%)',
    boxShadow: '0 0 8px rgba(239, 68, 68, 0.3)',
  },
}));

function App() {
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [activeTab, setActiveTab] = useState(0); // 0 = edit, 1 = preview

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

  // Dialog & Toast states
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [toast, setToast] = useState({ open: false, message: '', severity: 'info' });

  const showToast = (message, severity = 'info') => {
    setToast({ open: true, message, severity });
  };

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

  // Handle CSV/TXT file upload
  const handleFileUpload = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    const ext = selectedFile.name.split('.').pop().toLowerCase();
    if (ext !== 'csv' && ext !== 'txt') {
      setUploadError('Invalid format. Please select a CSV or TXT file.');
      showToast('Invalid format. Please select a CSV or TXT file.', 'error');
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
      showToast(`Successfully loaded directory. Detected ${data.count} contacts.`, 'success');
    } catch (err) {
      setUploadError(err.message);
      showToast(err.message, 'error');
    } finally {
      setIsUploading(false);
    }
  };

  // Start campaign
  const handleStart = async () => {
    if (!subject.trim() || !body.trim()) {
      showToast('Please fill out both Subject and Body.', 'warning');
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
      showToast('Campaign launched successfully!', 'success');
    } catch (err) {
      showToast(`Error starting sender: ${err.message}`, 'error');
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
      showToast('Campaign transmission paused.', 'info');
    } catch (err) {
      showToast(`Error pausing sender: ${err.message}`, 'error');
    }
  };

  // Reset campaign state
  const handleResetConfirm = async () => {
    setResetDialogOpen(false);
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
        showToast('Campaign status and loaded contacts reset completely.', 'success');
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Reset failed');
      }
    } catch (err) {
      showToast(`Error resetting: ${err.message}`, 'error');
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
    <ThemeProvider theme={darkCrimsonTheme}>
      <div className="min-h-screen bg-[#05070c] text-[#e2e8f0] pb-12 font-sans selection:bg-red-500/20 selection:text-red-300 relative overflow-x-hidden">

        {/* Deep Crimson Ambient Glow Blobs */}
        <div className="absolute top-0 left-1/4 w-[450px] h-[450px] bg-red-950/10 rounded-full blur-[140px] pointer-events-none animate-crimson-pulse-slow" />
        <div className="absolute top-[40vh] right-1/4 w-[350px] h-[350px] bg-red-900/5 rounded-full blur-[120px] pointer-events-none" />

        {/* Top Navbar */}
        <header className="border-b border-red-950/50 bg-[#090d16]/80 backdrop-blur-md sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-tr from-red-600 to-red-800 p-2.5 rounded-xl shadow-lg shadow-red-500/10 border border-red-500/25">
                <Mail className="h-5 w-5 text-white stroke-[2]" />
              </div>
              <div>
                <h1 className="text-xl font-display font-bold tracking-tight text-white m-0 leading-none">
                  SPAMER<span className="text-red-500">Tool</span>
                </h1>
                <p className="text-[10px] text-slate-400 font-mono tracking-wider m-0 mt-1 uppercase">Mass Email Command</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <span className="flex items-center text-xs space-x-2 bg-[#05070c] px-3.5 py-1.5 rounded-full border border-red-950/80">
                <span className={`h-2 w-2 rounded-full ${connectionStatus === 'connected' ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' :
                  connectionStatus === 'connecting' ? 'bg-amber-500 animate-pulse' : 'bg-red-500 animate-ping'
                  }`} />
                <span className="text-slate-300 capitalize font-mono font-semibold tracking-wide">{connectionStatus}</span>
              </span>
            </div>
          </div>
        </header>

        {/* Dashboard Grid Container */}
        <main className="max-w-7xl mx-auto px-6 mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* Left panel: File selection & Subject/Body template (Lg: 7 cols) */}
          <section className="lg:col-span-7 space-y-6">

            {/* File Upload card */}
            <div className="glass-panel rounded-2xl p-6 relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-red-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              <h2 className="text-md font-display font-semibold text-white mb-4 flex items-center space-x-2.5">
                <Layers className="h-4.5 w-4.5 text-red-500" />
                <span>Contact Directory Source</span>
              </h2>

              <div
                onClick={() => !isSending && fileInputRef.current?.click()}
                className={`border border-dashed rounded-xl p-6 text-center transition-all cursor-pointer ${isSending ? 'border-red-950/40 bg-slate-950/20 cursor-not-allowed opacity-50' :
                  file ? 'border-red-500/40 bg-red-950/5 hover:bg-red-950/10' : 'border-red-950 hover:border-red-900/60 bg-red-950/5 hover:bg-red-950/10'
                  }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".csv,.txt"
                  className="hidden"
                  disabled={isSending}
                />

                {isUploading ? (
                  <div className="space-y-3 py-2">
                    <CircularProgress size={32} color="primary" />
                    <p className="text-xs text-red-400 font-mono animate-pulse">Converting and indexing records...</p>
                  </div>
                ) : file ? (
                  <div className="space-y-2">
                    <CheckCircle2 className="h-7 w-7 text-red-500 mx-auto" />
                    <p className="text-xs font-semibold text-white">{file.name}</p>
                    <p className="text-[11px] text-slate-400 font-mono">
                      {(file.size / 1024).toFixed(1)} KB • {stats.total.toLocaleString()} records detected
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="p-2.5 bg-[#05070c] rounded-lg w-fit mx-auto border border-red-950">
                      <Upload className="h-5 w-5 text-red-400" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-200">Click to upload CSV or TXT file</p>
                      <p className="text-[10px] text-slate-500 mt-1.5 font-mono">
                        CSV: First column for emails | TXT: One email per line
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {uploadError && (
                <div className="mt-4 flex items-center space-x-2 bg-red-950/20 border border-red-900/20 text-red-400 p-3 rounded-lg text-xs font-mono">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}
            </div>

            {/* Campaign blueprint editor card */}
            <div className="glass-panel rounded-2xl p-6 relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-red-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              <div className="flex justify-between items-center mb-5">
                <h2 className="text-md font-display font-semibold text-white flex items-center space-x-2.5">
                  <FileText className="h-4.5 w-4.5 text-red-500" />
                  <span>Broadcast Blueprint</span>
                </h2>

                <Box sx={{ borderBottom: 1, borderColor: 'rgba(239, 68, 68, 0.1)' }}>
                  <Tabs
                    value={activeTab}
                    onChange={(e, val) => setActiveTab(val)}
                    textColor="primary"
                    indicatorColor="primary"
                    sx={{ minHeight: '36px' }}
                  >
                    <Tab label="Edit HTML" icon={<Code className="h-3.5 w-3.5" />} iconPosition="start" sx={{ minHeight: '36px' }} />
                    <Tab label="Live Render" icon={<Eye className="h-3.5 w-3.5" />} iconPosition="start" sx={{ minHeight: '36px' }} />
                  </Tabs>
                </Box>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 font-mono">Subject Line</label>
                  <TextField
                    fullWidth
                    variant="outlined"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    disabled={isSending}
                    placeholder="e.g. System alert: Database failover completed"
                    slotProps={{
                      input: {
                        style: { fontSize: '0.85rem' }
                      }
                    }}
                  />
                </div>

                {activeTab === 0 ? (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 font-mono">HTML Body Template</label>
                    <TextField
                      fullWidth
                      multiline
                      rows={10}
                      variant="outlined"
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      disabled={isSending}
                      placeholder="<div><h1>Welcome!</h1><p>Html elements are allowed here.</p></div>"
                      slotProps={{
                        input: {
                          style: {
                            fontFamily: 'monospace',
                            fontSize: '0.8rem',
                            color: '#cbd5e1'
                          }
                        }
                      }}
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 font-mono">HTML Visualized Preview</label>
                    <div className="w-full min-h-[268px] max-h-[350px] overflow-y-auto bg-slate-950/60 border border-red-950/40 rounded-xl p-4 text-slate-300 text-sm">
                      {body.trim() ? (
                        <div dangerouslySetInnerHTML={{ __html: body }} />
                      ) : (
                        <div className="flex flex-col items-center justify-center min-h-[220px] text-slate-500 space-y-2">
                          <Eye className="h-7 w-7 opacity-20" />
                          <p className="text-xs font-mono">HTML preview is empty</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Right panel: Active state control & Real-time Console (Lg: 5 cols) */}
          <section className="lg:col-span-5 space-y-6">

            {/* Campaign state card */}
            <div className="glass-panel rounded-2xl p-6">

              <div className="flex justify-between items-center mb-5">
                <h2 className="text-md font-display font-semibold text-white flex items-center space-x-2.5">
                  <Hourglass className="h-4.5 w-4.5 text-red-500" />
                  <span>State Controller</span>
                </h2>

                <span className={`px-2 py-0.5 rounded text-[9px] uppercase font-bold tracking-widest border ${isSending ? 'bg-red-950/60 border-red-800 text-red-400 shadow-[0_0_6px_rgba(239,68,68,0.2)]' :
                  isPaused ? 'bg-amber-950/60 border-amber-800 text-amber-400' :
                    isCompleted ? 'bg-emerald-950/60 border-emerald-800 text-emerald-400' :
                      'bg-slate-950/60 border-slate-800 text-slate-400'
                  }`}>
                  {stats.status}
                </span>
              </div>

              {/* Progress and numbers */}
              <div className="space-y-5">
                <div>
                  <div className="flex justify-between text-xs font-semibold text-slate-400 mb-2 font-mono">
                    <span>Broadcast Progress</span>
                    <span className="text-red-400">{getProgressPercentage()}%</span>
                  </div>

                  <GlowingLinearProgress variant="determinate" value={getProgressPercentage()} />
                </div>

                {/* Grid stats */}
                <div className="grid grid-cols-2 gap-4 font-mono">
                  <div className="bg-[#05070c]/70 border border-red-950/40 p-3 rounded-xl text-center">
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider font-mono">Total Contacts</p>
                    <p className="text-lg font-display font-semibold text-white mt-0.5 font-mono">
                      {stats.total.toLocaleString()}
                    </p>
                  </div>

                  <div className="bg-[#05070c]/70 border border-red-950/40 p-3 rounded-xl text-center relative overflow-hidden group">
                    <div className="absolute bottom-0 left-0 w-full h-[1.5px] bg-red-600/40" />
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider font-mono">Sent</p>
                    <p className="text-lg font-display font-semibold text-red-400 mt-0.5 font-mono">
                      {stats.sent.toLocaleString()}
                    </p>
                  </div>

                  <div className="bg-[#05070c]/70 border border-red-950/40 p-3 rounded-xl text-center">
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider font-mono">Remaining</p>
                    <p className="text-lg font-display font-semibold text-slate-300 mt-0.5 font-mono">
                      {stats.remaining.toLocaleString()}
                    </p>
                  </div>

                  <div className="bg-[#05070c]/70 border border-red-950/40 p-3 rounded-xl text-center relative overflow-hidden">
                    <div className="absolute bottom-0 left-0 w-full h-[1.5px] bg-red-900/60" />
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider font-mono">Errors</p>
                    <p className="text-lg font-display font-semibold text-rose-550 mt-0.5 font-mono">
                      {stats.errors.toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Control Action Buttons */}
                <div className="flex space-x-3 mt-4 pt-1">
                  {!isSending ? (
                    <Button
                      variant="contained"
                      color="primary"
                      fullWidth
                      onClick={handleStart}
                      disabled={stats.total === 0 || !subject.trim() || !body.trim()}
                      startIcon={<Play className="h-4 w-4 fill-current" />}
                      sx={{
                        background: 'linear-gradient(90deg, #991b1b 0%, #ef4444 100%)',
                        color: 'white',
                        '&:hover': {
                          background: 'linear-gradient(90deg, #b91c1c 0%, #f87171 100%)',
                        },
                      }}
                    >
                      <span>{isPaused ? 'Resume Sending' : 'Launch Campaign'}</span>
                    </Button>
                  ) : (
                    <Button
                      variant="outlined"
                      color="primary"
                      fullWidth
                      onClick={handlePause}
                      startIcon={<Pause className="h-4 w-4 fill-current" />}
                    >
                      <span>Pause Campaign</span>
                    </Button>
                  )}

                  <Tooltip title="Clear and Reset Campaign State" arrow>
                    <Button
                      variant="outlined"
                      color="error"
                      sx={{ minWidth: '48px', width: '48px', p: 0, borderColor: 'rgba(239, 68, 68, 0.2)' }}
                      onClick={() => setResetDialogOpen(true)}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  </Tooltip>
                </div>
              </div>
            </div>

            {/* Real-time output stream */}
            <div className="glass-panel rounded-2xl p-6">
              <h2 className="text-md font-display font-semibold text-white mb-4 flex items-center space-x-2.5">
                <Terminal className="h-4.5 w-4.5 text-red-500" />
                <span>Transmission Log Console</span>
              </h2>

              <div className="w-full h-60 bg-slate-950/80 border border-red-950/30 rounded-xl p-4 font-mono text-[11px] overflow-y-auto space-y-2 select-text">
                {stats.logs.length === 0 ? (
                  <div className="text-slate-655 italic h-full flex items-center justify-center text-center">
                    Terminal offline. Launch campaign to stream output packets.
                  </div>
                ) : (
                  stats.logs.map((log) => {
                    let textClass = 'text-slate-400';
                    if (log.message.includes('[Batch Success]')) textClass = 'text-emerald-400';
                    if (log.message.includes('[Sending]')) textClass = 'text-red-400';
                    if (log.message.includes('[Error]') || log.message.includes('[Batch Error]')) textClass = 'text-red-655 font-bold';
                    if (log.message.includes('[System]')) textClass = 'text-amber-500 font-medium';

                    return (
                      <div key={log.id} className="flex space-x-2 leading-relaxed">
                        <span className="text-red-950 select-none">{log.timestamp}</span>
                        <span className={textClass}>{log.message}</span>
                      </div>
                    );
                  })
                )}
                <div ref={logsEndRef} />
              </div>

              <div className="flex items-center justify-between mt-3 text-[9px] text-slate-500 font-mono">
                <span className="flex items-center space-x-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-red-500/80" />
                  <span>Direct State Engine Active</span>
                </span>
                <span>Buffer: 1k contacts / batch</span>
              </div>
            </div>
          </section>

        </main>

        {/* Custom MUI Confirm Dialog for Campaign Reset */}
        <Dialog
          open={resetDialogOpen}
          onClose={() => setResetDialogOpen(false)}
          aria-labelledby="reset-dialog-title"
          aria-describedby="reset-dialog-description"
        >
          <DialogTitle id="reset-dialog-title" sx={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, color: 'white' }}>
            Confirm System Reset
          </DialogTitle>
          <DialogContent>
            <DialogContentText id="reset-dialog-description" sx={{ fontSize: '0.85rem', color: '#94a3b8' }}>
              Are you sure you want to completely clear the campaign status? This action will purge all statistics, uploaded files, and transmission histories permanently.
            </DialogContentText>
          </DialogContent>
          <DialogActions sx={{ p: 2.5, pt: 0 }}>
            <Button onClick={() => setResetDialogOpen(false)} sx={{ color: '#94a3b8' }}>
              Cancel
            </Button>
            <Button onClick={handleResetConfirm} variant="contained" color="error" autoFocus>
              Purge System
            </Button>
          </DialogActions>
        </Dialog>

        {/* Elegant Snackbar Alert system */}
        <Snackbar
          open={toast.open}
          autoHideDuration={4000}
          onClose={() => setToast({ ...toast, open: false })}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        >
          <Alert
            onClose={() => setToast({ ...toast, open: false })}
            severity={toast.severity}
            variant="filled"
            sx={{
              borderRadius: '12px',
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: '0.8rem',
              boxShadow: '0 4px 15px rgba(0, 0, 0, 0.4)',
              '&.MuiAlert-filledSuccess': { backgroundColor: '#10b981' },
              '&.MuiAlert-filledError': { backgroundColor: '#ef4444' },
            }}
          >
            {toast.message}
          </Alert>
        </Snackbar>

      </div>
    </ThemeProvider>
  );
}

export default App;
