import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { getDirectDownlines, getTeamStats } from '../services/teamStats';

const CIRCULAR_CONFIG = {
  MAX_DEPTH: 20,
  WARNING_DEPTH: 8,
  DANGER_DEPTH: 12,
  ENABLED: true,
};

const TeamView = ({ contract, userAddress, poolManager, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [teamStats, setTeamStats] = useState({
    reward: 0,
    count: 0,
    totalDeposit: 0,
    activeCount: 0,
    newToday: 0,
  });
  const [directDownlines, setDirectDownlines] = useState([]);
  const [expandedMap, setExpandedMap] = useState({});
  const [subMembersMap, setSubMembersMap] = useState({});
  const [circularWarnings, setCircularWarnings] = useState({});
  const [levelStats, setLevelStats] = useState({});

  // ✅ 循环检测（只记录，不阻断渲染）
  const detectCircular = async (startAddress, targetAddress, maxDepth = CIRCULAR_CONFIG.MAX_DEPTH, visited = new Set()) => {
    if (visited.size >= maxDepth) return { hasCircular: false, depth: visited.size, path: [] };
    if (targetAddress.toLowerCase() === startAddress.toLowerCase()) return { hasCircular: true, depth: 1, path: [targetAddress] };
    if (visited.has(targetAddress.toLowerCase())) return { hasCircular: true, depth: visited.size, path: Array.from(visited) };
    visited.add(targetAddress.toLowerCase());

    try {
      const upline = await contract.referrers(targetAddress);
      if (!upline || upline === '0x0000000000000000000000000000000000000000')
        return { hasCircular: false, depth: visited.size, path: [] };
      if (upline.toLowerCase() === startAddress.toLowerCase()) {
        const path = Array.from(visited);
        path.push(upline);
        return { hasCircular: true, depth: visited.size + 1, path };
      }
      const result = await detectCircular(startAddress, upline, maxDepth, visited);
      if (result.hasCircular) result.path.unshift(targetAddress);
      return result;
    } catch (error) {
      return { hasCircular: false, depth: visited.size, path: [] };
    }
  };

  const calculateLevelStats = (members, currentLevel = 1) => {
    const stats = {};
    const traverse = (list, level) => {
      if (!stats[level]) stats[level] = 0;
      stats[level] += list.length;
      list.forEach(member => {
        if (subMembersMap[member.address] && expandedMap[member.address]) {
          traverse(subMembersMap[member.address], level + 1);
        }
      });
    };
    traverse(members, currentLevel);
    return stats;
  };

  const loadTeamData = useCallback(async () => {
    if (!contract || !userAddress) return;
    setLoading(true);
    try {
      const stats = await getTeamStats(contract, userAddress);
      const downlines = await getDirectDownlines(contract, userAddress);
      const activeMembers = downlines.filter(m => (m.totalRewarded || 0) > 0 || (m.depositBase || 0) > 0);

      const warnings = {};
      for (const member of downlines) {
        const { hasCircular, depth, path } = await detectCircular(userAddress, member.address);
        if (hasCircular) {
          warnings[member.address] = { hasCircular: true, depth, path };
        }
      }
      setCircularWarnings(warnings);

      let totalDeposit = 0;
      for (const member of downlines) {
        try {
          const userInfo = await contract.users(member.address);
          totalDeposit += parseFloat(ethers.utils.formatEther(userInfo.cumulativeDeposited));
        } catch (e) {}
      }

      setTeamStats({
        reward: stats.reward,
        count: stats.count,
        totalDeposit,
        activeCount: activeMembers.length,
        newToday: 0,
      });
      setDirectDownlines(downlines);
      setLevelStats(calculateLevelStats(downlines));
    } catch (error) {
      console.error('加载团队树失败', error);
    } finally {
      setLoading(false);
    }
  }, [contract, userAddress]);

  useEffect(() => {
    const handleTeamUpdate = (event) => {
      if (event.detail?.upline?.toLowerCase() === userAddress?.toLowerCase()) loadTeamData();
    };
    window.addEventListener('teamDataUpdated', handleTeamUpdate);
    return () => window.removeEventListener('teamDataUpdated', handleTeamUpdate);
  }, [userAddress, loadTeamData]);

  useEffect(() => {
    if (contract && userAddress) loadTeamData();
  }, [contract, userAddress, loadTeamData]);

  const toggleExpand = async (address) => {
    setExpandedMap(prev => ({ ...prev, [address]: !prev[address] }));
    if (!subMembersMap[address]) {
      try {
        const subMembers = await getDirectDownlines(contract, address);
        setSubMembersMap(prev => ({ ...prev, [address]: subMembers }));
      } catch (error) {
        console.error('加载下级失败', error);
      }
    }
  };

  const getLevelStyle = (level) => ['border-l-blue-500', 'border-l-green-500', 'border-l-yellow-500', 'border-l-orange-500', 'border-l-red-500'][level % 5];

  const renderMember = (member, level = 0) => {
    const isExpanded = expandedMap[member.address];
    const isMemberPool = member.isPool;
    const isMemberNode = member.isNode;
    const subMembers = subMembersMap[member.address] || [];
    const isActive = (member.totalRewarded || 0) > 0 || (member.depositBase || 0) > 0;

    return (
      <div key={member.address} className={`relative border-l-2 ${getLevelStyle(level)} pl-3 ml-2`}>
        <div className={`flex items-center justify-between p-3 rounded-lg mb-1 ${isActive ? 'bg-green-50' : 'bg-gray-50'}`}>
          <div className="flex items-center space-x-3 flex-wrap gap-2">
            <span className="text-xs text-gray-400 w-8">L{level}</span>
            {member.subCount > 0 ? (
              <button onClick={() => toggleExpand(member.address)} className="w-8 h-8 bg-gray-200 rounded">
                {isExpanded ? '▼' : '▶'}
              </button>
            ) : (
              <div className="w-8 h-8" />
            )}
            <span className="font-mono text-sm">
              {member.address.slice(0, 6)}...{member.address.slice(-4)}
            </span>
            {isMemberPool && <span className="text-xs bg-yellow-100 px-1 rounded">⛏️ 矿池</span>}
            {isMemberNode && <span className="text-xs bg-purple-100 px-1 rounded">🌟 节点</span>}
            <span className="text-xs text-gray-500">(成员: {member.subCount || 0})</span>
          </div>
          <div className="text-sm font-medium text-green-600">
            {member.totalRewarded ? member.totalRewarded.toFixed(2) : '0.00'} USDT
          </div>
        </div>
        {isExpanded && subMembers.length > 0 && (
          <div className="mt-1">{subMembers.map(m => renderMember(m, level + 1))}</div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 md:p-4">
      <div className="bg-white rounded-xl w-full max-w-[95vw] md:max-w-5xl max-h-[85vh] overflow-y-auto">
        {/* 头部 */}
        <div className="sticky top-0 bg-white z-10 p-5 border-b flex justify-between items-center bg-gradient-to-r from-blue-50 to-indigo-50">
          <h2 className="text-2xl font-bold">🌳 团队树</h2>
          <button onClick={onClose} className="text-2xl">✕</button>
        </div>

        {/* 统计卡片 */}
        <div className="p-5 bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="text-sm text-gray-500">🏆 总奖励</div>
              <div className="text-2xl font-bold text-blue-600">{loading ? '...' : teamStats.reward.toFixed(2)} SMA</div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="text-sm text-gray-500">👥 团队成员</div>
              <div className="text-2xl font-bold text-purple-600">{loading ? '...' : teamStats.count} 人</div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="text-sm text-gray-500">💰 团队总存款</div>
              <div className="text-2xl font-bold text-green-600">{loading ? '...' : teamStats.totalDeposit.toFixed(2)} USDT</div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="text-sm text-gray-500">⚡ 活跃成员</div>
              <div className="text-2xl font-bold text-orange-600">{loading ? '...' : teamStats.activeCount} / {teamStats.count}</div>
            </div>
          </div>
        </div>

        {/* 成员列表 */}
        <div className="p-5">
          {loading ? (
            <div className="text-center py-12">加载中...</div>
          ) : directDownlines.length > 0 ? (
            directDownlines.map(m => renderMember(m, 1))
          ) : (
            <div className="text-center py-12 text-gray-500">暂无团队成员</div>
          )}
        </div>

        {/* 底部 */}
        <div className="sticky bottom-0 bg-white p-4 border-t flex justify-end">
          <button onClick={onClose} className="px-5 py-2 bg-gray-500 text-white rounded-lg">关闭</button>
        </div>
      </div>
    </div>
  );
};

export default TeamView;