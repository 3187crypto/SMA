// src/components/PoolPanel.js
import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';

const PoolPanel = ({ contract, userAddress, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [poolData, setPoolData] = useState({
    totalPoolRewarded: '0',
    remainingCap: '0',
    totalMiningRewarded: '0'
  });

  useEffect(() => {
    const loadPoolData = async () => {
      if (!contract || !userAddress) return;
      
      setLoading(true);
      try {
        const userInfo = await contract.users(userAddress);
        const remainingCap = await contract.getRemainingNonMiningRewardCap(userAddress);
        
        setPoolData({
          totalPoolRewarded: ethers.utils.formatEther(userInfo.totalPoolRewarded),
          remainingCap: ethers.utils.formatEther(remainingCap),
          totalMiningRewarded: ethers.utils.formatEther(userInfo.totalMiningRewarded)
        });
      } catch (error) {
        console.error('加载矿池数据失败:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadPoolData();
  }, [contract, userAddress]);

  const formatNumber = (num) => {
    return parseFloat(num).toFixed(2);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full max-h-[85vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-2xl">⛏️</span>
            <h2 className="text-xl font-bold text-gray-800">矿池面板</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">✕</button>
        </div>
        
        <div className="p-6 space-y-5">
          {loading ? (
            <div className="text-center py-8 text-gray-500">
              <div className="animate-spin w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full mx-auto mb-3"></div>
              加载中...
            </div>
          ) : (
            <>
              {/* 收益统计 */}
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-4">
                <p className="text-amber-800 text-sm font-medium mb-3">📊 收益统计</p>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 text-sm">累计矿池奖励</span>
                    <span className="text-lg font-bold text-amber-600">{formatNumber(poolData.totalPoolRewarded)} SMA</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 text-sm">剩余可领取上限</span>
                    <span className="text-lg font-bold text-green-600">{formatNumber(poolData.remainingCap)} SMA</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-amber-200">
                    <span className="text-gray-600 text-sm">团队总挖矿</span>
                    <span className="text-lg font-bold text-blue-600">{formatNumber(poolData.totalMiningRewarded)} SMA</span>
                  </div>
                </div>
              </div>
              
              {/* 权益说明 */}
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-gray-700 text-sm font-medium mb-3">📋 矿池权益说明</p>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-start gap-2">
                    <span className="text-amber-500">•</span>
                    <span>下级领取奖励时，您可获得该笔奖励的 5%</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-500">•</span>
                    <span>矿池有效期 45 天，每次获得奖励后重置计时</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-500">•</span>
                    <span>矿池奖励上限为净存款的 2 倍</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-500">•</span>
                    <span>超过 45 天未获得奖励，矿池资格自动失效</span>
                  </li>
                </ul>
              </div>
            </>
          )}
        </div>
        
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};

export default PoolPanel;