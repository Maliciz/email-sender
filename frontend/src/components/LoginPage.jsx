import React, { useState } from 'react';
import {
  Mail, Lock, User, Eye, EyeOff, ShieldCheck, Sun, Moon, ArrowRight, Loader2
} from 'lucide-react';
import {
  TextField, Button, Alert, Tooltip, InputAdornment, IconButton
} from '@mui/material';

export default function LoginPage({
  onLoginSuccess,
  isDark = true,
  setThemeMode,
  backendUrl = 'http://localhost:5000'
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setErrorMsg('Please enter both username and password.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const response = await fetch(`${backendUrl}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password: password.trim()
        })
      });

      const data = await response.json();

      if (response.ok && data.success && data.token) {
        onLoginSuccess(data.token, data.user);
      } else {
        setErrorMsg(data.error || 'Invalid credentials. Please try again.');
      }
    } catch (err) {
      console.error('Login request error:', err);
      setErrorMsg('Unable to connect to authentication server. Please ensure backend is running.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`min-h-screen flex flex-col justify-between p-4 sm:p-6 transition-colors duration-300 ${
      isDark ? 'dark-mode bg-black text-white' : 'light-mode bg-white text-black'
    }`}>
      {/* Top Header Bar with Theme Toggle */}
      <header className="max-w-7xl w-full mx-auto flex items-center justify-between py-2">
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-xl border ${
            isDark ? 'bg-zinc-900 border-zinc-700 text-white' : 'bg-black text-white border-black shadow-[0_0_8px_rgba(0,0,0,0.5)]'
          }`}>
            <Mail className="h-5 w-5 stroke-[2.5]" />
          </div>
          <span className="font-display font-bold tracking-tight text-lg">
            SEND<span className={isDark ? 'text-zinc-400' : 'text-zinc-700'}>GRID</span>
          </span>
        </div>

        <Tooltip title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}>
          <Button
            onClick={() => setThemeMode(isDark ? 'light' : 'dark')}
            variant="outlined"
            sx={{
              minWidth: '40px',
              width: '40px',
              height: '40px',
              p: 0,
              color: isDark ? '#ffffff' : '#000000',
              borderColor: isDark ? '#27272a' : '#000000',
            }}
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </Tooltip>
      </header>

      {/* Main Login Card Area */}
      <main className="flex-1 flex items-center justify-center py-8">
        <div className={`w-full max-w-md rounded-2xl glass-panel p-6 sm:p-8 transition-all ${
          isDark ? 'bg-zinc-950/80 border-zinc-800' : 'bg-white border-black shadow-[0_0_15px_rgba(0,0,0,0.25)]'
        }`}>
          {/* Header & Logo Badge */}
          <div className="text-center space-y-3 mb-6 sm:mb-8">
            <div className="inline-flex items-center justify-center p-3.5 rounded-2xl border mb-2 bg-gradient-to-b from-zinc-800 to-zinc-950 border-zinc-700 text-white shadow-lg">
              <ShieldCheck className="h-7 w-7 text-emerald-400" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold tracking-tight">
              Admin Portal
            </h1>
            <p className="text-xs sm:text-sm font-mono opacity-70">
              Sign in to manage campaigns, senders & dispatch contacts
            </p>
          </div>

          {/* Error Alert Message */}
          {errorMsg && (
            <Alert
              severity="error"
              onClose={() => setErrorMsg('')}
              className="mb-6"
              sx={{
                borderRadius: '10px',
                fontSize: '0.825rem',
                fontWeight: 600
              }}
            >
              {errorMsg}
            </Alert>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5 font-mono opacity-80">
                Username
              </label>
              <TextField
                fullWidth
                variant="outlined"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                autoComplete="username"
                disabled={isSubmitting}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <User className={`h-4 w-4 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`} />
                      </InputAdornment>
                    ),
                  }
                }}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5 font-mono opacity-80">
                Password
              </label>
              <TextField
                fullWidth
                type={showPassword ? 'text' : 'password'}
                variant="outlined"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                disabled={isSubmitting}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <Lock className={`h-4 w-4 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`} />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          size="small"
                          onClick={() => setShowPassword(!showPassword)}
                          edge="end"
                        >
                          {showPassword ? (
                            <EyeOff className={`h-4 w-4 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`} />
                          ) : (
                            <Eye className={`h-4 w-4 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`} />
                          )}
                        </IconButton>
                      </InputAdornment>
                    )
                  }
                }}
              />
            </div>

            <Button
              type="submit"
              fullWidth
              disabled={isSubmitting}
              size="large"
              sx={{
                mt: 1,
                py: 1.5,
                bgcolor: isDark ? '#ffffff' : '#000000',
                color: isDark ? '#000000' : '#ffffff',
                fontWeight: 700,
                fontSize: '0.9rem',
                borderRadius: '10px',
                '&:hover': {
                  bgcolor: isDark ? '#e4e4e7' : '#27272a',
                }
              }}
            >
              {isSubmitting ? (
                <div className="flex items-center space-x-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Authenticating...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center space-x-2">
                  <span>Sign In</span>
                  <ArrowRight className="h-4 w-4" />
                </div>
              )}
            </Button>
          </form>
        </div>
      </main>

      {/* Footer Credentials Info */}
      <footer className="text-center py-4">
        <p className="text-xs font-mono opacity-50">
          Default Admin Login: <span className="underline font-semibold">admin</span> / <span className="underline font-semibold">3617</span>
        </p>
      </footer>
    </div>
  );
}
