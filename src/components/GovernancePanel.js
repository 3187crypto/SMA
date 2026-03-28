// src/components/GovernancePanel.js
import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { getCurrentLanguage, t } from '../i18n';

const GovernancePanel = ({ contract, userAddress, isMember, isProposer }) => {
  const [loading, setLoading] = useState(true);
  const [currentLang] = useState(getCurrentLanguage());
  const [activeProposals, setActiveProposals] = useState([]);
  const [votingStates, setVotingStates] = useState({});
  const [memberCount, setMemberCount] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProposalTarget, setNewProposalTarget] = useState('');
  const [newProposalAmount, setNewProposalAmount] = useState('');
  const [creating, setCreating] = useState(false);
  const [votingInProgress, setVotingInProgress] = useState({});

  const tr = (key) => t(currentLang, key);

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
      alert(tr('voteSuccess') || `投票成功！${support ? tr('voteYes') : tr('voteNo')}`);
      await loadGovernanceData();
    } catch (error) {
      alert(tr('voteFailed') || '投票失败: ' + error.message);
    } finally {
      setVotingInProgress(prev => ({ ...prev, [proposalId]: false }));
    }
  };

  const handleCreateProposal = async () => {
    if (!newProposalTarget || !newProposalAmount) {
      alert(tr('pleaseFillAllFields') || '请填写完整信息');
      return;
    }
    if (!ethers.utils.isAddress(newProposalTarget)) {
      alert(tr('invalidAddress') || '请输入有效的地址');
      return;
    }
    
    setCreating(true);
    try {
      const amount = ethers.utils.parseEther(newProposalAmount);
      const tx = await contract.createProposal(newProposalTarget, amount);
      await tx.wait();
      alert(tr('proposalCreated') || '提案创建成功！');
      setShowCreateModal(false);
      setNewProposalTarget('');
      setNewProposalAmount('');
      await loadGovernanceData();
    } catch (error) {
      alert(tr('createProposalFailed') || '创建提案失败: ' + error.message);
    } finally {
      setCreating(false);
    }
  };

  const formatAddress = (addr) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  if (!isMember) return null;

  return (
    <div className="mt-5 border-t border-gray-200 pt-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">🗳️</span>
          <h3 className="font-semibold text-gray-800">{tr('governanceTitle')}</h3>
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
            {memberCount} {tr('memberCountText')}
          </span>
        </div>
        {isProposer && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-2 py-1 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700"
          >
            + {tr('createProposal')}
          </button>
        )}
      </div>
      
      {loading ? (
        <div className="text-center py-4 text-gray-500 text-sm">{tr('loading')}</div>
      ) : activeProposals.length === 0 ? (
        <div className="text-center py-4 text-gray-400 text-sm">{tr('noActiveProposals')}</div>
      ) : (
        <div className="space-y-3">
          {activeProposals.map(proposal => (
            <div key={proposal.id} className="bg-gray-50 rounded-xl p-3">
              <div className="flex justify-between items-start mb-2">
                <div className="text-xs text-gray-500">{tr('proposalIdText')} #{proposal.id}</div>
                <div className="text-xs text-gray-500">
                  {tr('requiredVotes')}: {proposal.requiredVotes}/{proposal.memberCountAtCreation}
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
                  {Math.floor((proposal.yesCount / proposal.requiredVotes) * 100)}%
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5 mb-3">
                <div 
                  className="bg-green-500 h-1.5 rounded-full" 
                  style={{ width: `${Math.min(100, (proposal.yesCount / proposal.requiredVotes) * 100)}%` }}
                ></div>
              </div>
              {votingStates[proposal.id] ? (
                <div className="text-center text-xs text-gray-400 py-1">{tr('alreadyVoted')}</div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleVote(proposal.id, true)}
                    disabled={votingInProgress[proposal.id]}
                    className="flex-1 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    👍 {tr('voteYes')}
                  </button>
                  <button
                    onClick={() => handleVote(proposal.id, false)}
                    disabled={votingInProgress[proposal.id]}
                    className="flex-1 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    👎 {tr('voteNo')}
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
              <h3 className="text-lg font-bold">{tr('createProposalModal')}</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-500 text-xl">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-sm text-gray-600 mb-1 block">{tr('recipientAddress')}</label>
                <input
                  type="text"
                  value={newProposalTarget}
                  onChange={(e) => setNewProposalTarget(e.target.value)}
                  placeholder="0x..."
                  className="w-full p-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-1 block">{tr('amountUSDT')}</label>
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
                {creating ? tr('creating') : tr('createProposal')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GovernancePanel;