// src/components/PoolHealthMonitor.js
import React, { useState, useEffect } from 'react';
import { getPoolHealth } from '../services/poolPerformance';
import { getCurrentLanguage, t } from '../i18n';

const PoolHealthMonitor = ({ contract, poolAddress, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState(null);
  const [currentLang] = useState(getCurrentLanguage());
  
  const tr = (key) => t(currentLang, key);

  useEffect(() => {
    const loadHealth = async () => {
      if (!contract || !poolAddress) return;
      setLoading(true);
      try {
        const data = await getPoolHealth(contract, poolAddress);
        setHealth(data);
      } catch (error) {
        console.error('加载矿池健康度失败:', error);
      } finally {
        setLoading(false);
      }
    };
    loadHealth();
  }, [contract, poolAddress]);

  const formatNumber = (num) => parseFloat(num).toFixed(2);
  const getProgressPercent = () => {
    if (!health) return 0;
    return Math.min(100, (health.teamMining / health.requirement) * 100);
  };

  if (loading) {
    return (
      <div className="text-center py-4 text-gray-500">
        <div className="animate-spin w-6 h-6 border-4 border-amber-500 border-t-transparent rounded-full mx-auto mb-2"></div>
        {tr('loading')}
      </div>
    );
  }

  if (!health) return null;

  const isQualified = health.isQualified;
  const progress = getProgressPercent();

  return (
    <div className={`rounded-xl p-4 ${isQualified ? 'bg-green-50' : 'bg-red-50'}`}>
      <div className="flex items-center justify-between mb-3">
        <p className={`text-sm font-medium ${isQualified ? 'text-green-800' : 'text-red-800'}`}>
          📊 矿池健康度监控
        </p>
        <span className={`text-xs px-2 py-1 rounded-full ${isQualified ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
          {isQualified ? '✅ 达标' : '⚠️ 不达标'}
        </span>
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">第 {health.periodsCompleted + 1} 期考核</span>
          <span className="text-gray-600">剩余 {health.remainingDays} 天</span>
        </div>
        
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">伞下总挖矿</span>
          <span className={`font-medium ${isQualified ? 'text-green-600' : 'text-red-600'}`}>
            {formatNumber(health.teamMining)} SMA
          </span>
        </div>
        
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">本期要求</span>
          <span className="font-medium text-orange-600">{formatNumber(health.requirement)} SMA</span>
        </div>
        
        {/* 进度条 */}
        <div className="mt-2">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all ${isQualified ? 'bg-green-500' : 'bg-red-500'}`}
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <p className="text-xs text-gray-500 mt-1 text-right">
            进度: {Math.floor(progress)}%
          </p>
        </div>
      </div>
      
      {/* 下级矿池信息 */}
      {health.childPools && health.childPools.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <p className="text-xs text-gray-500 mb-2">📌 下级矿池（业绩已扣除）</p>
          {health.childPools.map((child, idx) => (
            <div key={idx} className="text-xs text-gray-600 font-mono mb-1">
              {child.pool_address.slice(0, 8)}...{child.pool_address.slice(-6)}
              <span className="text-gray-400 ml-2">
                ({formatNumber(child.total_team_mining)} SMA)
              </span>
            </div>
          ))}
        </div>
      )}
      
      {/* 不达标警告 */}
      {!isQualified && (
        <div className="mt-3 p-2 bg-red-100 rounded-lg text-xs text-red-700">
          ⚠️ 业绩不达标！剩余 {health.remainingDays} 天内需达到 {formatNumber(health.requirement)} SMA，否则将取消矿池资格。
        </div>
      )}
      
      {/* 即将到期提醒 */}
      {isQualified && health.remainingDays < 7 && (
        <div className="mt-3 p-2 bg-yellow-100 rounded-lg text-xs text-yellow-700">
          ⏰ 距离下次考核仅剩 {health.remainingDays} 天，下期要求 {formatNumber(parseFloat(health.requirement) + 300)} SMA
        </div>
      )}
    </div>
  );
};

export default PoolHealthMonitor;