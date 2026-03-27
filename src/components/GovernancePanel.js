import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';

const GovernancePanel = ({ contract, userAddress, isMember, isProposer }) => {
  const [loading, setLoading] = useState(true);
  const [activeProposals, setActiveProposals] = useState([]);
  const [votingStates, setVotingStates] = useState({});
  const [memberCount, setMemberCount] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProposalTarget, setNewProposalTarget] = useState('');
  const [newProposalAmount, setNewProposalAmount] = useState('');
  const [creating, setCreating] = useState(false);
  const [votingInProgress, setVotingInProgress] = useState({});

  useEffect(() => {
    loadGovernanceData();
  }, [contract, userAddress]);

  const loadGovernanceData = async () => {
    if (!contract) return;
    setLoading(true);
    try {
      const count = await contract.getMemberCount();
      setMemberCount(Number(count));
      
      const activeIds = await contract.getActiveProposals();
      const proposals = [];
      const votingStatesMap = {};
      
      for (let i = 0; i < activeIds.length; i++) {
        const id = Number(activeIds[i]);
        const proposal = await contract.getProposal(id);
        const hasVoted = await contract.hasVoted(id, userAddress);
        
        proposals.push({
          id,
          target: proposal.target,
          amount: ethers.utils.formatEther(proposal.amount),
          yesCount: Number(proposal.yesCount),
          noCount: Number(proposal.noCount),
          memberCountAtCreation: Number(proposal.memberCountAtCreation),
          requiredVotes: Math.floor(Number(proposal.memberCountAtCreation) / 2) + 1
        });
        
        votingStatesMap[id] = hasVoted;
      }
      
      setActiveProposals(proposals);
      setVotingStates(votingStatesMap);
    } catch (error) {
      console.error('加载治理数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (proposalId, support) => {
    if (votingInProgress[proposalId]) return;
    
    setVotingInProgress(prev => ({ ...prev, [proposalId]: true }));
    try {
      const tx = await contract.vote(proposalId, support);
      await tx.wait();
      alert(`投票成功！${support ? '赞成' : '反对'}`);
      await loadGovernanceData();
    } catch (error) {
      alert('投票失败: ' + error.message);
    } finally {
      setVotingInProgress(prev => ({ ...prev, [proposalId]: false }));
    }
  };

  const handleCreateProposal = async () => {
    if (!newProposalTarget || !newProposalAmount) {
      alert('请填写完整信息');
      return;
    }
    if (!ethers.utils.isAddress(newProposalTarget)) {
      alert('请输入有效的地址');
      return;
    }
    
    setCreating(true);
    try {
      const amount = ethers.utils.parseEther(newProposalAmount);
      const tx = await contract.createProposal(newProposalTarget, amount);
      await tx.wait();
      alert('提案创建成功！');
      setShowCreateModal(false);
      setNewProposalTarget('');
      setNewProposalAmount('');
      await loadGovernanceData();
    } catch (error) {
      alert('创建提案失败: ' + error.message);
    } finally {
      setCreating(false);
    }
  };

  const formatAddress = (addr) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const formatTime = (timestamp) => {
    const now = Math.floor(Date.now() / 1000);
    const diff = Number(timestamp) + 7 * 24 * 60 * 60 - now;
    if (diff <= 0) return '已过期';
    const days = Math.floor(diff / 86400);
    const hours = Math.floor((diff % 86400) / 3600);
    if (days > 0) return `${days}天${hours}小时后结束`;
    return `${hours}小时后结束`;
  };

  if (!isMember) return null;

  return (
    <div className="mt-5 border-t border-gray-200 pt-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">🗳️</span>
          <h3 className="font-semibold text-gray-800">治理投票</h3>
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
            {memberCount} 成员
          </span>
        </div>
        {isProposer && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-2 py-1 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700"
          >
            + 创建提案
          </button>
        )}
      </div>
      
      {loading ? (
        <div className="text-center py-4 text-gray-500 text-sm">加载中...</div>
      ) : activeProposals.length === 0 ? (
        <div className="text-center py-4 text-gray-400 text-sm">暂无活跃提案</div>
      ) : (
        <div className="space-y-3">
          {activeProposals.map(proposal => (
            <div key={proposal.id} className="bg-gray-50 rounded-xl p-3">
              <div className="flex justify-between items-start mb-2">
                <div className="text-xs text-gray-500">提案 #{proposal.id}</div>
                <div className="text-xs text-gray-500">
                  所需票数: {proposal.requiredVotes}/{proposal.memberCountAtCreation}
                </div>
              </div>
              <div className="text-sm font-mono text-gray-700 mb-1">
                📤 {formatAddress(proposal.target)}
              </div>
              <div className="text-lg font-bold text-blue-600 mb-2">
                {parseFloat(proposal.amount).toFixed(2)} USDT
              </div>
              <div className="flex justify-between items-center mb-3">
                <div className="text-xs text-gray-500">
                  👍 {proposal.yesCount} / 👎 {proposal.noCount}
                </div>
                <div className="text-xs text-gray-500">
                  进度: {Math.floor((proposal.yesCount / proposal.requiredVotes) * 100)}%
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5 mb-3">
                <div 
                  className="bg-green-500 h-1.5 rounded-full" 
                  style={{ width: `${Math.min(100, (proposal.yesCount / proposal.requiredVotes) * 100)}%` }}
                ></div>
              </div>
              {votingStates[proposal.id] ? (
                <div className="text-center text-xs text-gray-400 py-1">已投票</div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleVote(proposal.id, true)}
                    disabled={votingInProgress[proposal.id]}
                    className="flex-1 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    👍 赞成
                  </button>
                  <button
                    onClick={() => handleVote(proposal.id, false)}
                    disabled={votingInProgress[proposal.id]}
                    className="flex-1 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    👎 反对
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      
      {/* 创建提案弹窗 */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full">
            <div className="p-5 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-bold">创建提案</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-500 text-xl">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-sm text-gray-600 mb-1 block">收款地址</label>
                <input
                  type="text"
                  value={newProposalTarget}
                  onChange={(e) => setNewProposalTarget(e.target.value)}
                  placeholder="0x..."
                  className="w-full p-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-1 block">金额 (USDT)</label>
                <input
                  type="number"
                  value={newProposalAmount}
                  onChange={(e) => setNewProposalAmount(e.target.value)}
                  placeholder="1000"
                  className="w-full p-2 border rounded-lg text-sm"
                />
              </div>
              <button
                onClick={handleCreateProposal}
                disabled={creating}
                className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {creating ? '创建中...' : '创建提案'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GovernancePanel;