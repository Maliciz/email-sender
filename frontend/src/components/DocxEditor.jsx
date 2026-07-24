import React, { useState, useRef, useEffect } from 'react';
import mammoth from 'mammoth';
import {
  Upload, Bold, Italic, Underline, List, ListOrdered, Quote,
  Link as LinkIcon, RemoveFormatting, Trash2, Copy, Code, Eye,
  Heading1, Heading2, Heading3, Check, Loader2, FileText, Sparkles
} from 'lucide-react';
import {
  Tooltip, Button, Select, MenuItem, FormControl, InputLabel
} from '@mui/material';

/**
 * Utility to clean Word-specific dirty inline CSS and markup
 */
function cleanWordHtml(rawHtml) {
  if (!rawHtml) return '';
  let cleaned = rawHtml;
  // Remove MS Word comments and metadata
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');
  cleaned = cleaned.replace(/<\/?(meta|link|style|xml|title|o:[^>]+|w:[^>]+|m:[^>]+)[^>]*>/gi, '');
  // Strip Mso classes and inline mso styles
  cleaned = cleaned.replace(/\s*class="[^"]*Mso[^"]*"/gi, '');
  cleaned = cleaned.replace(/\s*style="[^"]*mso-[^"]*"/gi, '');
  // Strip span tags without attributes or empty spans
  cleaned = cleaned.replace(/<span\s*>([\s\S]*?)<\/span>/gi, '$1');
  cleaned = cleaned.replace(/<span[^>]*><\/span>/gi, '');
  return cleaned.trim();
}

