// src/services/ownerConfig.js

const STORAGE_KEY = 'owner_config';

const defaultConfig = {
  globalMaintenance: false,
  features: {
    deposit: true,
    withdraw: true,
    claim: true,
    bind: true,
    showReferral: true,
    showPrice: true,
    showMinted: true,
    showPoolBadge: true,
    showNodeBadge: true
  }
};

export const loadConfig = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        ...defaultConfig,
        ...parsed,
        features: {
          ...defaultConfig.features,
          ...(parsed.features || {})
        }
      };
    }
  } catch (e) {}
  return defaultConfig;
};

export const saveConfig = (config) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (e) {}
};