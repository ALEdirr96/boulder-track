import React from 'react';
import { Mountain } from 'lucide-react';
import { cn } from '../lib/utils';

interface LogoProps {
  className?: string;
  showText?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ className, showText = true }) => {
  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div className="relative">
        {/* Placeholder for the real logo.png */}
        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-lg border-2 border-emerald-500 overflow-hidden">
          <img 
            src="/logo.png" 
            alt="Valmasino Climbing" 
            className="w-full h-full object-cover"
            onError={(e) => {
              // Fallback to Icon if image doesn't exist
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              const parent = target.parentElement;
              if (parent) {
                const icon = document.createElement('div');
                icon.className = "flex items-center justify-center w-full h-full bg-emerald-500";
                icon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-mountain"><path d="m8 3 4 8 5-5 5 15H2L8 3z"/></svg>';
                parent.appendChild(icon);
              }
            }}
          />
        </div>
      </div>
      {showText && (
        <div className="text-center">
          <div className="text-[8px] font-black tracking-[0.2em] text-stone-400 uppercase leading-none">Valmasino Climbing</div>
          <div className="text-xs font-black italic uppercase tracking-tighter text-emerald-500">Scalamasino</div>
        </div>
      )}
    </div>
  );
};
