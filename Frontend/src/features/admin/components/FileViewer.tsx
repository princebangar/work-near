// Private document / evidence viewer: fetched with the admin token as a Blob, shown via an object URL that is
// revoked when the viewer closes. Images render inline (with rotate), PDFs in an iframe.
import { useCallback, useEffect, useState } from 'react';
import { FileWarning, Lock, RotateCw } from 'lucide-react';
import { Skeleton } from '@/components/ui';
import { adminHttp } from '@/lib/http';
import { errText } from '@/api/admin';
import { cn } from '@/lib/format';
import { Btn, Dialog } from './kit';

export interface ViewerFile { path: string; name: string; note?: string }

export function useFileViewer() {
  const [file, setFile] = useState<ViewerFile | null>(null);
  const open = useCallback((f: ViewerFile) => setFile(f), []);
  const viewer = file ? <FileViewer key={file.path} file={file} onClose={() => setFile(null)} /> : null;
  return { open, viewer };
}

type State = { status: 'loading' } | { status: 'ready'; url: string; type: string } | { status: 'error'; message: string };

function FileViewer({ file, onClose }: { file: ViewerFile; onClose: () => void }) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [rotate, setRotate] = useState(0);

  useEffect(() => {
    let url: string | undefined;
    let cancelled = false;
    adminHttp
      .blob(file.path)
      .then((b) => {
        if (cancelled) return;
        url = URL.createObjectURL(b);
        setState({ status: 'ready', url, type: b.type });
      })
      .catch((e) => !cancelled && setState({ status: 'error', message: errText(e) }));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [file.path]);

  const isImg = state.status === 'ready' && state.type.startsWith('image/');
  const isPdf = state.status === 'ready' && state.type === 'application/pdf';

  return (
    <Dialog
      open
      onClose={onClose}
      size="xl"
      title={file.name}
      description={
        <span className="inline-flex items-center gap-1.5 text-xs">
          <Lock size={12} /> Private file · visible to admins only{file.note ? ` · ${file.note}` : ''}
        </span>
      }
      footer={
        <>
          {isImg && <Btn tone="outline" size="sm" icon={<RotateCw size={14} />} onClick={() => setRotate((r) => (r + 90) % 360)}>Rotate</Btn>}
          <Btn tone="primary" size="sm" onClick={onClose}>Done</Btn>
        </>
      }
    >
      <div className="grid min-h-[50vh] place-items-center overflow-hidden rounded-2xl bg-surface-2 p-2">
        {state.status === 'loading' && <Skeleton className="h-[60vh] w-full" />}
        {state.status === 'error' && (
          <div className="flex flex-col items-center gap-2 p-8 text-center">
            <FileWarning className="text-danger" size={28} />
            <p className="font-semibold">Couldn’t open this file</p>
            <p className="text-sm text-ink-2">{state.message}</p>
          </div>
        )}
        {isImg && state.status === 'ready' && (
          <img
            src={state.url}
            alt={file.name}
            style={{ transform: `rotate(${rotate}deg)` }}
            className={cn('max-h-[70vh] max-w-full rounded-xl object-contain transition-transform duration-300', rotate % 180 !== 0 && 'max-h-[60vw] sm:max-h-[60vh]')}
          />
        )}
        {isPdf && state.status === 'ready' && <iframe src={state.url} title={file.name} className="h-[70vh] w-full rounded-xl border-0 bg-white" />}
        {state.status === 'ready' && !isImg && !isPdf && (
          <p className="p-8 text-sm text-ink-2">Preview not available for this file type ({state.type || 'unknown'}).</p>
        )}
      </div>
    </Dialog>
  );
}
