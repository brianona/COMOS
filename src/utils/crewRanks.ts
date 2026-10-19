/**
 * Maritime Ranks and Position Configuration
 * 
 * Rules:
 * - Electro-Technical-Officer, Fitter/Welder, and Wiper are removed.
 * - Motorman / Oiler is renamed to Oiler.
 * - If the ship is owned by Goodwill, engineer ranks are:
 *     - 2nd Engineer -> First Assistant Engineer
 *     - 3rd Engineer -> Second Assistant Engineer
 *     - 4th Engineer -> Third Assistant Engineer
 */

export const isGoodwillOwner = (owner?: string | null): boolean => {
  if (!owner) return false;
  return owner.toString().toLowerCase().trim() === 'goodwill';
};

export const getMaritimeRanks = (owner?: string | null): string[] => {
  const isGoodwill = isGoodwillOwner(owner);

  return [
    'Master (Captain)',
    'Chief Officer',
    '2nd Officer',
    '3rd Officer',
    'Chief Engineer',
    isGoodwill ? 'First Assistant Engineer' : '2nd Engineer',
    isGoodwill ? 'Second Assistant Engineer' : '3rd Engineer',
    isGoodwill ? 'Third Assistant Engineer' : '4th Engineer',
    'Deck Cadet',
    'Engine Cadet',
    'Bosun',
    'Able Seaman (AB)',
    'Ordinary Seaman (OS)',
    'Oiler',
    'Chief Cook',
    'Messman'
  ];
};

/**
 * Normalizes a rank name based on the vessel's owner.
 * If Goodwill, converts 2nd/3rd/4th Engineer to 1st/2nd/3rd Assistant Engineer.
 * If Nissen / standard, converts Assistant Engineer back to standard numerical format.
 * Renames Motorman / Oiler to Oiler.
 */
export const normalizeRankForVessel = (rank: string, owner?: string | null): string => {
  if (!rank) return '';
  const trimmed = rank.trim();

  // Always normalize Motorman / Oiler to Oiler
  if (/^motorman(\s*\/\s*oiler)?$/i.test(trimmed)) {
    return 'Oiler';
  }

  const isGoodwill = isGoodwillOwner(owner);

  if (isGoodwill) {
    if (/^(2nd|second)\s*engineer$/i.test(trimmed)) {
      return 'First Assistant Engineer';
    }
    if (/^(3rd|third)\s*engineer$/i.test(trimmed)) {
      return 'Second Assistant Engineer';
    }
    if (/^(4th|fourth)\s*engineer$/i.test(trimmed)) {
      return 'Third Assistant Engineer';
    }
  } else {
    if (/^first\s*assistant\s*engineer$/i.test(trimmed) || /^1st\s*assistant\s*engineer$/i.test(trimmed)) {
      return '2nd Engineer';
    }
    if (/^second\s*assistant\s*engineer$/i.test(trimmed) || /^2nd\s*assistant\s*engineer$/i.test(trimmed)) {
      return '3rd Engineer';
    }
    if (/^third\s*assistant\s*engineer$/i.test(trimmed) || /^3rd\s*assistant\s*engineer$/i.test(trimmed)) {
      return '4th Engineer';
    }
  }

  return trimmed;
};

/**
 * Department classifier for filtering
 */
export const getRankDepartment = (rank: string): 'deck' | 'engine' | 'catering' => {
  const r = (rank || '').toLowerCase();
  if (
    r.includes('master') ||
    r.includes('captain') ||
    r.includes('officer') ||
    r.includes('bosun') ||
    r.includes('seaman') ||
    r.includes('deck')
  ) {
    return 'deck';
  }
  if (
    r.includes('engineer') ||
    r.includes('assistant engineer') ||
    r.includes('oiler') ||
    r.includes('engine')
  ) {
    return 'engine';
  }
  if (r.includes('cook') || r.includes('messman') || r.includes('steward')) {
    return 'catering';
  }
  return 'deck';
};
