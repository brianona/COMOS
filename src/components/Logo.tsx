import React, { useState, useEffect } from 'react';
import { Ship } from 'lucide-react';
import { cn } from '../utils/helpers';

const STORAGE_KEY = 'COMOS_APP_LOGO';
let customLogoUrlGlobal: string | null = (() => {
  try {
    return localStorage.getItem(STORAGE_KEY) || null;
  } catch (e) {
    return null;
  }
})();

const logoListeners = new Set<(url: string | null) => void>();

export const getCustomLogoUrl = () => customLogoUrlGlobal;

export const setCustomLogoUrl = (url: string | null) => {
  customLogoUrlGlobal = url && url.trim() !== '' ? url.trim() : null;
  try {
    if (customLogoUrlGlobal) {
      localStorage.setItem(STORAGE_KEY, customLogoUrlGlobal);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch (e) {}
  logoListeners.forEach(listener => listener(customLogoUrlGlobal));
};

export const fetchAndApplyPublicLogo = async (): Promise<string | null> => {
  try {
    const res = await fetch('/api/public-settings');
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data.APP_LOGO !== 'undefined') {
        const logoVal = data.APP_LOGO && data.APP_LOGO.trim() !== '' ? data.APP_LOGO.trim() : null;
        setCustomLogoUrl(logoVal);
        return logoVal;
      }
    }
  } catch (e) {
    console.warn('Failed to fetch public logo setting:', e);
  }
  return customLogoUrlGlobal;
};

// Initial background load
if (typeof window !== 'undefined') {
  setTimeout(() => {
    fetchAndApplyPublicLogo();
  }, 100);
}

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
      className={cn("object-contain max-h-full max-w-full", className)}
      referrerPolicy="no-referrer"
      onError={() => {
        if (customLogo) {
          // If custom logo errored, fallback to default or icon
          setHasError(true);
        }
      }}
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
      "bg-white rounded-xl shadow-xs border border-blue-50 flex items-center justify-center overflow-hidden transition-all duration-300 shrink-0", 
      sizes[size], 
      size === 'lg' && "rounded-2xl", 
      className
    )}>
      <Logo className="w-full h-full" iconClassName={iconClassName} />
    </div>
  );
};