export default function DocxEditor({
  value = '',
  onChange,
  isDark = true,
  disabled = false,
  showToast = () => {}
}) {
  const [editorMode, setEditorMode] = useState('visual'); // 'visual' | 'code'
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const fileInputRef = useRef(null);
  const editorRef = useRef(null);

  // Sync external value changes to contenteditable innerHTML when in visual mode
  useEffect(() => {
    if (editorRef.current && editorMode === 'visual') {
      if (editorRef.current.innerHTML !== value) {
        editorRef.current.innerHTML = value || '';
      }
    }
  }, [value, editorMode]);

  // Execute formatting command on contenteditable element
  const execCmd = (command, val = null) => {
    if (disabled || editorMode !== 'visual') return;
    document.execCommand(command, false, val);
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  // Handle DOCX file parsing client-side with mammoth
  const handleDocxFile = async (file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext !== 'docx') {
      showToast('Invalid format. Please upload a valid Word .docx file.', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.convertToHtml({ arrayBuffer });
      const cleanedHtml = cleanWordHtml(result.value);
      
      onChange(cleanedHtml);
      if (editorRef.current && editorMode === 'visual') {
        editorRef.current.innerHTML = cleanedHtml;
      }
      showToast(`Document "${file.name}" imported successfully!`, 'success');
    } catch (err) {
      console.error('Error parsing DOCX:', err);
      showToast(`Failed to parse DOCX: ${err.message}`, 'error');
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Drag and Drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (disabled) return;

    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      handleDocxFile(files[0]);
    }
  };

  // Paste handler: cleans dirty Word styles from clipboard
  const handlePaste = (e) => {
    e.preventDefault();
    if (disabled) return;

    const html = e.clipboardData.getData('text/html');
    const text = e.clipboardData.getData('text/plain');

    if (html) {
      const cleaned = cleanWordHtml(html);
      document.execCommand('insertHTML', false, cleaned);
    } else if (text) {
      document.execCommand('insertText', false, text);
    }

    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  // Copy to Clipboard
  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setIsCopied(true);
      showToast('Editor content copied to clipboard!', 'info');
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      showToast('Failed to copy text', 'error');
    }
  };

  // Clear Editor Content
  const handleClearEditor = () => {
    onChange('');
    if (editorRef.current) {
      editorRef.current.innerHTML = '';
    }
    showToast('Editor cleared', 'info');
  };

  // Prompt insert link
  const handleAddLink = () => {
    const url = prompt('Enter URL link:', 'https://');
    if (url) {
      execCmd('createLink', url);
    }
  };

  return (
    <div className="space-y-4">
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => e.target.files?.[0] && handleDocxFile(e.target.files[0])}
        accept=".docx"
        className="hidden"
      />

      {/* Top Action Bar & Drag-and-Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragEnter={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-xl p-4 transition-all duration-200 ${
          isDragging
            ? isDark ? 'border-white bg-zinc-900/80 scale-[1.01]' : 'border-black bg-slate-100 scale-[1.01]'
            : isDark ? 'border-zinc-800 bg-zinc-950/40 hover:border-zinc-700' : 'border-zinc-300 bg-slate-50 hover:border-zinc-400'
        }`}
      >
        {isLoading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 rounded-xl backdrop-blur-xs space-x-3">
            <Loader2 className="h-6 w-6 animate-spin text-white" />
            <span className="text-sm font-mono font-semibold text-white">Parsing .docx file...</span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <Button
              variant="contained"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || isLoading}
              startIcon={<Upload className="h-4 w-4" />}
              sx={{
                bgcolor: isDark ? '#ffffff' : '#000000',
                color: isDark ? '#000000' : '#ffffff',
                fontWeight: 700,
                fontSize: '0.8rem',
                '&:hover': {
                  bgcolor: isDark ? '#e4e4e7' : '#27272a',
                }
              }}
            >
              Upload .docx
            </Button>
            <span className="text-xs opacity-70 font-mono hidden sm:inline">
              or drag & drop Word (.docx) file here
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              size="small"
              onClick={() => setEditorMode(editorMode === 'visual' ? 'code' : 'visual')}
              startIcon={editorMode === 'visual' ? <Code className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              sx={{
                fontSize: '0.75rem',
                color: isDark ? '#ffffff' : '#000000',
                borderColor: isDark ? '#27272a' : '#000000',
              }}
            >
              {editorMode === 'visual' ? 'HTML Code' : 'Visual Editor'}
            </Button>

            <Tooltip title="Copy HTML Content">
              <Button
                size="small"
                onClick={handleCopyText}
                startIcon={isCopied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                sx={{
                  fontSize: '0.75rem',
                  color: isDark ? '#ffffff' : '#000000',
                  borderColor: isDark ? '#27272a' : '#000000',
                }}
              >
                {isCopied ? 'Copied' : 'Copy Text'}
              </Button>
            </Tooltip>

            <Tooltip title="Clear Editor">
              <Button
                size="small"
                onClick={handleClearEditor}
                disabled={disabled || !value}
                startIcon={<Trash2 className="h-3.5 w-3.5" />}
                color="error"
                sx={{ fontSize: '0.75rem' }}
              >
                Clear
              </Button>
            </Tooltip>
          </div>
        </div>
      </div>

      {/* Editor Main Container */}
      <div className={`rounded-xl border transition-all ${
        isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-black shadow-[0_0_8px_rgba(0,0,0,0.15)]'
      }`}>

        {/* Toolbar (Only active in visual mode) */}
        {editorMode === 'visual' && (
          <div className={`flex flex-wrap items-center gap-1.5 p-2.5 border-b rounded-t-xl ${
            isDark ? 'bg-zinc-900/60 border-zinc-800' : 'bg-slate-100 border-zinc-300'
          }`}>
            {/* Heading Dropdown */}
            <Select
              size="small"
              defaultValue="p"
              onChange={(e) => execCmd('formatBlock', e.target.value)}
              disabled={disabled}
              sx={{
                height: 32,
                fontSize: '0.75rem',
                minWidth: 100,
                bgcolor: isDark ? '#050505' : '#ffffff',
              }}
            >
              <MenuItem value="p">Paragraph</MenuItem>
              <MenuItem value="h1">Heading 1</MenuItem>
              <MenuItem value="h2">Heading 2</MenuItem>
              <MenuItem value="h3">Heading 3</MenuItem>
            </Select>

            <div className={`h-5 w-[1px] mx-1 ${isDark ? 'bg-zinc-800' : 'bg-zinc-300'}`} />

            {/* Bold, Italic, Underline */}
            <Tooltip title="Bold (Ctrl+B)">
              <button
                type="button"
                onClick={() => execCmd('bold')}
                disabled={disabled}
                className={`p-1.5 rounded-lg border transition ${
                  isDark
                    ? 'hover:bg-zinc-800 border-zinc-800 text-white'
                    : 'hover:bg-zinc-200 border-zinc-300 text-black'
                }`}
              >
                <Bold className="h-4 w-4" />
              </button>
            </Tooltip>

            <Tooltip title="Italic (Ctrl+I)">
              <button
                type="button"
                onClick={() => execCmd('italic')}
                disabled={disabled}
                className={`p-1.5 rounded-lg border transition ${
                  isDark
                    ? 'hover:bg-zinc-800 border-zinc-800 text-white'
                    : 'hover:bg-zinc-200 border-zinc-300 text-black'
                }`}
              >
                <Italic className="h-4 w-4" />
              </button>
            </Tooltip>

            <Tooltip title="Underline (Ctrl+U)">
              <button
                type="button"
                onClick={() => execCmd('underline')}
                disabled={disabled}
                className={`p-1.5 rounded-lg border transition ${
                  isDark
                    ? 'hover:bg-zinc-800 border-zinc-800 text-white'
                    : 'hover:bg-zinc-200 border-zinc-300 text-black'
                }`}
              >
                <Underline className="h-4 w-4" />
              </button>
            </Tooltip>

            <div className={`h-5 w-[1px] mx-1 ${isDark ? 'bg-zinc-800' : 'bg-zinc-300'}`} />

            {/* Lists */}
            <Tooltip title="Bulleted List">
              <button
                type="button"
                onClick={() => execCmd('insertUnorderedList')}
                disabled={disabled}
                className={`p-1.5 rounded-lg border transition ${
                  isDark
                    ? 'hover:bg-zinc-800 border-zinc-800 text-white'
                    : 'hover:bg-zinc-200 border-zinc-300 text-black'
                }`}
              >
                <List className="h-4 w-4" />
              </button>
            </Tooltip>

            <Tooltip title="Numbered List">
              <button
                type="button"
                onClick={() => execCmd('insertOrderedList')}
                disabled={disabled}
                className={`p-1.5 rounded-lg border transition ${
                  isDark
                    ? 'hover:bg-zinc-800 border-zinc-800 text-white'
                    : 'hover:bg-zinc-200 border-zinc-300 text-black'
                }`}
              >
                <ListOrdered className="h-4 w-4" />
              </button>
            </Tooltip>

            <div className={`h-5 w-[1px] mx-1 ${isDark ? 'bg-zinc-800' : 'bg-zinc-300'}`} />

            {/* Blockquote & Link */}
            <Tooltip title="Blockquote">
              <button
                type="button"
                onClick={() => execCmd('formatBlock', 'blockquote')}
                disabled={disabled}
                className={`p-1.5 rounded-lg border transition ${
                  isDark
                    ? 'hover:bg-zinc-800 border-zinc-800 text-white'
                    : 'hover:bg-zinc-200 border-zinc-300 text-black'
                }`}
              >
                <Quote className="h-4 w-4" />
              </button>
            </Tooltip>

            <Tooltip title="Insert Link">
              <button
                type="button"
                onClick={handleAddLink}
                disabled={disabled}
                className={`p-1.5 rounded-lg border transition ${
                  isDark
                    ? 'hover:bg-zinc-800 border-zinc-800 text-white'
                    : 'hover:bg-zinc-200 border-zinc-300 text-black'
                }`}
              >
                <LinkIcon className="h-4 w-4" />
              </button>
            </Tooltip>

            <div className={`h-5 w-[1px] mx-1 ${isDark ? 'bg-zinc-800' : 'bg-zinc-300'}`} />

            {/* Clear Formatting */}
            <Tooltip title="Clear Formatting">
              <button
                type="button"
                onClick={() => execCmd('removeFormat')}
                disabled={disabled}
                className={`p-1.5 rounded-lg border transition ${
                  isDark
                    ? 'hover:bg-zinc-800 border-zinc-800 text-white'
                    : 'hover:bg-zinc-200 border-zinc-300 text-black'
                }`}
              >
                <RemoveFormatting className="h-4 w-4" />
              </button>
            </Tooltip>
          </div>
        )}

        {/* Content Surface Area */}
        {editorMode === 'visual' ? (
          <div
            ref={editorRef}
            contentEditable={!disabled}
            onInput={handleInput}
            onPaste={handlePaste}
            className={`min-h-[260px] max-h-[420px] overflow-y-auto p-4 rounded-b-xl focus:outline-none prose max-w-none ${
              isDark ? 'text-zinc-100 prose-invert' : 'text-zinc-900'
            }`}
            style={{
              fontFamily: 'system-ui, -apple-system, sans-serif',
              fontSize: '0.95rem',
              lineHeight: '1.6'
            }}
          />
        ) : (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            rows={12}
            className={`w-full p-4 font-mono text-xs rounded-b-xl focus:outline-none resize-y ${
              isDark ? 'bg-zinc-950 text-zinc-200' : 'bg-white text-zinc-900'
            }`}
            placeholder="<h2>Enter HTML source code...</h2>"
          />
        )}
      </div>
    </div>
  );
}
