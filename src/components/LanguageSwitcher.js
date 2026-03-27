// src/components/LanguageSwitcher.js
import React, { useState, useEffect, useRef } from 'react';
import { languages, getCurrentLanguage, setLanguage } from '../i18n';

const LanguageSwitcher = ({ onLanguageChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentLang, setCurrentLang] = useState(getCurrentLanguage());
  const dropdownRef = useRef(null);

  const currentLangData = languages.find(l => l.code === currentLang) || languages[0];

  const handleLanguageChange = (langCode) => {
    setLanguage(langCode);
    setCurrentLang(langCode);
    setIsOpen(false);
    if (onLanguageChange) onLanguageChange(langCode);
    // 刷新页面以应用所有翻译
    window.location.reload();
  };

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition text-sm"
      >
        <span>{currentLangData.flag}</span>
        <span className="hidden sm:inline">{currentLangData.name}</span>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-40 bg-white rounded-lg shadow-lg border border-gray-200 z-[9999] overflow-hidden">
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleLanguageChange(lang.code)}
              className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center space-x-2 transition ${
                currentLang === lang.code ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
              }`}
            >
              <span>{lang.flag}</span>
              <span>{lang.name}</span>
              {currentLang === lang.code && (
                <svg className="w-4 h-4 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LanguageSwitcher;