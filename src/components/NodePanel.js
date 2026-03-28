// src/components/NodePanel.js
import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { getCurrentLanguage, t } from '../i18n';
import GovernancePanel from './GovernancePanel';

const NodePanel = ({ contract, userAddress, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [currentLang] = useState(getCurrentLanguage());
  const [isMember, setIsMember] = useState(false);
  const [isProposer, setIsProposer] = useState(false);
  const [nodeData, setNodeData] = useState({
    totalRewardedFromNode: '0',
    periodContribution: '0',
    estimatedNextReward: '0',
    pendingNodeRewards: '0',
    timeToNextDistribution: '0'
  });

  const tr = (key) => t(currentLang, key);

  useEffect(() => {
    const loadNodeData = async () => {
      if (!contract || !userAddress) return;
      setLoading(true);
      try {
        // 获取节点信息
        const nodeInfo = await contract.nodes(userAddress);
        const totalRewardedFromNode = ethers.utils.formatEther(nodeInfo.totalRewardedFromNode);
        const lastSnapshotTotal = ethers.utils.formatEther(nodeInfo.lastSnapshotTotal);
        
        const userInfo = await contract.users(userAddress);
        const totalMiningRewarded = ethers.utils.formatEther(userInfo.totalMiningRewarded);
        const periodContribution = parseFloat(totalMiningRewarded) - parseFloat(lastSnapshotTotal);
        
        const pendingNodeRewards = await contract.getNodePendingRewards();
        const pendingNodeRewardsFormatted = ethers.utils.formatEther(pendingNodeRewards);
        
        const nodeList = await contract.getNodeList();
        const nodeCount = nodeList.length;
        
        let totalPeriodContribution = 0;
        for (let i = 0; i < nodeCount; i++) {
          const nodeAddr = nodeList[i];
          const nodeInfoItem = await contract.nodes(nodeAddr);
          const nodeUserInfo = await contract.users(nodeAddr);
          const nodeLastSnapshot = ethers.utils.formatEther(nodeInfoItem.lastSnapshotTotal);
          const nodeTotalMining = ethers.utils.formatEther(nodeUserInfo.totalMiningRewarded);
          totalPeriodContribution += parseFloat(nodeTotalMining) - parseFloat(nodeLastSnapshot);
        }
        
        let estimatedNextReward = 0;
        const totalRewards = parseFloat(pendingNodeRewardsFormatted);
        if (totalRewards > 0 && nodeCount > 0) {
          const equalShare = (totalRewards * 30 / 100) / nodeCount;
          let weightedShare = 0;
          if (totalPeriodContribution > 0 && periodContribution > 0) {
            weightedShare = (totalRewards * 70 / 100) * (periodContribution / totalPeriodContribution);
          }
          estimatedNextReward = equalShare + weightedShare;
        }
        
        const lastDistributionTime = await contract.lastDistributionTime();
        const now = Math.floor(Date.now() / 1000);
        const nextDist = Number(lastDistributionTime) + 7 * 24 * 60 * 60;
        const timeToNext = nextDist > now ? nextDist - now : 0;
        
        setNodeData({
          totalRewardedFromNode,
          periodContribution: periodContribution.toFixed(2),
          estimatedNextReward: estimatedNextReward.toFixed(2),
          pendingNodeRewards: pendingNodeRewardsFormatted,
          timeToNextDistribution: timeToNext
        });
        
        // 获取成员和提案人状态
        const memberStatus = await contract.isMember(userAddress);
        setIsMember(memberStatus);
        const proposerStatus = await contract.isProposer(userAddress);
        setIsProposer(proposerStatus);
        
      } catch (error) {
        console.error('加载节点数据失败:', error);
      } finally {
        setLoading(false);
      }
    };
    loadNodeData();
  }, [contract, userAddress]);

  const formatNumber = (num) => parseFloat(num).toFixed(2);
  const formatTime = (seconds) => {
    if (seconds <= 0) return tr('nextDistribution') + ': ' + tr('soon');
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    if (days > 0) return `${days}天${hours}小时后`;
    return `${hours}小时后`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full max-h-[85vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🌟</span>
            <h2 className="text-xl font-bold text-gray-800">{tr('nodePanelTitle')}</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">✕</button>
        </div>
        
        <div className="p-6 space-y-5">
          {loading ? (
            <div className="text-center py-8 text-gray-500">
              <div className="animate-spin w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full mx-auto mb-3"></div>
              {tr('loading')}
            </div>
          ) : (
            <>
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4">
                <p className="text-purple-800 text-sm font-medium mb-3">📊 {tr('nodePoolInfo')}</p>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 text-sm">{tr('pendingTotal')}</span>
                    <span className="text-lg font-bold text-purple-600">{formatNumber(nodeData.pendingNodeRewards)} SMA</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 text-sm">{tr('nextDistribution')}</span>
                    <span className="text-lg font-bold text-orange-600">{formatTime(nodeData.timeToNextDistribution)}</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4">
                <p className="text-green-800 text-sm font-medium mb-3">📈 {tr('myEarnings')}</p>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 text-sm">{tr('claimedNodeReward')}</span>
                    <span className="text-lg font-bold text-green-600">{formatNumber(nodeData.totalRewardedFromNode)} SMA</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 text-sm">{tr('periodContribution')}</span>
                    <span className="text-lg font-bold text-blue-600">{formatNumber(nodeData.periodContribution)} SMA</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-green-200">
                    <span className="text-gray-600 text-sm">{tr('estimatedNext')}</span>
                    <span className="text-lg font-bold text-amber-600">≈ {formatNumber(nodeData.estimatedNextReward)} SMA</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-gray-700 text-sm font-medium mb-3">📋 {tr('nodeRules')}</p>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-start gap-2"><span className="text-purple-500">•</span><span>{tr('nodeRule1')}</span></li>
                  <li className="flex items-start gap-2"><span className="text-purple-500">•</span><span>{tr('nodeRule2')}</span></li>
                  <li className="flex items-start gap-2"><span className="text-purple-500">•</span><span>{tr('nodeRule3')}</span></li>
                  <li className="flex items-start gap-2"><span className="text-purple-500">•</span><span>{tr('nodeRule4')}</span></li>
                </ul>
              </div>
              
              <GovernancePanel 
                contract={contract} 
                userAddress={userAddress}
                isMember={isMember}
                isProposer={isProposer}
              />
            </>
          )}
        </div>
        
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <button onClick={onClose} className="w-full py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition">{tr('close')}</button>
        </div>
      </div>
    </div>
  );
};

export default NodePanel;