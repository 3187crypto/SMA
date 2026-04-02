import React, { useState, useEffect, useMemo } from 'react';
import { ethers } from 'ethers';
import { getCurrentLanguage, t } from '../i18n';
import GovernancePanel from './GovernancePanel';
import GovernanceABI from '../contracts/governance.json';

// 投票合约地址
const GOVERNANCE_ADDRESS = "0x1B3C7af4dD3A3029d40f00fBe639466A5EEFbAE6";

const NodePanel = ({ contract, userAddress, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [currentLang] = useState(getCurrentLanguage());
  const [isMember, setIsMember] = useState(false);
  const [isProposer, setIsProposer] = useState(false);
  const [nodeData, setNodeData] = useState({
    miningReward: '0',
    nodeRewardClaimed: '0',
    totalReward: '0',
    remainingCap: '0',
    periodContribution: '0',
    estimatedNextReward: '0',
    pendingNodeRewards: '0',
    timeToNextDistribution: '0'
  });

  const tr = (key) => t(currentLang, key);

  // 投票合约实例
  const governanceContract = useMemo(() => {
    if (!contract) return null;
    const signer = contract.signer;
    return new ethers.Contract(GOVERNANCE_ADDRESS, GovernanceABI, signer);
  }, [contract]);

  useEffect(() => {
    const loadNodeData = async () => {
      if (!contract || !userAddress) return;
      setLoading(true);
      try {
        // 1. 获取节点真实收益
        const [miningReward, nodeRewardClaimed, totalReward, lastSnapshot, remainingCap] = 
          await contract.getNodeRealEarnings(userAddress);
        
        // 2. 获取用户挖矿总奖励
        const userInfo = await contract.users(userAddress);
        const totalMiningRewarded = ethers.utils.formatEther(userInfo.totalMiningRewarded);
        const lastSnapshotFormatted = ethers.utils.formatEther(lastSnapshot);
        const periodContribution = parseFloat(totalMiningRewarded) - parseFloat(lastSnapshotFormatted);
        
        // 3. 获取节点池信息
        const pendingNodeRewards = await contract.getNodePendingRewards();
        const pendingNodeRewardsFormatted = ethers.utils.formatEther(pendingNodeRewards);
        
        // 4. 获取节点列表
        const nodeList = await contract.getNodeList();
        const nodeCount = nodeList.length;
        
        // 5. 计算所有节点的本期贡献总和
        let totalPeriodContribution = 0;
        for (let i = 0; i < nodeCount; i++) {
          const nodeAddr = nodeList[i];
          const nodeInfo = await contract.nodes(nodeAddr);
          const nodeUserInfo = await contract.users(nodeAddr);
          const nodeLastSnapshot = ethers.utils.formatEther(nodeInfo.lastSnapshotTotal);
          const nodeTotalMining = ethers.utils.formatEther(nodeUserInfo.totalMiningRewarded);
          totalPeriodContribution += parseFloat(nodeTotalMining) - parseFloat(nodeLastSnapshot);
        }
        
        // 6. 计算预计下次获得
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
        
        // 7. 获取下次分配时间
        const lastDistributionTime = await contract.lastDistributionTime();
        const now = Math.floor(Date.now() / 1000);
        const nextDist = Number(lastDistributionTime) + 7 * 24 * 60 * 60;
        const timeToNext = nextDist > now ? nextDist - now : 0;
        
        setNodeData({
          miningReward: ethers.utils.formatEther(miningReward),
          nodeRewardClaimed: ethers.utils.formatEther(nodeRewardClaimed),
          totalReward: ethers.utils.formatEther(totalReward),
          remainingCap: ethers.utils.formatEther(remainingCap),
          periodContribution: periodContribution.toFixed(2),
          estimatedNextReward: estimatedNextReward.toFixed(2),
          pendingNodeRewards: pendingNodeRewardsFormatted,
          timeToNextDistribution: timeToNext
        });
        
        // 8. 获取成员和提案人状态（使用投票合约）
        try {
          const memberStatus = await governanceContract.isMember(userAddress);
          setIsMember(memberStatus);
          const proposerStatus = await governanceContract.isProposer(userAddress);
          setIsProposer(proposerStatus);
        } catch (e) {
          console.log('治理功能可能未启用');
        }
        
      } catch (error) {
        console.error('加载节点数据失败:', error);
      } finally {
        setLoading(false);
      }
    };
    loadNodeData();
  }, [contract, governanceContract, userAddress]);

  const formatNumber = (num) => parseFloat(num).toFixed(2);
  const formatTime = (seconds) => {
    if (seconds <= 0) return '即将分配';
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
              {/* 节点池信息卡片 */}
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
              
              {/* 我的收益卡片 */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4">
                <p className="text-green-800 text-sm font-medium mb-3">📈 {tr('myEarnings')}</p>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 text-sm">{tr('miningReward') || '挖矿奖励'}</span>
                    <span className="text-lg font-bold text-blue-600">{formatNumber(nodeData.miningReward)} SMA</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 text-sm">{tr('claimedNodeReward')}</span>
                    <span className="text-lg font-bold text-green-600">{formatNumber(nodeData.nodeRewardClaimed)} SMA</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 text-sm">{tr('totalReward') || '总奖励'}</span>
                    <span className="text-lg font-bold text-purple-600">{formatNumber(nodeData.totalReward)} SMA</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 text-sm">{tr('remainingCap') || '剩余额度'}</span>
                    <span className="text-lg font-bold text-amber-600">{formatNumber(nodeData.remainingCap)} SMA</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-green-200">
                    <span className="text-gray-600 text-sm">{tr('periodContribution')}</span>
                    <span className="text-lg font-bold text-blue-600">{formatNumber(nodeData.periodContribution)} SMA</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 text-sm">{tr('estimatedNext')}</span>
                    <span className="text-lg font-bold text-amber-600">≈ {formatNumber(nodeData.estimatedNextReward)} SMA</span>
                  </div>
                </div>
              </div>
              
              {/* 节点分配规则卡片 */}
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-gray-700 text-sm font-medium mb-3">📋 {tr('nodeRules')}</p>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-start gap-2"><span className="text-purple-500">•</span><span>{tr('nodeRule1')}</span></li>
                  <li className="flex items-start gap-2"><span className="text-purple-500">•</span><span>{tr('nodeRule2')}</span></li>
                  <li className="flex items-start gap-2"><span className="text-purple-500">•</span><span>{tr('nodeRule3')}</span></li>
                  <li className="flex items-start gap-2"><span className="text-purple-500">•</span><span>{tr('nodeRule4')}</span></li>
                </ul>
              </div>
              
              {/* 治理投票模块 */}
              <GovernancePanel 
                contract={governanceContract}
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