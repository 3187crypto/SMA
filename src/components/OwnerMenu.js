import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { loadConfig, saveConfig } from '../services/ownerConfig';
import { getCurrentLanguage, t } from '../i18n';

const OwnerMenu = ({ contract, ownerAddress, onClose, onConfigChange }) => {
  const [config, setConfig] = useState(loadConfig());
  const [currentLang] = useState(getCurrentLanguage());
  const [pendingUSDT, setPendingUSDT] = useState('0');
  const [pendingSMA, setPendingSMA] = useState('0');
  const [pendingBuyback, setPendingBuyback] = useState('0');
  const [pendingNodeRewards, setPendingNodeRewards] = useState('0');
  const [nodeCount, setNodeCount] = useState(0);
  const [buybackAmount, setBuybackAmount] = useState('');
  const [liquidityAmount, setLiquidityAmount] = useState('');
  const [poolAddress, setPoolAddress] = useState('');
  const [nodeAddress, setNodeAddress] = useState('');
  const [removeNodeAddress, setRemoveNodeAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState('switches');
  
  // 治理相关状态
  const [memberAddress, setMemberAddress] = useState('');
  const [removeMemberAddress, setRemoveMemberAddress] = useState('');
  const [proposerAddress, setProposerAddress] = useState('');
  const [removeProposerAddress, setRemoveProposerAddress] = useState('');
  const [executeProposalId, setExecuteProposalId] = useState('');
  const [cancelProposalId, setCancelProposalId] = useState('');
  const [emergencyRecipient, setEmergencyRecipient] = useState('');
  const [emergencyAmount, setEmergencyAmount] = useState('');
  const [proposalList, setProposalList] = useState([]);
  const [proposalLoading, setProposalLoading] = useState(false);

  const tr = (key) => t(currentLang, key);

  const loadPendingData = async () => {
    if (!contract) return;
    try {
      const pending = await contract.getPendingStatus();
      setPendingUSDT(ethers.utils.formatEther(pending.pendingUSDT));
      setPendingSMA(ethers.utils.formatEther(pending.pendingSMA));
      setPendingBuyback(ethers.utils.formatEther(pending.pendingBuybackUSDT));
      
      try {
        const rewards = await contract.getNodePendingRewards();
        setPendingNodeRewards(ethers.utils.formatEther(rewards));
        const count = await contract.getNodeCount();
        setNodeCount(Number(count));
      } catch (e) {}
    } catch (error) {
      console.error('加载资金池数据失败:', error);
    }
  };

  const loadProposals = async () => {
    if (!contract) return;
    setProposalLoading(true);
    try {
      let totalProposals = 0;
      try {
        totalProposals = await contract.proposalsLength();
      } catch {
        try {
          totalProposals = Number(await contract.getProposalCount?.()) || 0;
        } catch {
          totalProposals = 0;
        }
      }
      
      const proposals = [];
      for (let i = 0; i < totalProposals; i++) {
        try {
          const proposal = await contract.getProposal(i);
          proposals.push({
            id: i,
            target: proposal.target,
            amount: ethers.utils.formatEther(proposal.amount),
            yesCount: Number(proposal.yesCount),
            noCount: Number(proposal.noCount),
            executed: proposal.executed,
            active: proposal.active,
            createdAt: Number(proposal.createdAt),
            memberCountAtCreation: Number(proposal.memberCountAtCreation),
            requiredVotes: Math.floor(Number(proposal.memberCountAtCreation) / 2) + 1
          });
        } catch (e) {}
      }
      setProposalList(proposals);
    } catch (error) {
      console.error('加载提案列表失败:', error);
    } finally {
      setProposalLoading(false);
    }
  };

  useEffect(() => {
    loadPendingData();
    const interval = setInterval(loadPendingData, 10000);
    return () => clearInterval(interval);
  }, [contract]);

  useEffect(() => {
    if (activeTab === 'governance') {
      loadProposals();
    }
  }, [activeTab, contract]);

  const toggleFeature = (feature) => {
    const newConfig = {
      ...config,
      features: { ...config.features, [feature]: !config.features[feature] }
    };
    setConfig(newConfig);
    saveConfig(newConfig);
    onConfigChange(newConfig);
    showMessage(`${feature} 已${newConfig.features[feature] ? '开启' : '关闭'}`);
  };

  const toggleMaintenance = () => {
    const newConfig = { ...config, globalMaintenance: !config.globalMaintenance };
    setConfig(newConfig);
    saveConfig(newConfig);
    onConfigChange(newConfig);
    showMessage(`全局维护模式已${newConfig.globalMaintenance ? '开启' : '关闭'}`);
  };

  const handleBuyback = async () => {
    if (!buybackAmount || parseFloat(buybackAmount) <= 0) {
      showMessage('请输入有效的 USDT 数量', 'error');
      return;
    }
    setLoading(true);
    try {
      const amount = ethers.utils.parseEther(buybackAmount);
      const tx = await contract.buybackAndBurn(amount, 0);
      await tx.wait();
      showMessage(`成功回购销毁 ${buybackAmount} USDT`);
      setBuybackAmount('');
      loadPendingData();
    } catch (error) {
      showMessage('回购销毁失败: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAddLiquidity = async () => {
    if (!liquidityAmount || parseFloat(liquidityAmount) <= 0) {
      showMessage('请输入有效的 USDT 数量', 'error');
      return;
    }
    setLoading(true);
    try {
      const amount = ethers.utils.parseEther(liquidityAmount);
      const tx = await contract.addLiquidityFromPending(amount, { value: ethers.utils.parseEther('0.005') });
      await tx.wait();
      showMessage(`成功添加流动性 ${liquidityAmount} USDT`);
      setLiquidityAmount('');
      loadPendingData();
    } catch (error) {
      console.error('添加流动性失败:', error);
      showMessage('添加流动性失败: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSetMiningPool = async () => {
    if (!poolAddress || !ethers.utils.isAddress(poolAddress)) {
      showMessage('请输入有效的钱包地址', 'error');
      return;
    }
    setLoading(true);
    try {
      const tx = await contract.setMiningPool(poolAddress, true);
      await tx.wait();
      showMessage(`成功添加矿池: ${poolAddress.slice(0,6)}...${poolAddress.slice(-4)}`);
      setPoolAddress('');
    } catch (error) {
      showMessage('添加矿池失败: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAddNode = async () => {
    if (!nodeAddress || !ethers.utils.isAddress(nodeAddress)) {
      showMessage('请输入有效的钱包地址', 'error');
      return;
    }
    setLoading(true);
    try {
      const tx = await contract.addNode(nodeAddress);
      await tx.wait();
      showMessage(`成功添加节点: ${nodeAddress.slice(0,6)}...${nodeAddress.slice(-4)}`);
      setNodeAddress('');
      loadPendingData();
    } catch (error) {
      showMessage('添加节点失败: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveNode = async () => {
    if (!removeNodeAddress || !ethers.utils.isAddress(removeNodeAddress)) {
      showMessage('请输入有效的钱包地址', 'error');
      return;
    }
    setLoading(true);
    try {
      const tx = await contract.removeNode(removeNodeAddress);
      await tx.wait();
      showMessage(`成功移除节点: ${removeNodeAddress.slice(0,6)}...${removeNodeAddress.slice(-4)}`);
      setRemoveNodeAddress('');
      loadPendingData();
    } catch (error) {
      showMessage('移除节点失败: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDistributeNodeRewards = async () => {
    setLoading(true);
    try {
      const tx = await contract.distributeNodeRewards();
      await tx.wait();
      showMessage('节点SMA奖励发放成功');
      loadPendingData();
    } catch (error) {
      showMessage('发放节点奖励失败: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // 治理功能
  const handleAddMember = async () => {
    if (!memberAddress || !ethers.utils.isAddress(memberAddress)) {
      showMessage('请输入有效的钱包地址', 'error');
      return;
    }
    setLoading(true);
    try {
      const tx = await contract.addMember(memberAddress);
      await tx.wait();
      showMessage(`成功添加成员: ${memberAddress.slice(0,6)}...${memberAddress.slice(-4)}`);
      setMemberAddress('');
      loadProposals();
    } catch (error) {
      showMessage('添加成员失败: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!removeMemberAddress || !ethers.utils.isAddress(removeMemberAddress)) {
      showMessage('请输入有效的钱包地址', 'error');
      return;
    }
    setLoading(true);
    try {
      const tx = await contract.removeMember(removeMemberAddress);
      await tx.wait();
      showMessage(`成功移除成员: ${removeMemberAddress.slice(0,6)}...${removeMemberAddress.slice(-4)}`);
      setRemoveMemberAddress('');
      loadProposals();
    } catch (error) {
      showMessage('移除成员失败: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAddProposer = async () => {
    if (!proposerAddress || !ethers.utils.isAddress(proposerAddress)) {
      showMessage('请输入有效的钱包地址', 'error');
      return;
    }
    setLoading(true);
    try {
      const tx = await contract.addProposer(proposerAddress);
      await tx.wait();
      showMessage(`成功添加提案人: ${proposerAddress.slice(0,6)}...${proposerAddress.slice(-4)}`);
      setProposerAddress('');
    } catch (error) {
      showMessage('添加提案人失败: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveProposer = async () => {
    if (!removeProposerAddress || !ethers.utils.isAddress(removeProposerAddress)) {
      showMessage('请输入有效的钱包地址', 'error');
      return;
    }
    setLoading(true);
    try {
      const tx = await contract.removeProposer(removeProposerAddress);
      await tx.wait();
      showMessage(`成功移除提案人: ${removeProposerAddress.slice(0,6)}...${removeProposerAddress.slice(-4)}`);
      setRemoveProposerAddress('');
    } catch (error) {
      showMessage('移除提案人失败: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteProposal = async () => {
    if (!executeProposalId || parseInt(executeProposalId) < 0) {
      showMessage('请输入有效的提案ID', 'error');
      return;
    }
    setLoading(true);
    try {
      const tx = await contract.executeProposal(parseInt(executeProposalId));
      await tx.wait();
      showMessage(`成功执行提案 #${executeProposalId}`);
      setExecuteProposalId('');
      loadProposals();
    } catch (error) {
      showMessage('执行提案失败: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelProposal = async () => {
    if (!cancelProposalId || parseInt(cancelProposalId) < 0) {
      showMessage('请输入有效的提案ID', 'error');
      return;
    }
    setLoading(true);
    try {
      const tx = await contract.cancelProposal(parseInt(cancelProposalId));
      await tx.wait();
      showMessage(`成功取消提案 #${cancelProposalId}`);
      setCancelProposalId('');
      loadProposals();
    } catch (error) {
      showMessage('取消提案失败: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteProposalById = async (proposalId) => {
    if (typeof proposalId !== 'number') return;
    setLoading(true);
    try {
      const tx = await contract.executeProposal(proposalId);
      await tx.wait();
      showMessage(`成功执行提案 #${proposalId}`);
      loadProposals();
    } catch (error) {
      showMessage('执行提案失败: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelProposalById = async (proposalId) => {
    if (typeof proposalId !== 'number') return;
    setLoading(true);
    try {
      const tx = await contract.cancelProposal(proposalId);
      await tx.wait();
      showMessage(`成功取消提案 #${proposalId}`);
      loadProposals();
    } catch (error) {
      showMessage('取消提案失败: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEmergencyWithdraw = async () => {
    if (!emergencyRecipient || !ethers.utils.isAddress(emergencyRecipient)) {
      showMessage('请输入有效的接收地址', 'error');
      return;
    }
    setLoading(true);
    try {
      const amount = emergencyAmount ? ethers.utils.parseEther(emergencyAmount) : 0;
      const tx = await contract.emergencyWithdraw(emergencyRecipient, amount);
      await tx.wait();
      showMessage(`紧急提款成功，接收方: ${emergencyRecipient.slice(0,6)}...`);
      setEmergencyRecipient('');
      setEmergencyAmount('');
    } catch (error) {
      showMessage('紧急提款失败: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeEmergency = async () => {
    setLoading(true);
    try {
      const tx = await contract.revokeEmergencyPrivilege();
      await tx.wait();
      showMessage('紧急权限已永久撤销');
    } catch (error) {
      showMessage('撤销紧急权限失败: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (msg, type = 'success') => {
    setMessage({ text: msg, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const featureNames = {
    deposit: '存款',
    withdraw: '提款',
    claim: '领取奖励',
    bind: '绑定推荐',
    showReferral: '团队树',
    showPrice: '价格显示',
    showMinted: '发行总量',
    showPoolBadge: '矿池面板',
    showNodeBadge: '节点面板'
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      {message && (
        <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 p-3 rounded-lg text-sm text-center ${
          message.type === 'error' ? 'bg-red-500' : 'bg-green-500'
        } text-white`}>
          {message.text}
        </div>
      )}
      
      <div className="bg-gray-900 rounded-xl w-full max-w-md max-h-[90vh] overflow-hidden mx-4">
        <div className="px-5 py-4 border-b border-gray-700 flex justify-between items-center">
          <span className="text-white text-lg font-bold">👑 {tr('adminPanel') || '管理员面板'}</span>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">✕</button>
        </div>

        <div className="flex overflow-x-auto border-b border-gray-700">
          <button
            onClick={() => setActiveTab('switches')}
            className={`px-4 py-3 text-center text-sm whitespace-nowrap ${activeTab === 'switches' ? 'bg-gray-800 text-white border-b-2 border-blue-500' : 'text-gray-400'}`}
          >
            🎛️ {tr('featureSwitches') || '功能开关'}
          </button>
          <button
            onClick={() => setActiveTab('funds')}
            className={`px-4 py-3 text-center text-sm whitespace-nowrap ${activeTab === 'funds' ? 'bg-gray-800 text-white border-b-2 border-blue-500' : 'text-gray-400'}`}
          >
            💰 {tr('fundPool') || '资金池'}
          </button>
          <button
            onClick={() => setActiveTab('pools')}
            className={`px-4 py-3 text-center text-sm whitespace-nowrap ${activeTab === 'pools' ? 'bg-gray-800 text-white border-b-2 border-blue-500' : 'text-gray-400'}`}
          >
            ⛏️ {tr('miningPool')}
          </button>
          <button
            onClick={() => setActiveTab('nodes')}
            className={`px-4 py-3 text-center text-sm whitespace-nowrap ${activeTab === 'nodes' ? 'bg-gray-800 text-white border-b-2 border-blue-500' : 'text-gray-400'}`}
          >
            🌟 {tr('nodeBadge')}
          </button>
          <button
            onClick={() => setActiveTab('governance')}
            className={`px-4 py-3 text-center text-sm whitespace-nowrap ${activeTab === 'governance' ? 'bg-gray-800 text-white border-b-2 border-blue-500' : 'text-gray-400'}`}
          >
            🗳️ {tr('governanceTitle') || '治理'}
          </button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 120px)' }}>
          {activeTab === 'switches' && (
            <>
              <div className="bg-gray-800 rounded-xl p-4">
                <div className="flex justify-between items-center">
                  <span className="text-white font-medium">🔧 {tr('globalMaintenance') || '全局维护'}</span>
                  <button
                    onClick={toggleMaintenance}
                    className={`px-4 py-2 rounded-lg text-sm ${config.globalMaintenance ? 'bg-red-600' : 'bg-green-600'} text-white`}
                  >
                    {config.globalMaintenance ? (tr('maintenance') || '维护中') : (tr('normal') || '正常运行')}
                  </button>
                </div>
                {config.globalMaintenance && (
                  <p className="text-yellow-400 text-sm mt-3">{tr('maintenanceNotice') || '系统维护中，暂时关闭部分功能'}</p>
                )}
              </div>

              <div className="bg-gray-800 rounded-xl p-4">
                <h4 className="text-white font-medium mb-4">{tr('featureSwitches') || '功能开关'}</h4>
                <div className="space-y-3">
                  {Object.entries(featureNames).map(([key, name]) => (
                    <div key={key} className="flex justify-between items-center py-2 border-b border-gray-700 last:border-0">
                      <span className="text-gray-300 text-base">{name}</span>
                      <button
                        onClick={() => toggleFeature(key)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium ${
                          config.features[key] ? 'bg-green-600' : 'bg-gray-600'
                        } text-white`}
                      >
                        {config.features[key] ? (tr('on') || '开') : (tr('off') || '关')}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {activeTab === 'funds' && (
            <div className="bg-gray-800 rounded-xl p-4 space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center py-2">
                  <span className="text-gray-400 text-base">{tr('pendingUSDT') || '待发放 USDT'}:</span>
                  <span className="text-white text-base font-medium">{parseFloat(pendingUSDT).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-gray-400 text-base">{tr('pendingSMA') || '待发放 SMA'}:</span>
                  <span className="text-white text-base font-medium">{parseFloat(pendingSMA).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-700 pb-3">
                  <span className="text-gray-400 text-base">{tr('pendingBuyback') || '待回购 USDT'}:</span>
                  <span className="text-white text-base font-medium">{parseFloat(pendingBuyback).toFixed(2)}</span>
                </div>
              </div>

              <div className="space-y-3">
                <input
                  type="number"
                  value={buybackAmount}
                  onChange={(e) => setBuybackAmount(e.target.value)}
                  placeholder="USDT数量"
                  className="w-full p-3 rounded-xl bg-gray-700 text-white text-base"
                />
                <button
                  onClick={handleBuyback}
                  disabled={loading}
                  className="w-full py-3 bg-purple-600 text-white rounded-xl text-base font-medium"
                >
                  {tr('buyback') || '回购销毁'}
                </button>
              </div>

              <div className="space-y-3">
                <input
                  type="number"
                  value={liquidityAmount}
                  onChange={(e) => setLiquidityAmount(e.target.value)}
                  placeholder="USDT数量"
                  className="w-full p-3 rounded-xl bg-gray-700 text-white text-base"
                />
                <button
                  onClick={handleAddLiquidity}
                  disabled={loading}
                  className="w-full py-3 bg-blue-600 text-white rounded-xl text-base font-medium"
                >
                  {tr('addLiquidity') || '添加流动性'} (需0.005 BNB)
                </button>
              </div>
            </div>
          )}

          {activeTab === 'pools' && (
            <div className="bg-gray-800 rounded-xl p-4">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={poolAddress}
                  onChange={(e) => setPoolAddress(e.target.value)}
                  placeholder={tr('enterAddress') || '输入地址'}
                  className="flex-1 p-3 rounded-xl bg-gray-700 text-white text-base"
                />
                <button
                  onClick={handleSetMiningPool}
                  disabled={loading}
                  className="px-5 py-3 bg-yellow-600 text-white rounded-xl text-base font-medium"
                >
                  {tr('addPool') || '添加矿池'}
                </button>
              </div>
              <p className="text-gray-500 text-sm mt-3">{tr('poolAddHint') || '添加后该地址将成为矿池，获得矿池奖励'}</p>
            </div>
          )}

          {activeTab === 'nodes' && (
            <div className="bg-gray-800 rounded-xl p-4 space-y-4">
              <div className="space-y-3 pb-3 border-b border-gray-700">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-base">{tr('nodeCount') || '节点数量'}:</span>
                  <span className="text-white text-base font-medium">{Number(nodeCount)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-base">{tr('pendingNodeRewards') || '待发放 SMA 奖励'}:</span>
                  <span className="text-white text-base font-medium">{parseFloat(pendingNodeRewards).toFixed(2)} SMA</span>
                </div>
              </div>

              <div>
                <h5 className="text-white text-base font-medium mb-3">{tr('addNode') || '添加节点'}</h5>
                <div className="flex gap-3 mb-4">
                  <input
                    type="text"
                    value={nodeAddress}
                    onChange={(e) => setNodeAddress(e.target.value)}
                    placeholder={tr('enterAddress') || '输入地址'}
                    className="flex-1 p-3 rounded-xl bg-gray-700 text-white text-base"
                  />
                  <button
                    onClick={handleAddNode}
                    disabled={loading}
                    className="px-5 py-3 bg-green-600 text-white rounded-xl text-base font-medium"
                  >
                    {tr('add') || '添加'}
                  </button>
                </div>

                <h5 className="text-white text-base font-medium mb-3">{tr('removeNode') || '移除节点'}</h5>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={removeNodeAddress}
                    onChange={(e) => setRemoveNodeAddress(e.target.value)}
                    placeholder={tr('enterAddress') || '输入地址'}
                    className="flex-1 p-3 rounded-xl bg-gray-700 text-white text-base"
                  />
                  <button
                    onClick={handleRemoveNode}
                    disabled={loading}
                    className="px-5 py-3 bg-red-600 text-white rounded-xl text-base font-medium"
                  >
                    {tr('remove') || '移除'}
                  </button>
                </div>
              </div>

              <div className="pt-3">
                <button
                  onClick={handleDistributeNodeRewards}
                  disabled={loading || parseFloat(pendingNodeRewards) <= 0}
                  className="w-full py-3 bg-purple-600 text-white rounded-xl text-base font-medium disabled:opacity-50"
                >
                  {tr('distributeRewards') || '发放 SMA 奖励'}
                </button>
                <p className="text-gray-500 text-sm mt-3 text-center">
                  {tr('rewardDistributionHint') || 'SMA 奖励将按节点贡献分配'}
                </p>
              </div>
            </div>
          )}

          {activeTab === 'governance' && (
            <div className="bg-gray-800 rounded-xl p-4 space-y-4">
              {/* 成员管理 */}
              <div>
                <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                  <span>👥</span> {tr('memberManagement') || '成员管理'}
                </h4>
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    placeholder={tr('memberAddress') || '成员地址'}
                    className="flex-1 p-2 rounded-lg bg-gray-700 text-white text-sm"
                    value={memberAddress}
                    onChange={(e) => setMemberAddress(e.target.value)}
                  />
                  <button onClick={handleAddMember} className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm">{tr('add') || '添加'}</button>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder={tr('memberAddress') || '成员地址'}
                    className="flex-1 p-2 rounded-lg bg-gray-700 text-white text-sm"
                    value={removeMemberAddress}
                    onChange={(e) => setRemoveMemberAddress(e.target.value)}
                  />
                  <button onClick={handleRemoveMember} className="px-3 py-2 bg-red-600 text-white rounded-lg text-sm">{tr('remove') || '移除'}</button>
                </div>
              </div>
              
              {/* 提案人管理 */}
              <div className="border-t border-gray-700 pt-3">
                <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                  <span>📝</span> {tr('proposerManagement') || '提案人管理'}
                </h4>
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    placeholder={tr('proposerAddress') || '提案人地址'}
                    className="flex-1 p-2 rounded-lg bg-gray-700 text-white text-sm"
                    value={proposerAddress}
                    onChange={(e) => setProposerAddress(e.target.value)}
                  />
                  <button onClick={handleAddProposer} className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm">{tr('add') || '添加'}</button>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder={tr('proposerAddress') || '提案人地址'}
                    className="flex-1 p-2 rounded-lg bg-gray-700 text-white text-sm"
                    value={removeProposerAddress}
                    onChange={(e) => setRemoveProposerAddress(e.target.value)}
                  />
                  <button onClick={handleRemoveProposer} className="px-3 py-2 bg-red-600 text-white rounded-lg text-sm">{tr('remove') || '移除'}</button>
                </div>
              </div>
              
              {/* 提案列表 */}
              <div className="border-t border-gray-700 pt-3">
                <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                  <span>📋</span> {tr('proposalList') || '提案列表'}
                </h4>
                {proposalLoading ? (
                  <div className="text-center py-4 text-gray-400 text-sm">{tr('loading') || '加载中...'}</div>
                ) : proposalList.length === 0 ? (
                  <div className="text-center py-4 text-gray-400 text-sm">{tr('noProposals') || '暂无提案'}</div>
                ) : (
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {proposalList.map(proposal => (
                      <div key={proposal.id} className="bg-gray-700 rounded-lg p-3">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-xs text-gray-400">{tr('proposal') || '提案'} #{proposal.id}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            proposal.executed ? 'bg-green-900 text-green-300' :
                            !proposal.active ? 'bg-red-900 text-red-300' :
                            'bg-yellow-900 text-yellow-300'
                          }`}>
                            {proposal.executed ? (tr('executed') || '已执行') : !proposal.active ? (tr('cancelled') || '已取消') : (tr('voting') || '投票中')}
                          </span>
                        </div>
                        <div className="text-xs text-gray-300 mb-1 font-mono">
                          📤 {proposal.target.slice(0, 8)}...{proposal.target.slice(-6)}
                        </div>
                        <div className="text-sm font-bold text-yellow-400 mb-2">
                          {parseFloat(proposal.amount).toFixed(2)} USDT
                        </div>
                        <div className="flex justify-between text-xs text-gray-400 mb-2">
                          <span>👍 {proposal.yesCount}</span>
                          <span>👎 {proposal.noCount}</span>
                          <span>{tr('requiredVotes') || '需'} {proposal.requiredVotes} {tr('votes') || '票'}</span>
                        </div>
                        <div className="w-full bg-gray-600 rounded-full h-1 mb-3">
                          <div 
                            className="bg-green-500 h-1 rounded-full" 
                            style={{ width: `${Math.min(100, (proposal.yesCount / proposal.requiredVotes) * 100)}%` }}
                          ></div>
                        </div>
                        {!proposal.executed && proposal.active && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleExecuteProposalById(proposal.id)}
                              disabled={loading || proposal.yesCount < proposal.requiredVotes}
                              className={`flex-1 py-1.5 text-xs rounded-lg ${
                                proposal.yesCount >= proposal.requiredVotes
                                  ? 'bg-blue-600 hover:bg-blue-700'
                                  : 'bg-gray-600 cursor-not-allowed'
                              } text-white`}
                            >
                              {tr('execute') || '执行'}
                            </button>
                            <button
                              onClick={() => handleCancelProposalById(proposal.id)}
                              disabled={loading}
                              className="flex-1 py-1.5 bg-orange-600 text-white text-xs rounded-lg hover:bg-orange-700"
                            >
                              {tr('cancel') || '取消'}
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {/* 提案管理快捷操作 */}
              <div className="border-t border-gray-700 pt-3">
                <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                  <span>⚡</span> {tr('quickActions') || '快捷操作'}
                </h4>
                <div className="flex gap-2 mb-3">
                  <input
                    type="number"
                    placeholder={tr('proposalId') || '提案ID'}
                    className="flex-1 p-2 rounded-lg bg-gray-700 text-white text-sm"
                    value={executeProposalId}
                    onChange={(e) => setExecuteProposalId(e.target.value)}
                  />
                  <button onClick={handleExecuteProposal} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm">{tr('execute') || '执行'}</button>
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder={tr('proposalId') || '提案ID'}
                    className="flex-1 p-2 rounded-lg bg-gray-700 text-white text-sm"
                    value={cancelProposalId}
                    onChange={(e) => setCancelProposalId(e.target.value)}
                  />
                  <button onClick={handleCancelProposal} className="px-3 py-2 bg-orange-600 text-white rounded-lg text-sm">{tr('cancel') || '取消'}</button>
                </div>
              </div>
              
              {/* 紧急权限 */}
              <div className="border-t border-gray-700 pt-3">
                <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                  <span>⚠️</span> {tr('emergencyPrivilege') || '紧急权限'}
                </h4>
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    placeholder={tr('recipientLabel') || '接收地址'}
                    className="flex-1 p-2 rounded-lg bg-gray-700 text-white text-sm"
                    value={emergencyRecipient}
                    onChange={(e) => setEmergencyRecipient(e.target.value)}
                  />
                  <input
                    type="number"
                    placeholder={tr('amountLabel') || '金额 (0=全部)'}
                    className="w-24 p-2 rounded-lg bg-gray-700 text-white text-sm"
                    value={emergencyAmount}
                    onChange={(e) => setEmergencyAmount(e.target.value)}
                  />
                  <button onClick={handleEmergencyWithdraw} className="px-3 py-2 bg-red-600 text-white rounded-lg text-sm">{tr('withdraw') || '提款'}</button>
                </div>
                <button 
                  onClick={handleRevokeEmergency} 
                  disabled={loading}
                  className="w-full py-2 bg-gray-600 text-white rounded-lg text-sm hover:bg-red-700 transition disabled:opacity-50"
                >
                  ⚠️ {tr('revokeEmergency') || '撤销紧急权限（永久，不可逆）'}
                </button>
                <p className="text-gray-500 text-xs mt-2 text-center">
                  {tr('revokeWarning') || '撤销后紧急提款功能将永久关闭，请谨慎操作'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OwnerMenu;