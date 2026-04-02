import React, { useState, useEffect, useRef } from 'react'
import Editor from '@monaco-editor/react'
import { SupportedLanguage, LANGUAGE_CONFIG } from '@code-clash/shared-types'

interface CodeEditorProps {
  code: string
  language: SupportedLanguage
  onCodeChange: (code: string) => void
  onLanguageChange: (language: SupportedLanguage) => void
  onRun: () => void
  onSubmit: () => void
  isRunning: boolean
  isSubmitting: boolean
  disabled?: boolean
}

const CodeEditor: React.FC<CodeEditorProps> = ({
  code,
  language,
  onCodeChange,
  onLanguageChange,
  onRun,
  onSubmit,
  isRunning,
  isSubmitting,
  disabled = false
}) => {
  const [lineCount, setLineCount] = useState(1)
  const [charCount, setCharCount] = useState(0)
  const editorRef = useRef<any>(null)

  // Auto-save to localStorage
  useEffect(() => {
    const interval = setInterval(() => {
      if (code.trim()) {
        localStorage.setItem(`code_${language}`, code)
      }
    }, 10000)

    return () => clearInterval(interval)
  }, [code, language])

  // Load saved code on mount
  useEffect(() => {
    const savedCode = localStorage.getItem(`code_${language}`)
    if (savedCode && !code) {
      onCodeChange(savedCode)
    }
  }, [language])

  // Update stats
  useEffect(() => {
    setLineCount(code.split('\n').length)
    setCharCount(code.length)
  }, [code])

  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor
    
    // Configure editor theme
    editor.updateOptions({
      theme: 'vs-dark',
      fontSize: 14,
      fontFamily: 'JetBrains Mono, Fira Code, monospace',
      lineNumbers: 'on',
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      wordWrap: 'on',
      automaticLayout: true,
      tabSize: 2,
      insertSpaces: true,
    })

    // Add keyboard shortcuts
    editor.addCommand(editor.KeyMod.CtrlCmd | editor.KeyCode.Enter, () => {
      if (!disabled) onSubmit()
    })
    
    editor.addCommand(editor.KeyMod.CtrlCmd | editor.KeyCode.KeyR, () => {
      if (!disabled) onRun()
    })
  }

  return (
    <div className="card-dark p-4 h-full flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          {/* Language Selector */}
          <select
            value={language}
            onChange={(e) => onLanguageChange(e.target.value as SupportedLanguage)}
            disabled={disabled}
            className="bg-dark-card border border-dark-border rounded px-3 py-1 text-sm focus:outline-none focus:border-neon-green disabled:opacity-50"
          >
            {Object.entries(LANGUAGE_CONFIG).map(([key, config]) => (
              <option key={key} value={key}>
                {config.name}
              </option>
            ))}
          </select>

          {/* Stats */}
          <div className="flex items-center gap-4 text-xs text-dark-muted">
            <span>Lines: {lineCount}</span>
            <span>Chars: {charCount}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={onRun}
            disabled={disabled || isRunning}
            className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isRunning ? (
              <>
                <div className="w-4 h-4 border-2 border-neon-green border-t-transparent rounded-full animate-spin" />
                Running...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Run Tests
              </>
            )}
          </button>

          <button
            onClick={onSubmit}
            disabled={disabled || isSubmitting || !code.trim()}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Submit (Ctrl+Enter)
              </>
            )}
          </button>
        </div>
      </div>

      {/* Monaco Editor */}
      <div className="flex-1 border border-dark-border rounded overflow-hidden">
        <Editor
          height="100%"
          language={language}
          value={code}
          onChange={(value) => onCodeChange(value || '')}
          onMount={handleEditorDidMount}
          options={{
            readOnly: disabled,
            theme: 'vs-dark',
            fontSize: 14,
            fontFamily: 'JetBrains Mono, Fira Code, monospace',
            lineNumbers: 'on',
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            automaticLayout: true,
            tabSize: 2,
            insertSpaces: true,
          }}
        />
      </div>

      {/* Footer hints */}
      <div className="mt-3 text-xs text-dark-muted flex justify-between">
        <div className="flex gap-4">
          <span>Ctrl+Enter to submit</span>
          <span>Ctrl+R to run tests</span>
        </div>
        <div>
          Auto-saves every 10 seconds
        </div>
      </div>
    </div>
  )
}

export default CodeEditor
