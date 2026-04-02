import React, { useState, useEffect, useMemo } from 'react';
import { ethers } from 'ethers';
import { loadConfig, saveConfig } from '../services/ownerConfig';
import { getCurrentLanguage, t } from '../i18n';
import { supabase } from '../supabaseClient';
import { USDT_ADDRESS, MINING_CONTRACT_ADDRESS } from '../contracts/addresses';
import ERC20ABI from '../contracts/erc20.json';
import GovernanceABI from '../contracts/governance.json';
import { 
  getPoolPerformance, 
  getAllPoolsFromDB, 
  syncAllPools, 
  logPerformanceHistory 
} from '../services/poolPerformance';

// 投票合约地址
const GOVERNANCE_CONTRACT_ADDRESS = "0x1B3C7af4dD3A3029d40f00fBe639466A5EEFbAE6";

const OwnerMenu = ({ contract, ownerAddress, onClose, onConfigChange }) => {
  const [config, setConfig] = useState(loadConfig());
  const [currentLang] = useState(getCurrentLanguage());
  const [pendingUSDT, setPendingUSDT] = useState('0');
  const [pendingSMA, setPendingSMA] = useState('0');
  const [pendingBuyback, setPendingBuyback] = useState('0');
  const [pendingNodeRewards, setPendingNodeRewards] = useState('0');
  const [nodeCount, setNodeCount] = useState(0);
  const [contractUSDTBalance, setContractUSDTBalance] = useState('0');
  const [multisigBalance, setMultisigBalance] = useState('0');
  const [multisigAddress] = useState('0x1B3C7af4dD3A3029d40f00fBe639466A5EEFbAE6');
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
  
  // 矿池监控相关状态
  const [poolList, setPoolList] = useState([]);
  const [poolListLoading, setPoolListLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  
  // 管理员创建提案状态
  const [adminProposalTarget, setAdminProposalTarget] = useState('');
  const [adminProposalAmount, setAdminProposalAmount] = useState('');
  const [adminCreating, setAdminCreating] = useState(false);

  const tr = (key) => t(currentLang, key);

  // USDT 合约实例
  const usdtContract = useMemo(() => {
    if (!contract) return null;
    const signer = contract.signer;
    return new ethers.Contract(USDT_ADDRESS, ERC20ABI, signer);
  }, [contract]);

  // 投票合约实例
  const governanceContract = useMemo(() => {
    if (!contract) return null;
    const signer = contract.signer;
    return new ethers.Contract(GOVERNANCE_CONTRACT_ADDRESS, GovernanceABI, signer);
  }, [contract]);

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

  const loadContractUSDTBalance = async () => {
    if (!usdtContract) return;
    try {
      const balance = await usdtContract.balanceOf(MINING_CONTRACT_ADDRESS);
      setContractUSDTBalance(ethers.utils.formatEther(balance));
    } catch (error) {
      console.error('获取合约USDT余额失败:', error);
    }
  };

  const loadMultisigBalance = async () => {
    if (!usdtContract) return;
    try {
      const balance = await usdtContract.balanceOf(multisigAddress);
      setMultisigBalance(ethers.utils.formatEther(balance));
    } catch (error) {
      console.error('获取多签钱包USDT余额失败:', error);
    }
  };

  // 加载提案列表（使用投票合约）
  const loadProposals = async () => {
    if (!governanceContract) return;
    setProposalLoading(true);
    try {
      // 获取提案总数
      let totalProposals = 0;
      try {
        totalProposals = await governanceContract.proposalsLength();
      } catch {
        totalProposals = 0;
      }
      
      const proposals = [];
      for (let i = 0; i < totalProposals; i++) {
        try {
          const proposal = await governanceContract.getProposal(i);
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

  // 加载矿池列表
  const loadPoolList = async () => {
    setPoolListLoading(true);
    try {
      const pools = await getAllPoolsFromDB();
      const enrichedPools = [];
      for (const pool of pools) {
        try {
          const performance = await getPoolPerformance(contract, pool.pool_address, pool);
          enrichedPools.push({
            ...pool,
            ...performance,
            team_mining: performance.teamMining,
            requirement: performance.requirement,
            remaining_days: performance.remainingDays,
            is_qualified: performance.isQualified
          });
        } catch (e) {
          enrichedPools.push({
            ...pool,
            team_mining: 0,
            requirement: 1000,
            remaining_days: 45,
            is_qualified: false
          });
        }
      }
      setPoolList(enrichedPools);
    } catch (error) {
      console.error('加载矿池列表失败:', error);
    } finally {
      setPoolListLoading(false);
    }
  };

  // 同步矿池数据
  const syncPoolData = async () => {
    setSyncing(true);
    try {
      const results = await syncAllPools(contract);
      await loadPoolList();
      showMessage(`同步完成，共 ${results.length} 个矿池`);
    } catch (error) {
      showMessage('同步失败: ' + error.message, 'error');
    } finally {
      setSyncing(false);
    }
  };

  // 取消矿池资格
  const cancelPool = async (poolAddress) => {
    const shortAddr = `${poolAddress.slice(0, 8)}...${poolAddress.slice(-6)}`;
    if (!window.confirm(`确定要取消矿池 ${shortAddr} 的资格吗？\n此操作不可逆。`)) {
      return;
    }
    setLoading(true);
    try {
      const tx = await contract.setMiningPool(poolAddress, false);
      await tx.wait();
      showMessage(`矿池 ${shortAddr} 已取消资格`);
      
      await supabase
        .from('pool_performance')
        .update({ is_active: false })
        .eq('pool_address', poolAddress);
      
      await logPerformanceHistory(poolAddress, 'cancel', null, null, '管理员手动取消');
      await loadPoolList();
    } catch (error) {
      showMessage('取消资格失败: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // ========== 治理功能（使用投票合约） ==========
  
  const handleAddMember = async () => {
    if (!memberAddress || !ethers.utils.isAddress(memberAddress)) {
      showMessage('请输入有效的钱包地址', 'error');
      return;
    }
    setLoading(true);
    try {
      const tx = await governanceContract.addMember(memberAddress);
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
      const tx = await governanceContract.removeMember(removeMemberAddress);
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
      const tx = await governanceContract.addProposer(proposerAddress);
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
      const tx = await governanceContract.removeProposer(removeProposerAddress);
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
      const tx = await governanceContract.executeProposal(parseInt(executeProposalId));
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
      const tx = await governanceContract.cancelProposal(parseInt(cancelProposalId));
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
      const tx = await governanceContract.executeProposal(proposalId);
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
      const tx = await governanceContract.cancelProposal(proposalId);
      await tx.wait();
      showMessage(`成功取消提案 #${proposalId}`);
      loadProposals();
    } catch (error) {
      showMessage('取消提案失败: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // 管理员创建提案
  const handleAdminCreateProposal = async () => {
    if (!adminProposalTarget || !adminProposalAmount) {
      showMessage('请填写完整信息', 'error');
      return;
    }
    if (!ethers.utils.isAddress(adminProposalTarget)) {
      showMessage('请输入有效的地址', 'error');
      return;
    }
    setAdminCreating(true);
    try {
      const amount = ethers.utils.parseEther(adminProposalAmount);
      const tx = await governanceContract.createProposal(adminProposalTarget, amount);
      await tx.wait();
      showMessage('提案创建成功！');
      setAdminProposalTarget('');
      setAdminProposalAmount('');
      loadProposals();
    } catch (error) {
      showMessage('创建提案失败: ' + error.message, 'error');
    } finally {
      setAdminCreating(false);
    }
  };

  // 紧急权限功能（使用挖矿合约）
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
      
      const now = Math.floor(Date.now() / 1000);
      await supabase
        .from('pool_performance')
        .upsert({
          pool_address: poolAddress,
          base_requirement: 1000,
          total_team_mining: 0,
          period_start_time: now,
          period_requirement: 1000,
          periods_completed: 0,
          child_pools: [],
          is_active: true,
          last_sync_time: now
        });
      
      setPoolAddress('');
      loadPoolList();
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

  useEffect(() => {
    loadPendingData();
    loadContractUSDTBalance();
    loadMultisigBalance();
    const interval = setInterval(() => {
      loadPendingData();
      loadContractUSDTBalance();
      loadMultisigBalance();
    }, 10000);
    return () => clearInterval(interval);
  }, [contract]);

  useEffect(() => {
    if (activeTab === 'governance') {
      loadProposals();
    }
    if (activeTab === 'pools') {
      loadPoolList();
    }
  }, [activeTab, contract, governanceContract]);

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
          <span className="text-white text-lg font-bold">👑 管理员面板</span>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">✕</button>
        </div>

        <div className="flex overflow-x-auto border-b border-gray-700">
          <button
            onClick={() => setActiveTab('switches')}
            className={`px-4 py-3 text-center text-sm whitespace-nowrap ${activeTab === 'switches' ? 'bg-gray-800 text-white border-b-2 border-blue-500' : 'text-gray-400'}`}
          >
            🎛️ 功能开关
          </button>
          <button
            onClick={() => setActiveTab('funds')}
            className={`px-4 py-3 text-center text-sm whitespace-nowrap ${activeTab === 'funds' ? 'bg-gray-800 text-white border-b-2 border-blue-500' : 'text-gray-400'}`}
          >
            💰 资金池
          </button>
          <button
            onClick={() => setActiveTab('pools')}
            className={`px-4 py-3 text-center text-sm whitespace-nowrap ${activeTab === 'pools' ? 'bg-gray-800 text-white border-b-2 border-blue-500' : 'text-gray-400'}`}
          >
            ⛏️ 矿池
          </button>
          <button
            onClick={() => setActiveTab('nodes')}
            className={`px-4 py-3 text-center text-sm whitespace-nowrap ${activeTab === 'nodes' ? 'bg-gray-800 text-white border-b-2 border-blue-500' : 'text-gray-400'}`}
          >
            🌟 节点
          </button>
          <button
            onClick={() => setActiveTab('governance')}
            className={`px-4 py-3 text-center text-sm whitespace-nowrap ${activeTab === 'governance' ? 'bg-gray-800 text-white border-b-2 border-blue-500' : 'text-gray-400'}`}
          >
            🗳️ 治理
          </button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 120px)' }}>
          {activeTab === 'switches' && (
            <>
              <div className="bg-gray-800 rounded-xl p-4">
                <div className="flex justify-between items-center">
                  <span className="text-white font-medium">🔧 全局维护</span>
                  <button
                    onClick={toggleMaintenance}
                    className={`px-4 py-2 rounded-lg text-sm ${config.globalMaintenance ? 'bg-red-600' : 'bg-green-600'} text-white`}
                  >
                    {config.globalMaintenance ? '维护中' : '正常运行'}
                  </button>
                </div>
                {config.globalMaintenance && (
                  <p className="text-yellow-400 text-sm mt-3">系统维护中，暂时关闭部分功能</p>
                )}
              </div>

              <div className="bg-gray-800 rounded-xl p-4">
                <h4 className="text-white font-medium mb-4">功能开关</h4>
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
                        {config.features[key] ? '开' : '关'}
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
                  <span className="text-gray-400 text-base">💰 合约 USDT 余额:</span>
                  <span className="text-white text-base font-medium">{parseFloat(contractUSDTBalance).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-gray-400 text-base">待发放 USDT:</span>
                  <span className="text-white text-base font-medium">{parseFloat(pendingUSDT).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-gray-400 text-base">待发放 SMA:</span>
                  <span className="text-white text-base font-medium">{parseFloat(pendingSMA).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-700 pb-3">
                  <span className="text-gray-400 text-base">待回购 USDT:</span>
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
                  回购销毁
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
                  添加流动性 (需0.005 BNB)
                </button>
              </div>
            </div>
          )}

          {activeTab === 'pools' && (
            <div className="bg-gray-800 rounded-xl p-4 space-y-4">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={poolAddress}
                  onChange={(e) => setPoolAddress(e.target.value)}
                  placeholder="输入地址"
                  className="flex-1 p-3 rounded-xl bg-gray-700 text-white text-base"
                />
                <button
                  onClick={handleSetMiningPool}
                  disabled={loading}
                  className="px-5 py-3 bg-yellow-600 text-white rounded-xl text-base font-medium"
                >
                  添加矿池
                </button>
              </div>
              <p className="text-gray-500 text-sm mt-3">添加后该地址将成为矿池，获得矿池奖励</p>
              
              {/* 矿池监控列表 */}
              <div className="border-t border-gray-700 pt-4 mt-4">
                <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                  <span>📊</span> 矿池监控列表
                </h4>
                
                <div className="flex justify-end mb-3">
                  <button
                    onClick={syncPoolData}
                    disabled={syncing}
                    className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {syncing ? '同步中...' : '🔄 同步数据'}
                  </button>
                </div>
                
                {poolListLoading ? (
                  <div className="text-center py-4 text-gray-400 text-sm">加载中...</div>
                ) : poolList.length === 0 ? (
                  <div className="text-center py-4 text-gray-400 text-sm">暂无矿池数据，请先添加矿池或同步</div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {poolList.map(pool => (
                      <div key={pool.pool_address} className={`bg-gray-700 rounded-lg p-3 ${!pool.is_qualified && pool.is_active ? 'border-l-4 border-red-500' : ''}`}>
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-gray-400 font-mono">
                              {pool.pool_address.slice(0, 8)}...{pool.pool_address.slice(-6)}
                            </span>
                            {!pool.is_active && (
                              <span className="text-xs px-1.5 py-0.5 bg-gray-600 text-gray-300 rounded">已失效</span>
                            )}
                            {!pool.is_qualified && pool.is_active && (
                              <span className="text-xs px-1.5 py-0.5 bg-red-600 text-white rounded">不达标</span>
                            )}
                          </div>
                          <button
                            onClick={() => cancelPool(pool.pool_address)}
                            disabled={loading || !pool.is_active}
                            className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 disabled:opacity-50"
                          >
                            取消资格
                          </button>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-2 text-xs mt-2">
                          <div>
                            <span className="text-gray-400">伞下挖矿:</span>
                            <span className={`ml-1 font-medium ${parseFloat(pool.team_mining) >= parseFloat(pool.requirement) ? 'text-green-400' : 'text-red-400'}`}>
                              {parseFloat(pool.team_mining).toFixed(2)} SMA
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-400">要求:</span>
                            <span className="ml-1 text-yellow-400">{parseFloat(pool.requirement).toFixed(0)} SMA</span>
                          </div>
                          <div>
                            <span className="text-gray-400">剩余:</span>
                            <span className="ml-1 text-blue-400">{pool.remaining_days}天</span>
                          </div>
                        </div>
                        
                        <div className="w-full bg-gray-600 rounded-full h-1.5 mt-2">
                          <div 
                            className={`h-1.5 rounded-full ${parseFloat(pool.team_mining) >= parseFloat(pool.requirement) ? 'bg-green-500' : 'bg-red-500'}`}
                            style={{ width: `${Math.min(100, (parseFloat(pool.team_mining) / parseFloat(pool.requirement)) * 100)}%` }}
                          ></div>
                        </div>
                        
                        {pool.child_pools && pool.child_pools.length > 0 && (
                          <div className="mt-2 text-xs text-gray-500">
                            下级矿池: {pool.child_pools.length} 个
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'nodes' && (
            <div className="bg-gray-800 rounded-xl p-4 space-y-4">
              <div className="space-y-3 pb-3 border-b border-gray-700">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-base">节点数量:</span>
                  <span className="text-white text-base font-medium">{Number(nodeCount)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-base">待发放 SMA 奖励:</span>
                  <span className="text-white text-base font-medium">{parseFloat(pendingNodeRewards).toFixed(2)} SMA</span>
                </div>
              </div>

              <div>
                <h5 className="text-white text-base font-medium mb-3">添加节点</h5>
                <div className="flex gap-3 mb-4">
                  <input
                    type="text"
                    value={nodeAddress}
                    onChange={(e) => setNodeAddress(e.target.value)}
                    placeholder="输入地址"
                    className="flex-1 p-3 rounded-xl bg-gray-700 text-white text-base"
                  />
                  <button
                    onClick={handleAddNode}
                    disabled={loading}
                    className="px-5 py-3 bg-green-600 text-white rounded-xl text-base font-medium"
                  >
                    添加
                  </button>
                </div>

                <h5 className="text-white text-base font-medium mb-3">移除节点</h5>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={removeNodeAddress}
                    onChange={(e) => setRemoveNodeAddress(e.target.value)}
                    placeholder="输入地址"
                    className="flex-1 p-3 rounded-xl bg-gray-700 text-white text-base"
                  />
                  <button
                    onClick={handleRemoveNode}
                    disabled={loading}
                    className="px-5 py-3 bg-red-600 text-white rounded-xl text-base font-medium"
                  >
                    移除
                  </button>
                </div>
              </div>

              <div className="pt-3">
                <button
                  onClick={handleDistributeNodeRewards}
                  disabled={loading || parseFloat(pendingNodeRewards) <= 0}
                  className="w-full py-3 bg-purple-600 text-white rounded-xl text-base font-medium disabled:opacity-50"
                >
                  发放 SMA 奖励
                </button>
                <p className="text-gray-500 text-sm mt-3 text-center">
                  SMA 奖励将按节点贡献分配
                </p>
              </div>
            </div>
          )}

          {activeTab === 'governance' && (
            <div className="bg-gray-800 rounded-xl p-4 space-y-4">
              {/* 创建提案（管理员） */}
              <div>
                <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                  <span>📝</span> 创建提案
                </h4>
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="收款地址"
                    className="w-full p-2 rounded-lg bg-gray-700 text-white text-sm"
                    value={adminProposalTarget}
                    onChange={(e) => setAdminProposalTarget(e.target.value)}
                  />
                  <input
                    type="number"
                    placeholder="金额 (USDT)"
                    className="w-full p-2 rounded-lg bg-gray-700 text-white text-sm"
                    value={adminProposalAmount}
                    onChange={(e) => setAdminProposalAmount(e.target.value)}
                  />
                  <button
                    onClick={handleAdminCreateProposal}
                    disabled={adminCreating}
                    className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
                  >
                    {adminCreating ? '创建中...' : '创建提案'}
                  </button>
                </div>
              </div>
              
              {/* 成员管理 */}
              <div className="border-t border-gray-700 pt-3">
                <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                  <span>👥</span> 成员管理
                </h4>
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    placeholder="成员地址"
                    className="flex-1 p-2 rounded-lg bg-gray-700 text-white text-sm"
                    value={memberAddress}
                    onChange={(e) => setMemberAddress(e.target.value)}
                  />
                  <button onClick={handleAddMember} className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm">添加</button>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="成员地址"
                    className="flex-1 p-2 rounded-lg bg-gray-700 text-white text-sm"
                    value={removeMemberAddress}
                    onChange={(e) => setRemoveMemberAddress(e.target.value)}
                  />
                  <button onClick={handleRemoveMember} className="px-3 py-2 bg-red-600 text-white rounded-lg text-sm">移除</button>
                </div>
              </div>
              
              {/* 提案人管理 */}
              <div className="border-t border-gray-700 pt-3">
                <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                  <span>📝</span> 提案人管理
                </h4>
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    placeholder="提案人地址"
                    className="flex-1 p-2 rounded-lg bg-gray-700 text-white text-sm"
                    value={proposerAddress}
                    onChange={(e) => setProposerAddress(e.target.value)}
                  />
                  <button onClick={handleAddProposer} className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm">添加</button>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="提案人地址"
                    className="flex-1 p-2 rounded-lg bg-gray-700 text-white text-sm"
                    value={removeProposerAddress}
                    onChange={(e) => setRemoveProposerAddress(e.target.value)}
                  />
                  <button onClick={handleRemoveProposer} className="px-3 py-2 bg-red-600 text-white rounded-lg text-sm">移除</button>
                </div>
              </div>
              
              {/* 提案列表 */}
              <div className="border-t border-gray-700 pt-3">
                <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                  <span>📋</span> 提案列表
                </h4>
                {proposalLoading ? (
                  <div className="text-center py-4 text-gray-400 text-sm">加载中...</div>
                ) : proposalList.length === 0 ? (
                  <div className="text-center py-4 text-gray-400 text-sm">暂无提案</div>
                ) : (
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {proposalList.map(proposal => (
                      <div key={proposal.id} className="bg-gray-700 rounded-lg p-3">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-xs text-gray-400">提案 #{proposal.id}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            proposal.executed ? 'bg-green-900 text-green-300' :
                            !proposal.active ? 'bg-red-900 text-red-300' :
                            'bg-yellow-900 text-yellow-300'
                          }`}>
                            {proposal.executed ? '已执行' : !proposal.active ? '已取消' : '投票中'}
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
                          <span>需 {proposal.requiredVotes} 票</span>
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
                              执行
                            </button>
                            <button
                              onClick={() => handleCancelProposalById(proposal.id)}
                              disabled={loading}
                              className="flex-1 py-1.5 bg-orange-600 text-white text-xs rounded-lg hover:bg-orange-700"
                            >
                              取消
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
                  <span>⚡</span> 快捷操作
                </h4>
                <div className="flex gap-2 mb-3">
                  <input
                    type="number"
                    placeholder="提案ID"
                    className="flex-1 p-2 rounded-lg bg-gray-700 text-white text-sm"
                    value={executeProposalId}
                    onChange={(e) => setExecuteProposalId(e.target.value)}
                  />
                  <button onClick={handleExecuteProposal} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm">执行</button>
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="提案ID"
                    className="flex-1 p-2 rounded-lg bg-gray-700 text-white text-sm"
                    value={cancelProposalId}
                    onChange={(e) => setCancelProposalId(e.target.value)}
                  />
                  <button onClick={handleCancelProposal} className="px-3 py-2 bg-orange-600 text-white rounded-lg text-sm">取消</button>
                </div>
              </div>
              
              {/* 多签钱包余额 */}
              <div className="border-t border-gray-700 pt-3">
                <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                  <span>🏦</span> 多签钱包 (Marketing Wallet)
                </h4>
                <div className="flex justify-between items-center py-2">
                  <span className="text-gray-400 text-sm">USDT 余额:</span>
                  <span className="text-white text-base font-medium">{parseFloat(multisigBalance).toFixed(2)}</span>
                </div>
                <div className="text-xs text-gray-500 mt-1 font-mono break-all">
                  {multisigAddress}
                </div>
              </div>
              
              {/* 紧急权限 */}
              <div className="border-t border-gray-700 pt-3">
                <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                  <span>⚠️</span> 紧急权限
                </h4>
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    placeholder="接收地址"
                    className="flex-1 p-2 rounded-lg bg-gray-700 text-white text-sm"
                    value={emergencyRecipient}
                    onChange={(e) => setEmergencyRecipient(e.target.value)}
                  />
                  <input
                    type="number"
                    placeholder="金额 (0=全部)"
                    className="w-24 p-2 rounded-lg bg-gray-700 text-white text-sm"
                    value={emergencyAmount}
                    onChange={(e) => setEmergencyAmount(e.target.value)}
                  />
                  <button onClick={handleEmergencyWithdraw} className="px-3 py-2 bg-red-600 text-white rounded-lg text-sm">提款</button>
                </div>
                <button 
                  onClick={handleRevokeEmergency} 
                  disabled={loading}
                  className="w-full py-2 bg-gray-600 text-white rounded-lg text-sm hover:bg-red-700 transition disabled:opacity-50"
                >
                  ⚠️ 撤销紧急权限（永久，不可逆）
                </button>
                <p className="text-gray-500 text-xs mt-2 text-center">
                  撤销后紧急提款功能将永久关闭，请谨慎操作
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