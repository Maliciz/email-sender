import React, { useState, useEffect, useRef } from 'react';
import DocxEditor from './components/DocxEditor';
import LoginPage from './components/LoginPage';
import {
  Mail, Sun, Moon, Upload, Plus, Trash2, Play, Pause, RotateCcw,
  FileText, CheckCircle2, AlertTriangle, Eye, Code, Terminal,
  Database, Send, RefreshCw, Filter, X, ShieldCheck, Hourglass, Layers,
  Globe, Check, LogOut
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
  Box,
  Switch,
  FormControlLabel,
  Chip,
  Paper,
  InputAdornment,
  MenuItem,
  Select,
  FormControl,
  InputLabel
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';

const RAW_BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://email-sender-hbvi.onrender.com';
const BACKEND_URL = RAW_BACKEND_URL.replace(/\/+$/, '');

// Glowing Progress Bar
const GlowingLinearProgress = styled(LinearProgress)(({ theme }) => ({
  height: 10,
  borderRadius: 5,
  backgroundColor: theme.palette.mode === 'dark' ? '#18181b' : '#e4e4e7',
  border: theme.palette.mode === 'dark' ? '1px solid #27272a' : '1px solid #000000',
  '& .MuiLinearProgress-bar': {
    borderRadius: 5,
    backgroundColor: theme.palette.mode === 'dark' ? '#ffffff' : '#000000',
    boxShadow: theme.palette.mode === 'dark' ? '0 0 10px rgba(255, 255, 255, 0.4)' : '0 0 10px rgba(0, 0, 0, 0.5)',
  },
}));

function App() {
  // Authentication State
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('auth_token') || '');

  // Theme State: 'dark' or 'light'
  const [themeMode, setThemeMode] = useState('dark');

  // Navigation Tab State (0 = Campaign Dashboard, 1 = Database / Contacts, 2 = Senders & Domains)
  const [mainTab, setMainTab] = useState(0);

  // Senders & Domain Selection State
  const [senders, setSenders] = useState([]);
  const [selectedSenderEmail, setSelectedSenderEmail] = useState('');
  const [newSenderEmail, setNewSenderEmail] = useState('');
  const [newSenderDomain, setNewSenderDomain] = useState('');
  const [isAddingSender, setIsAddingSender] = useState(false);

  // Staging Area State
  const [stagedEmails, setStagedEmails] = useState([]);
  const [manualEmail, setManualEmail] = useState('');
  const [isDeploying, setIsDeploying] = useState(false);

  // Database Contacts State
  const [dbContacts, setDbContacts] = useState([]);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [errorsOnlyFilter, setErrorsOnlyFilter] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Campaign State
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [activeEditorTab, setActiveEditorTab] = useState(0); // 0 = edit HTML, 1 = live preview

  const [stats, setStats] = useState({
    status: 'idle',
    total: 0,
    sent: 0,
    remaining: 0,
    errors: 0,
    logs: []
  });
  const [connectionStatus, setConnectionStatus] = useState('disconnected');

  // References
  const fileInputRef = useRef(null);
  const logsEndRef = useRef(null);

  // Dialog & Toast states
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [toast, setToast] = useState({ open: false, message: '', severity: 'info' });

  const showToast = (message, severity = 'info') => {
    setToast({ open: true, message, severity });
  };

  // Login Success Handler
  const handleLoginSuccess = (token) => {
    localStorage.setItem('auth_token', token);
    setAuthToken(token);
    showToast('Authenticated successfully!', 'success');
  };

  // Logout Handler
  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    setAuthToken('');
    showToast('Logged out successfully', 'info');
  };

  // Build MUI Dynamic Theme
  const muiTheme = React.useMemo(() => {
    const isDark = themeMode === 'dark';
    return createTheme({
      palette: {
        mode: themeMode,
        primary: {
          main: isDark ? '#ffffff' : '#000000',
          contrastText: isDark ? '#000000' : '#ffffff',
        },
        background: {
          default: isDark ? '#000000' : '#ffffff',
          paper: isDark ? '#09090b' : '#ffffff',
        },
        text: {
          primary: isDark ? '#ffffff' : '#000000',
          secondary: isDark ? '#a1a1aa' : '#52525b',
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
              borderRadius: '8px',
              padding: '8px 18px',
              border: isDark ? '1px solid #27272a' : '1px solid #000000',
              boxShadow: isDark ? 'none' : '0 0 6px rgba(0,0,0,0.3)',
              '&:hover': {
                boxShadow: isDark ? '0 0 10px rgba(255, 255, 255, 0.2)' : '0 0 12px rgba(0, 0, 0, 0.6)',
                borderColor: isDark ? '#ffffff' : '#000000',
              },
            },
          },
        },
        MuiOutlinedInput: {
          styleOverrides: {
            root: {
              borderRadius: '8px',
              backgroundColor: isDark ? '#050505' : '#ffffff',
              border: isDark ? '1px solid #27272a' : '1px solid #000000',
              boxShadow: isDark ? 'none' : '0 0 6px rgba(0,0,0,0.25)',
              '& fieldset': {
                borderColor: 'transparent',
              },
              '&:hover fieldset': {
                borderColor: 'transparent',
              },
              '&.Mui-focused fieldset': {
                borderColor: 'transparent',
              },
              '&.Mui-focused': {
                borderColor: isDark ? '#ffffff' : '#000000',
                boxShadow: isDark ? '0 0 10px rgba(255, 255, 255, 0.2)' : '0 0 12px rgba(0, 0, 0, 0.65)',
              },
            },
          },
        },
        MuiSelect: {
          styleOverrides: {
            root: {
              borderRadius: '8px',
              backgroundColor: isDark ? '#050505' : '#ffffff',
              border: isDark ? '1px solid #27272a' : '1px solid #000000',
              boxShadow: isDark ? 'none' : '0 0 6px rgba(0,0,0,0.25)',
            }
          }
        },
        MuiDataGrid: {
          styleOverrides: {
            root: {
              border: isDark ? '1px solid #27272a' : '1px solid #000000',
              borderRadius: '12px',
              backgroundColor: isDark ? '#09090b' : '#ffffff',
              boxShadow: isDark ? 'none' : '0 0 8px rgba(0, 0, 0, 0.35)',
              color: isDark ? '#ffffff' : '#000000',
              '& .MuiDataGrid-cell': {
                borderColor: isDark ? '#27272a' : '#000000',
              },
              '& .MuiDataGrid-columnHeaders': {
                borderColor: isDark ? '#27272a' : '#000000',
                backgroundColor: isDark ? '#18181b' : '#f4f4f5',
                color: isDark ? '#ffffff' : '#000000',
                fontWeight: 700,
              },
              '& .MuiDataGrid-footerContainer': {
                borderColor: isDark ? '#27272a' : '#000000',
              },
            },
          },
        },
        MuiPaper: {
          styleOverrides: {
            root: {
              backgroundImage: 'none',
              backgroundColor: isDark ? '#09090b' : '#ffffff',
              border: isDark ? '1px solid #27272a' : '1px solid #000000',
              boxShadow: isDark ? '0 10px 30px rgba(0,0,0,0.8)' : '0 0 12px rgba(0, 0, 0, 0.4)',
            },
          },
        },
      },
    });
  }, [themeMode]);

  // SSE Real-time Status Connection
  useEffect(() => {
    if (!authToken) return;
    let eventSource = null;

    const connectSSE = () => {
      setConnectionStatus('connecting');
      eventSource = new EventSource(`${BACKEND_URL}/status/events`);

      eventSource.onopen = () => {
        setConnectionStatus('connected');
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setStats(data);
          if (data.currentSenderEmail && !selectedSenderEmail) {
            setSelectedSenderEmail(data.currentSenderEmail);
          }
        } catch (err) {
          console.error('Error parsing SSE event data:', err);
        }
      };

      eventSource.onerror = (err) => {
        console.error('SSE connection error:', err);
        setConnectionStatus('disconnected');
        eventSource.close();
        setTimeout(connectSSE, 3000);
      };
    };

    connectSSE();

    return () => {
      if (eventSource) eventSource.close();
    };
  }, [authToken]);

  // Fetch Database Contacts
  const fetchDbContacts = async () => {
    if (!authToken) return;
    setIsLoadingContacts(true);
    try {
      const response = await fetch(`${BACKEND_URL}/contacts`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setDbContacts(data.contacts || []);
      } else {
        throw new Error(data.error || 'Failed to load contacts');
      }
    } catch (err) {
      console.error('Fetch contacts error:', err);
      showToast(`Database error: ${err.message}`, 'error');
    } finally {
      setIsLoadingContacts(false);
    }
  };

  // Fetch Connected Sender Domains
  const fetchSenders = async () => {
    if (!authToken) return;
    try {
      const response = await fetch(`${BACKEND_URL}/senders`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const data = await response.json();
      if (response.ok && data.success) {
        const senderList = data.senders || [];
        setSenders(senderList);
        if (senderList.length > 0 && !selectedSenderEmail) {
          setSelectedSenderEmail(senderList[0].email_address);
        }
      }
    } catch (err) {
      console.error('Fetch senders error:', err);
    }
  };

  useEffect(() => {
    if (authToken) {
      fetchDbContacts();
      fetchSenders();
    }
  }, [authToken]);



  // Add New Sender Domain
  const handleAddSender = async (e) => {
    e.preventDefault();
    if (!newSenderEmail.trim() || !newSenderEmail.includes('@')) {
      showToast('Please enter a valid sender email address.', 'warning');
      return;
    }

    setIsAddingSender(true);
    try {
      const response = await fetch(`${BACKEND_URL}/senders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          email_address: newSenderEmail.trim(),
          domain_name: newSenderDomain.trim() || undefined
        })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to add sender domain');
      }

      showToast(`Sender domain ${data.sender.email_address} connected successfully!`, 'success');
      setNewSenderEmail('');
      setNewSenderDomain('');
      fetchSenders();
      setSelectedSenderEmail(data.sender.email_address);
    } catch (err) {
      showToast(`Error adding sender: ${err.message}`, 'error');
    } finally {
      setIsAddingSender(false);
    }
  };

  // Delete Sender Domain
  const handleDeleteSender = async (id, email) => {
    try {
      const response = await fetch(`${BACKEND_URL}/senders/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (response.ok) {
        showToast(`Removed sender ${email}`, 'info');
        fetchSenders();
        if (selectedSenderEmail === email) {
          setSelectedSenderEmail('');
        }
      }
    } catch (err) {
      showToast(`Failed to delete sender: ${err.message}`, 'error');
    }
  };

  // Client-Side File Parsing for Staging
  const handleFileStaging = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const ext = file.name.split('.').pop().toLowerCase();
    if (ext !== 'csv' && ext !== 'txt') {
      showToast('Unsupported file type. Please choose a CSV or TXT file.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target.result;
      const lines = content.split(/\r?\n/);
      const extractedEmails = [];

      for (let line of lines) {
        let trimmed = line.trim();
        if (!trimmed) continue;
        if (trimmed.toLowerCase() === 'email') continue;

        if (trimmed.includes(',')) {
          const parts = trimmed.split(',');
          for (const part of parts) {
            const cleanPart = part.trim().replace(/^["']|["']$/g, '');
            if (cleanPart.includes('@')) {
              trimmed = cleanPart;
              break;
            }
          }
        }

        trimmed = trimmed.replace(/^["']|["']$/g, '');
        if (trimmed && trimmed.includes('@')) {
          extractedEmails.push(trimmed);
        }
      }

      if (extractedEmails.length === 0) {
        showToast('No valid email addresses found in file.', 'warning');
      } else {
        setStagedEmails((prev) => {
          const newSet = new Set(prev);
          extractedEmails.forEach((email) => newSet.add(email));
          return Array.from(newSet);
        });
        showToast(`Staged ${extractedEmails.length} emails from ${file.name}.`, 'info');
      }

      if (fileInputRef.current) fileInputRef.current.value = '';
    };

    reader.readAsText(file);
  };

  // Add Manual Email
  const handleAddManualEmail = (e) => {
    e.preventDefault();
    const cleanEmail = manualEmail.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      showToast('Please enter a valid email address.', 'warning');
      return;
    }

    if (stagedEmails.includes(cleanEmail)) {
      showToast('Email is already in the staged list.', 'info');
      return;
    }

    setStagedEmails((prev) => [...prev, cleanEmail]);
    setManualEmail('');
    showToast(`Added ${cleanEmail} to staged queue.`, 'success');
  };

  // Remove Staged Email
  const handleRemoveStagedEmail = (emailToRemove) => {
    setStagedEmails((prev) => prev.filter((e) => e !== emailToRemove));
  };

  // Clear Staged List
  const handleClearStaged = () => {
    setStagedEmails([]);
  };

  // Deploy Staged Emails to Backend
  const handleDeployStagedEmails = async () => {
    if (stagedEmails.length === 0) {
      showToast('No emails staged for deployment.', 'warning');
      return;
    }

    setIsDeploying(true);
    try {
      const response = await fetch(`${BACKEND_URL}/deploy-contacts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ emails: stagedEmails })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to deploy contacts');
      }

      showToast(`Successfully deployed! ${data.insertedCount} new contacts inserted into DB.`, 'success');
      setStagedEmails([]);
      fetchDbContacts();
    } catch (err) {
      console.error('Deploy error:', err);
      showToast(`Deploy failed: ${err.message}`, 'error');
    } finally {
      setIsDeploying(false);
    }
  };

  // Start Campaign (Requires Selected Sender Email)
  const handleStartCampaign = async () => {
    if (!selectedSenderEmail) {
      showToast('Please select a Sender Email / Domain from the dropdown first.', 'warning');
      return;
    }

    if (!subject.trim() || !body.trim()) {
      showToast('Subject and Body template are required.', 'warning');
      return;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/start-mailing`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          senderEmail: selectedSenderEmail,
          subject,
          body
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to start campaign');
      }

      showToast(`Campaign started in background using ${selectedSenderEmail}!`, 'success');
    } catch (err) {
      showToast(`Error launching campaign: ${err.message}`, 'error');
    }
  };

  const handleResetConfirm = async () => {
    setResetDialogOpen(false);
    showToast('Reset action executed.', 'info');
  };

  const getProgressPercentage = () => {
    if (stats.total === 0) return 0;
    return Math.round((stats.sent / stats.total) * 100);
  };

  const filteredContacts = React.useMemo(() => {
    return dbContacts.filter((c) => {
      if (errorsOnlyFilter && c.status !== 'error') return false;
      if (searchQuery.trim()) {
        return c.email.toLowerCase().includes(searchQuery.toLowerCase());
      }
      return true;
    });
  }, [dbContacts, errorsOnlyFilter, searchQuery]);

  const columns = [
    { field: 'id', headerName: 'ID', width: 80 },
    { field: 'email', headerName: 'Email Address', flex: 1, minWidth: 220 },
    {
      field: 'status',
      headerName: 'Status',
      width: 140,
      renderCell: (params) => {
        const val = params.value;
        let color = 'default';
        if (val === 'sent') color = 'success';
        else if (val === 'error') color = 'error';
        else if (val === 'pending') color = 'warning';

        return (
          <Chip
            label={val ? val.toUpperCase() : 'PENDING'}
            color={color}
            size="small"
            sx={{ fontWeight: 700, fontSize: '0.65rem' }}
          />
        );
      }
    }
  ];

  const isSending = stats.status === 'sending';
  const isDark = themeMode === 'dark';

  // Render Login Page if Unauthenticated
  if (!authToken) {
    return (
      <ThemeProvider theme={muiTheme}>
        <LoginPage
          onLoginSuccess={handleLoginSuccess}
          isDark={isDark}
          setThemeMode={setThemeMode}
          backendUrl={BACKEND_URL}
        />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={muiTheme}>
      <div className={`min-h-screen pb-12 transition-colors duration-300 ${isDark ? 'dark-mode bg-black text-white' : 'light-mode bg-white text-black'}`}>

        {/* Top Navbar */}
        <header className={`border-b sticky top-0 z-50 backdrop-blur-md ${isDark ? 'bg-black/90 border-zinc-800' : 'bg-white/90 border-black'}`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            
            {/* Top Row on Mobile: Logo + Connection Status + Controls */}
            <div className="flex items-center justify-between w-full md:w-auto">
              <div className="flex items-center space-x-2.5 sm:space-x-3">
                <div className={`p-2 sm:p-2.5 rounded-xl border ${isDark ? 'bg-zinc-900 border-zinc-700 text-white' : 'bg-black text-white border-black shadow-[0_0_8px_rgba(0,0,0,0.5)]'}`}>
                  <Mail className="h-4 w-4 sm:h-5 sm:w-5 stroke-[2.5]" />
                </div>
                <div>
                  <h1 className="text-lg sm:text-xl font-display font-bold tracking-tight m-0 leading-none">
                    SEND<span className={isDark ? 'text-zinc-400' : 'text-zinc-700'}>GRID</span>
                  </h1>
                </div>
              </div>

              {/* Mobile Quick Action Buttons */}
              <div className="flex items-center space-x-2 md:hidden">
                <span className={`flex items-center text-[10px] sm:text-xs space-x-1.5 px-2.5 py-1 rounded-full border ${isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-black'}`}>
                  <span className={`h-2 w-2 rounded-full ${connectionStatus === 'connected' ? 'bg-emerald-500 shadow-[0_0_6px_#10b981]' : connectionStatus === 'connecting' ? 'bg-amber-500 animate-pulse' : 'bg-red-500'}`} />
                  <span className="font-mono capitalize">{connectionStatus}</span>
                </span>

                <Tooltip title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}>
                  <Button
                    onClick={() => setThemeMode(isDark ? 'light' : 'dark')}
                    variant="outlined"
                    sx={{ minWidth: '36px', width: '36px', height: '36px', p: 0 }}
                  >
                    {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                  </Button>
                </Tooltip>

                <Tooltip title="Sign Out">
                  <Button
                    onClick={handleLogout}
                    variant="outlined"
                    color="error"
                    sx={{ minWidth: '36px', width: '36px', height: '36px', p: 0 }}
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </Tooltip>
              </div>
            </div>

            {/* Navigation Tabs (Touch Scrollable on Mobile) */}
            <Box sx={{ borderBottom: 0, width: { xs: '100%', md: 'auto' }, overflowX: 'auto' }}>
              <Tabs
                value={mainTab}
                onChange={(e, val) => setMainTab(val)}
                textColor="primary"
                indicatorColor="primary"
                variant="scrollable"
                scrollButtons="auto"
                allowScrollButtonsMobile
                sx={{
                  '& .MuiTab-root': {
                    fontFamily: "'Outfit', sans-serif",
                    fontWeight: 700,
                    fontSize: { xs: '0.75rem', sm: '0.85rem' },
                    textTransform: 'none',
                    minHeight: '40px',
                    px: { xs: 1.5, sm: 2 },
                    color: isDark ? '#a1a1aa' : '#52525b',
                    '&.Mui-selected': {
                      color: isDark ? '#ffffff' : '#000000',
                    }
                  }
                }}
              >
                <Tab icon={<Terminal className="h-4 w-4" />} iconPosition="start" label="Campaign Dashboard" />
                <Tab icon={<Database className="h-4 w-4" />} iconPosition="start" label={`Contacts (${dbContacts.length})`} />
                <Tab icon={<Globe className="h-4 w-4" />} iconPosition="start" label={`Senders (${senders.length})`} />
              </Tabs>
            </Box>

            {/* Desktop Actions */}
            <div className="hidden md:flex items-center space-x-3">
              <span className={`flex items-center text-xs space-x-2 px-3 py-1.5 rounded-full border ${isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-black shadow-[0_0_6px_rgba(0,0,0,0.3)]'}`}>
                <span className={`h-2 w-2 rounded-full ${connectionStatus === 'connected' ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : connectionStatus === 'connecting' ? 'bg-amber-500 animate-pulse' : 'bg-red-500'}`} />
                <span className="font-mono font-semibold tracking-wide capitalize">{connectionStatus}</span>
              </span>

              <Tooltip title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}>
                <Button
                  onClick={() => setThemeMode(isDark ? 'light' : 'dark')}
                  variant="outlined"
                  sx={{ minWidth: '40px', width: '40px', height: '40px', p: 0 }}
                >
                  {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </Button>
              </Tooltip>

              <Tooltip title="Sign Out">
                <Button
                  onClick={handleLogout}
                  variant="outlined"
                  color="error"
                  startIcon={<LogOut className="h-4 w-4" />}
                  sx={{ fontSize: '0.8rem', px: 2 }}
                >
                  Logout
                </Button>
              </Tooltip>
            </div>
          </div>
        </header>

        {/* Main Application Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 mt-4 sm:mt-8">

          {/* TAB 0: CAMPAIGN DASHBOARD */}
          {mainTab === 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
              {/* Left Panel: Subject & Body Editor */}
              <section className="lg:col-span-7 space-y-6">
                <div className="glass-panel rounded-2xl p-4 sm:p-6 relative overflow-hidden">
                  <div className="flex justify-between items-center mb-5">
                    <h2 className="text-sm sm:text-md font-display font-semibold flex items-center space-x-2">
                      <FileText className="h-4.5 w-4.5" />
                      <span>Broadcast Content & Blueprint</span>
                    </h2>

                    <Tabs
                      value={activeEditorTab}
                      onChange={(e, val) => setActiveEditorTab(val)}
                      textColor="primary"
                      indicatorColor="primary"
                      sx={{ minHeight: '36px' }}
                    >
                      <Tab label="Edit HTML" icon={<Code className="h-3.5 w-3.5" />} iconPosition="start" sx={{ minHeight: '36px', fontSize: '0.75rem', px: 1 }} />
                      <Tab label="Live Render" icon={<Eye className="h-3.5 w-3.5" />} iconPosition="start" sx={{ minHeight: '36px', fontSize: '0.75rem', px: 1 }} />
                    </Tabs>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5 font-mono opacity-80">Subject Line</label>
                      <TextField
                        fullWidth
                        variant="outlined"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        disabled={isSending}
                        placeholder="e.g. System update notification"
                      />
                    </div>

                    {activeEditorTab === 0 ? (
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5 font-mono opacity-80">
                          Document Content & Rich Editor
                        </label>
                        <DocxEditor
                          value={body}
                          onChange={setBody}
                          isDark={isDark}
                          disabled={isSending}
                          showToast={showToast}
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5 font-mono opacity-80">Visualized Live Preview</label>
                        <div className={`w-full min-h-[285px] max-h-[360px] overflow-y-auto rounded-xl p-4 sm:p-5 border ${isDark ? 'bg-zinc-950 border-zinc-800 text-zinc-200' : 'bg-slate-50 border-black text-black shadow-[0_0_6px_rgba(0,0,0,0.2)]'}`}>
                          {body.trim() ? (
                            <div dangerouslySetInnerHTML={{ __html: body }} />
                          ) : (
                            <div className="flex flex-col items-center justify-center min-h-[240px] opacity-40 space-y-2">
                              <Eye className="h-8 w-8" />
                              <p className="text-xs font-mono">Template body is empty</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </section>

              {/* Right Panel: Sender Selector, Controls & Stream */}
              <section className="lg:col-span-5 space-y-6">
                {/* Sender Selection Component */}
                <div className="glass-panel rounded-2xl p-4 sm:p-6 space-y-4">
                  <div className="flex justify-between items-center">
                    <h2 className="text-sm sm:text-md font-display font-semibold flex items-center space-x-2">
                      <Globe className="h-4.5 w-4.5" />
                      <span>Sender Connection Selection</span>
                    </h2>
                    <Chip
                      label={senders.length > 0 ? `${senders.length} Available` : 'No Senders'}
                      color={senders.length > 0 ? 'success' : 'error'}
                      size="small"
                      sx={{ fontWeight: 700, fontSize: '0.65rem' }}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5 font-mono opacity-80">
                      Select Authenticated Sender Email *
                    </label>
                    <FormControl fullWidth size="small">
                      <Select
                        value={selectedSenderEmail}
                        onChange={(e) => setSelectedSenderEmail(e.target.value)}
                        disabled={isSending || senders.length === 0}
                        displayEmpty
                        sx={{ fontSize: '0.85rem' }}
                      >
                        <MenuItem value="" disabled>
                          <em>-- Select Sender Domain Email --</em>
                        </MenuItem>
                        {senders.map((s) => (
                          <MenuItem key={s.id} value={s.email_address}>
                            <div className="flex justify-between items-center w-full">
                              <span className="font-semibold text-xs sm:text-sm">{s.email_address}</span>
                              <span className="text-[10px] opacity-60 font-mono hidden sm:inline">({s.domain_name})</span>
                            </div>
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    {senders.length === 0 && (
                      <p className="text-xs text-amber-500 mt-1 font-mono">
                        No senders found. Please go to the "Senders" tab to add one.
                      </p>
                    )}
                  </div>
                </div>

                {/* State Controller Card */}
                <div className="glass-panel rounded-2xl p-4 sm:p-6">
                  <div className="flex justify-between items-center mb-5">
                    <h2 className="text-sm sm:text-md font-display font-semibold flex items-center space-x-2">
                      <Hourglass className="h-4.5 w-4.5" />
                      <span>Campaign Controller</span>
                    </h2>

                    <Chip
                      label={stats.status.toUpperCase()}
                      color={isSending ? 'primary' : stats.status === 'completed' ? 'success' : 'default'}
                      size="small"
                      sx={{ fontWeight: 700, fontSize: '0.65rem' }}
                    />
                  </div>

                  <div className="space-y-5">
                    <div>
                      <div className="flex justify-between text-xs font-semibold mb-2 font-mono">
                        <span>Transmission Progress</span>
                        <span>{getProgressPercentage()}%</span>
                      </div>
                      <GlowingLinearProgress variant="determinate" value={getProgressPercentage()} />
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 font-mono">
                      <div className={`p-2.5 sm:p-3 rounded-xl text-center border ${isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-black shadow-[0_0_4px_rgba(0,0,0,0.2)]'}`}>
                        <p className="text-[9px] font-bold uppercase tracking-wider opacity-70">Total</p>
                        <p className="text-md sm:text-lg font-bold mt-0.5">{stats.total.toLocaleString()}</p>
                      </div>

                      <div className={`p-2.5 sm:p-3 rounded-xl text-center border ${isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-black shadow-[0_0_4px_rgba(0,0,0,0.2)]'}`}>
                        <p className="text-[9px] font-bold uppercase tracking-wider opacity-70">Sent</p>
                        <p className="text-md sm:text-lg font-bold mt-0.5">{stats.sent.toLocaleString()}</p>
                      </div>

                      <div className={`p-2.5 sm:p-3 rounded-xl text-center border ${isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-black shadow-[0_0_4px_rgba(0,0,0,0.2)]'}`}>
                        <p className="text-[9px] font-bold uppercase tracking-wider opacity-70">Pending</p>
                        <p className="text-md sm:text-lg font-bold mt-0.5">{stats.remaining.toLocaleString()}</p>
                      </div>

                      <div className={`p-2.5 sm:p-3 rounded-xl text-center border ${isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-black shadow-[0_0_4px_rgba(0,0,0,0.2)]'}`}>
                        <p className="text-[9px] font-bold uppercase tracking-wider opacity-70">Errors</p>
                        <p className="text-md sm:text-lg font-bold mt-0.5 text-red-500">{stats.errors.toLocaleString()}</p>
                      </div>
                    </div>

                    <div className="flex space-x-3 pt-2">
                      <Button
                        variant="contained"
                        fullWidth
                        onClick={handleStartCampaign}
                        disabled={isSending || !selectedSenderEmail || !subject.trim() || !body.trim()}
                        startIcon={<Play className="h-4 w-4" />}
                      >
                        Launch Mailing
                      </Button>

                      <Tooltip title="Reset Campaign State">
                        <Button
                          variant="outlined"
                          onClick={() => setResetDialogOpen(true)}
                          sx={{ minWidth: '44px', width: '44px', p: 0 }}
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      </Tooltip>
                    </div>
                  </div>
                </div>

                {/* Stream Log Console */}
                <div className="glass-panel rounded-2xl p-4 sm:p-6">
                  <h2 className="text-sm sm:text-md font-display font-semibold mb-4 flex items-center space-x-2">
                    <Terminal className="h-4.5 w-4.5" />
                    <span>Real-time Stream Log</span>
                  </h2>

                  <div className={`w-full h-48 sm:h-56 rounded-xl p-3 sm:p-4 font-mono text-[10px] sm:text-[11px] overflow-y-auto space-y-2 border ${isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-900 text-zinc-100 border-black shadow-[0_0_6px_rgba(0,0,0,0.3)]'}`}>
                    {stats.logs.length === 0 ? (
                      <div className="opacity-40 italic h-full flex items-center justify-center text-center">
                        No active logs. Launch campaign to stream output.
                      </div>
                    ) : (
                      stats.logs.map((log) => (
                        <div key={log.id} className="flex space-x-2">
                          <span className="opacity-50 select-none">{log.timestamp}</span>
                          <span>{log.message}</span>
                        </div>
                      ))
                    )}
                    <div ref={logsEndRef} />
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* TAB 1: DATABASE & CONTACTS STAGING */}
          {mainTab === 1 && (
            <div className="space-y-6 sm:space-y-8">
              {/* Staging Area Card */}
              <div className="glass-panel rounded-2xl p-4 sm:p-6 space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b pb-4 border-zinc-800">
                  <div>
                    <h2 className="text-md sm:text-lg font-display font-bold flex items-center space-x-2">
                      <Layers className="h-5 w-5" />
                      <span>Contact Staging Area</span>
                    </h2>
                    <p className="text-xs opacity-70 mt-1">
                      Upload files or add emails manually. Items are parsed client-side before deploying to PostgreSQL.
                    </p>
                  </div>

                  {stagedEmails.length > 0 && (
                    <Button
                      variant="contained"
                      onClick={handleDeployStagedEmails}
                      disabled={isDeploying}
                      startIcon={isDeploying ? <CircularProgress size={16} color="inherit" /> : <Send className="h-4 w-4" />}
                      sx={{
                        backgroundColor: isDark ? '#ffffff' : '#000000',
                        color: isDark ? '#000000' : '#ffffff',
                        fontWeight: 700,
                        px: 3,
                        width: { xs: '100%', sm: 'auto' }
                      }}
                    >
                      {isDeploying ? 'Deploying...' : `Deploy ${stagedEmails.length} Email(s)`}
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider mb-2 font-mono opacity-80">
                      1. Upload CSV / TXT File
                    </label>
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-xl p-4 sm:p-5 text-center cursor-pointer transition-all ${isDark ? 'border-zinc-800 hover:border-zinc-500 bg-zinc-950/50' : 'border-black hover:bg-zinc-50 bg-white shadow-[0_0_6px_rgba(0,0,0,0.2)]'
                        }`}
                    >
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileStaging}
                        accept=".csv,.txt"
                        className="hidden"
                      />
                      <Upload className="h-6 w-6 mx-auto mb-2 opacity-80" />
                      <p className="text-xs font-semibold">Click to parse CSV or TXT file</p>
                      <p className="text-[10px] opacity-60 mt-1 font-mono">Extracted emails will be added to Staging List below</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider mb-2 font-mono opacity-80">
                      2. Add Single Email Manually
                    </label>
                    <form onSubmit={handleAddManualEmail} className="flex flex-col sm:flex-row gap-2">
                      <TextField
                        fullWidth
                        placeholder="user@example.com"
                        value={manualEmail}
                        onChange={(e) => setManualEmail(e.target.value)}
                        size="small"
                      />
                      <Button
                        type="submit"
                        variant="outlined"
                        startIcon={<Plus className="h-4 w-4" />}
                        sx={{ whiteSpace: 'nowrap' }}
                      >
                        Add
                      </Button>
                    </form>
                  </div>
                </div>

                {stagedEmails.length > 0 ? (
                  <div className="pt-2">
                    <div className="flex justify-between items-center mb-3 font-mono">
                      <span className="text-xs font-bold">
                        Staged Queue ({stagedEmails.length} contacts pending deploy)
                      </span>
                      <Button
                        size="small"
                        color="error"
                        onClick={handleClearStaged}
                        startIcon={<Trash2 className="h-3.5 w-3.5" />}
                        sx={{ fontSize: '0.75rem', p: '2px 8px' }}
                      >
                        Clear Staged List
                      </Button>
                    </div>

                    <div className={`max-h-48 overflow-y-auto p-3 rounded-xl border flex flex-wrap gap-2 ${isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-slate-50 border-black shadow-[0_0_4px_rgba(0,0,0,0.2)]'}`}>
                      {stagedEmails.map((email, idx) => (
                        <Chip
                          key={idx}
                          label={email}
                          onDelete={() => handleRemoveStagedEmail(email)}
                          deleteIcon={<X className="h-3 w-3" />}
                          size="small"
                          variant="outlined"
                          sx={{
                            borderColor: isDark ? '#3f3f46' : '#000000',
                            color: isDark ? '#ffffff' : '#000000',
                            fontWeight: 500,
                            fontSize: '0.75rem'
                          }}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4 opacity-50 border border-dashed rounded-xl text-xs font-mono">
                    No emails in staging queue. Select a file or enter an email above to stage.
                  </div>
                )}
              </div>

              {/* Database Contacts Table */}
              <div className="glass-panel rounded-2xl p-4 sm:p-6 space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4 border-zinc-800">
                  <div>
                    <h2 className="text-md sm:text-lg font-display font-bold flex items-center space-x-2">
                      <Database className="h-5 w-5" />
                      <span>PostgreSQL Database Contacts</span>
                    </h2>
                    <p className="text-xs opacity-70 mt-1">
                      Real-time records stored in PostgreSQL database.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-between md:justify-end">
                    <FormControlLabel
                      control={
                        <Switch
                          checked={errorsOnlyFilter}
                          onChange={(e) => setErrorsOnlyFilter(e.target.checked)}
                          color="error"
                          size="small"
                        />
                      }
                      label={
                        <span className="text-[11px] sm:text-xs font-bold font-mono">
                          Show Errors Only
                        </span>
                      }
                    />

                    <Button
                      variant="outlined"
                      size="small"
                      onClick={fetchDbContacts}
                      disabled={isLoadingContacts}
                      startIcon={<RefreshCw className={`h-3.5 w-3.5 ${isLoadingContacts ? 'animate-spin' : ''}`} />}
                    >
                      Refresh
                    </Button>
                  </div>
                </div>

                <div className="max-w-md w-full">
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Filter by email address..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    slotProps={{
                      input: {
                        startAdornment: (
                          <InputAdornment position="start">
                            <Filter className="h-4 w-4 opacity-50" />
                          </InputAdornment>
                        ),
                      }
                    }}
                  />
                </div>

                <div className="w-full overflow-x-auto rounded-xl border border-zinc-800">
                  <div style={{ height: 420, minWidth: 500, width: '100%' }}>
                    <DataGrid
                      rows={filteredContacts}
                      columns={columns}
                      loading={isLoadingContacts}
                      pageSizeOptions={[10, 25, 50, 100]}
                      initialState={{
                        pagination: { paginationModel: { pageSize: 10 } },
                      }}
                      disableRowSelectionOnClick
                      sx={{
                        border: 'none',
                        '& .MuiDataGrid-cell': {
                          fontSize: '0.85rem',
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SENDERS & DOMAIN MANAGEMENT */}
          {mainTab === 2 && (
            <div className="space-y-6 sm:space-y-8">
              {/* Add Sender Domain Form */}
              <div className="glass-panel rounded-2xl p-4 sm:p-6 space-y-6">
                <div className="border-b pb-4 border-zinc-800">
                  <h2 className="text-md sm:text-lg font-display font-bold flex items-center space-x-2">
                    <Globe className="h-5 w-5" />
                    <span>Domain & Sender Connection Management</span>
                  </h2>
                  <p className="text-xs opacity-70 mt-1">
                    Connect authenticated SendGrid sender emails and domain names to use in your email campaigns.
                  </p>
                </div>

                <form onSubmit={handleAddSender} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                  <div className="md:col-span-5">
                    <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 font-mono opacity-80">
                      Sender Email Address *
                    </label>
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="hello@yourdomain.com"
                      value={newSenderEmail}
                      onChange={(e) => setNewSenderEmail(e.target.value)}
                      required
                    />
                  </div>

                  <div className="md:col-span-4">
                    <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 font-mono opacity-80">
                      Domain Name (Optional)
                    </label>
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="yourdomain.com"
                      value={newSenderDomain}
                      onChange={(e) => setNewSenderDomain(e.target.value)}
                    />
                  </div>

                  <div className="md:col-span-3">
                    <Button
                      type="submit"
                      variant="contained"
                      fullWidth
                      disabled={isAddingSender}
                      startIcon={isAddingSender ? <CircularProgress size={16} color="inherit" /> : <Plus className="h-4 w-4" />}
                      sx={{
                        backgroundColor: isDark ? '#ffffff' : '#000000',
                        color: isDark ? '#000000' : '#ffffff',
                        fontWeight: 700,
                        py: '7px'
                      }}
                    >
                      Connect Domain
                    </Button>
                  </div>
                </form>
              </div>

              {/* Senders Table / List */}
              <div className="glass-panel rounded-2xl p-4 sm:p-6 space-y-4">
                <h3 className="text-md font-display font-bold flex items-center space-x-2">
                  <ShieldCheck className="h-4.5 w-4.5" />
                  <span>Connected Sender Domains ({senders.length})</span>
                </h3>

                {senders.length === 0 ? (
                  <div className="text-center py-8 opacity-50 border border-dashed rounded-xl text-xs font-mono">
                    No sender domains connected yet. Add a sender email above.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                    {senders.map((s) => (
                      <div
                        key={s.id}
                        className={`p-4 rounded-xl border flex flex-col justify-between space-y-3 transition-all ${selectedSenderEmail === s.email_address
                          ? (isDark ? 'border-white bg-zinc-900/80 shadow-[0_0_10px_rgba(255,255,255,0.1)]' : 'border-black bg-zinc-50 shadow-[0_0_8px_rgba(0,0,0,0.3)]')
                          : (isDark ? 'border-zinc-800 bg-zinc-950/50' : 'border-zinc-300 bg-white')
                          }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-bold text-sm">{s.email_address}</p>
                            <p className="text-xs font-mono opacity-60 mt-0.5">{s.domain_name}</p>
                          </div>
                          <Chip
                            label="VERIFIED"
                            color="success"
                            size="small"
                            sx={{ fontWeight: 700, fontSize: '0.65rem' }}
                          />
                        </div>

                        <div className="flex justify-between items-center pt-2 border-t border-zinc-800">
                          {selectedSenderEmail === s.email_address ? (
                            <span className="text-xs font-bold flex items-center space-x-1 font-mono text-emerald-500">
                              <Check className="h-3.5 w-3.5" />
                              <span>Active Selection</span>
                            </span>
                          ) : (
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => setSelectedSenderEmail(s.email_address)}
                              sx={{ fontSize: '0.7rem', py: '2px', px: '8px' }}
                            >
                              Select as Active
                            </Button>
                          )}

                          <Button
                            size="small"
                            color="error"
                            onClick={() => handleDeleteSender(s.id, s.email_address)}
                            sx={{ minWidth: '32px', width: '32px', p: 0 }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

        </main>

        {/* Reset Dialog */}
        <Dialog open={resetDialogOpen} onClose={() => setResetDialogOpen(false)}>
          <DialogTitle sx={{ fontWeight: 700 }}>Confirm System Reset</DialogTitle>
          <DialogContent>
            <DialogContentText sx={{ fontSize: '0.85rem' }}>
              Are you sure you want to reset the campaign progress?
            </DialogContentText>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setResetDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleResetConfirm} color="error" variant="contained">Reset</Button>
          </DialogActions>
        </Dialog>

        {/* Toast Snackbar */}
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
            sx={{ borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600 }}
          >
            {toast.message}
          </Alert>
        </Snackbar>

      </div>
    </ThemeProvider>
  );
}

export default App;
