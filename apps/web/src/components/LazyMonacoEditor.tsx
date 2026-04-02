import { lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';

// Lazy load Monaco Editor (2MB bundle)
const MonacoEditor = lazy(() => import('./MonacoEditor').then(module => ({
  default: module.MonacoEditor
})));

interface LazyMonacoEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: string;
  height?: string;
  theme?: string;
  options?: any;
}

export const LazyMonacoEditor: React.FC<LazyMonacoEditorProps> = (props) => {
  return (
    <Suspense 
      fallback={
        <div className="flex items-center justify-center h-96 bg-gray-900 rounded-lg border border-gray-700">
          <div className="flex flex-col items-center space-y-2">
            <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
            <p className="text-gray-400 text-sm">Loading code editor...</p>
          </div>
        </div>
      }
    >
      <MonacoEditor {...props} />
    </Suspense>
  );
};

// Preload Monaco editor for better UX
export const preloadMonacoEditor = () => {
  import('./MonacoEditor');
};
