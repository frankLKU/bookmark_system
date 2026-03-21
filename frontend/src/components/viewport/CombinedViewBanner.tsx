import { useEffect, useState } from 'react';
import { Columns2 } from 'lucide-react';

interface Props {
  relatedTitle: string;
  onOpenCombined: () => void;
}

export function CombinedViewBanner({ relatedTitle, onOpenCombined }: Props) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 10000);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div className="h-10 bg-blue-900/50 flex items-center px-4 gap-3 shrink-0">
      <Columns2 className="w-4 h-4 text-blue-400" />
      <span className="text-sm text-blue-200 flex-1">
        Related bookmark found: "{relatedTitle}"
      </span>
      <button
        onClick={onOpenCombined}
        className="px-3 py-1 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
      >
        Open Combined View
      </button>
      <button
        onClick={() => setVisible(false)}
        className="px-3 py-1 text-xs font-medium text-blue-300 hover:text-blue-100 transition-colors"
      >
        Dismiss
      </button>
    </div>
  );
}
