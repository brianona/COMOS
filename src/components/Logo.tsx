import React, { useState, useEffect } from 'react';
import { Ship } from 'lucide-react';
import { cn } from '../utils/helpers';

let customLogoUrlGlobal: string | null = null;
const logoListeners = new Set<(url: string | null) => void>();

export const getCustomLogoUrl = () => customLogoUrlGlobal;
export const setCustomLogoUrl = (url: string | null) => {
  customLogoUrlGlobal = url;
  logoListeners.forEach(listener => listener(url));
};

export const useCustomLogo = () => {
  const [logo, setLogo] = useState<string | null>(customLogoUrlGlobal);
  useEffect(() => {
    const listener = (newUrl: string | null) => setLogo(newUrl);
    logoListeners.add(listener);
    return () => {
      logoListeners.delete(listener);
    };
  }, []);
  return logo;
};

export const Logo = ({ className, iconClassName }: { className?: string; iconClassName?: string }) => {
  const customLogo = useCustomLogo();
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [customLogo]);

  if (hasError) {
    return (
      <Ship className={cn(iconClassName || "text-blue-600", className)} />
    );
  }

  return (
    <img 
      src={customLogo || "/logo.png"} 
      alt="COMOS Logo" 
      className={cn("object-contain", className)}
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
    />
  );
};

export const LogoContainer = ({ size = 'md', className, iconClassName }: { size?: 'sm' | 'md' | 'lg' | 'xs', className?: string, iconClassName?: string }) => {
  const sizes = {
    xs: "w-8 h-8 p-1",
    sm: "w-12 h-12 p-1.5",
    md: "w-16 h-16 p-2",
    lg: "w-24 h-24 p-3"
  };
  
  return (
    <div className={cn(
      "bg-white rounded-xl shadow-sm border border-blue-50 flex items-center justify-center overflow-hidden transition-all duration-300", 
      sizes[size], 
      size === 'lg' && "rounded-2xl", 
      className
    )}>
      <Logo className="w-full h-full" iconClassName={iconClassName} />
    </div>
  );
};
