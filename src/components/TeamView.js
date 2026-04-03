import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';  // ✅ 添加这一行
import { getDirectDownlines, getTeamStats } from '../services/teamStats';

// ========================================
// 循环检测配置
// ========================================
const CIRCULAR_CONFIG = {
  MAX_DEPTH: 20,        // 最大检测深度（层数）
  WARNING_DEPTH: 8,     // 超过此深度显示警告
  DANGER_DEPTH: 12,     // 超过此深度显示危险警告
  ENABLED: true,        // 是否启用检测
};

const TeamView = ({ contract, userAddress, poolManager, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [teamStats, setTeamStats] = useState({ 
    reward: 0, 
    count: 0, 
    totalDeposit: 0, 
    activeCount: 0, 
    newToday: 0 
  });
  const [directDownlines, setDirectDownlines] = useState([]);
  const [expandedMap, setExpandedMap] = useState({});
  const [subMembersMap, setSubMembersMap] = useState({});
  const [circularWarnings, setCircularWarnings] = useState({});
  const [levelStats, setLevelStats] = useState({});

  // ========================================
  // 🛡️ 循环检测函数（支持任意深度）
  // ========================================
  const detectCircular = async (startAddress, targetAddress, maxDepth = CIRCULAR_CONFIG.MAX_DEPTH, visited = new Set()) => {
    // 1. 防止无限递归（深度限制）
    if (visited.size >= maxDepth) {
      console.warn(`⚠️ 检测深度已达 ${maxDepth} 层，停止追溯`);
      return { hasCircular: false, depth: visited.size, path: [] };
    }
    
    // 2. 防止自循环
    if (targetAddress.toLowerCase() === startAddress.toLowerCase()) {
      return { hasCircular: true, depth: 1, path: [targetAddress] };
    }
    
    // 3. 防止重复访问（已经查过的地址）
    if (visited.has(targetAddress.toLowerCase())) {
      return { hasCircular: true, depth: visited.size, path: Array.from(visited) };
    }
    visited.add(targetAddress.toLowerCase());
    
    try {
      // 获取上级地址
      const upline = await contract.referrers(targetAddress);
      
      // 没有上级，安全
      if (!upline || upline === '0x0000000000000000000000000000000000000000') {
        return { hasCircular: false, depth: visited.size, path: [] };
      }
      
      // 如果上级是起点地址 → 循环！
      if (upline.toLowerCase() === startAddress.toLowerCase()) {
        const path = Array.from(visited);
        path.push(upline);
        return { hasCircular: true, depth: visited.size + 1, path };
      }
      
      // 继续向上追溯
      const result = await detectCircular(startAddress, upline, maxDepth, visited);
      if (result.hasCircular) {
        result.path.unshift(targetAddress);
      }
      return result;
      
    } catch (error) {
      console.error('检测循环失败:', error);
      return { hasCircular: false, depth: visited.size, path: [] };
    }
  };

  // 计算层级统计
  const calculateLevelStats = (members, currentLevel = 1) => {
    const stats = {};
    const traverse = (membersList, level) => {
      if (!stats[level]) stats[level] = 0;
      stats[level] += membersList.length;
      membersList.forEach(member => {
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
      console.log('加载团队树，地址:', userAddress);
      
      const stats = await getTeamStats(contract, userAddress);
      const downlines = await getDirectDownlines(contract, userAddress);
      
      // 计算活跃成员（累计奖励 > 0 或存款 > 0）
      const activeMembers = downlines.filter(m => (m.totalRewarded || 0) > 0 || (m.depositBase || 0) > 0);
      
      // 🛡️ 检测每个下级是否有循环
      const warnings = {};
      for (const member of downlines) {
        const { hasCircular, depth, path } = await detectCircular(userAddress, member.address);
        if (hasCircular) {
          warnings[member.address] = { hasCircular: true, depth, path };
          console.warn(`⚠️ 检测到循环绑定: ${member.address} 深度 ${depth} 层`);
        }
      }
      setCircularWarnings(warnings);
      
      // 计算总存款（从合约获取）
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
        totalDeposit: totalDeposit,
        activeCount: activeMembers.length,
        newToday: 0 // 可以从 Supabase 获取
      });
      setDirectDownlines(downlines);
      
      // 计算层级统计
      const statsByLevel = calculateLevelStats(downlines);
      setLevelStats(statsByLevel);
      
    } catch (error) {
      console.error('加载团队树失败', error);
    } finally {
      setLoading(false);
    }
  }, [contract, userAddress]);

  useEffect(() => {
    const handleTeamUpdate = (event) => {
      console.log('🎉 检测到团队更新，重新加载...', event.detail);
      
      if (event.detail?.upline?.toLowerCase() === userAddress?.toLowerCase()) {
        console.log('当前地址是上级，立即刷新团队树');
        loadTeamData();
      }
    };

    window.addEventListener('teamDataUpdated', handleTeamUpdate);
    
    return () => {
      window.removeEventListener('teamDataUpdated', handleTeamUpdate);
    };
  }, [userAddress, loadTeamData]);

  useEffect(() => {
    if (contract && userAddress) {
      loadTeamData();
    }
  }, [contract, userAddress, loadTeamData]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (contract && userAddress) {
        console.log('定时刷新团队树...');
        loadTeamData();
      }
    }, 30000);
    
    return () => clearInterval(interval);
  }, [contract, userAddress, loadTeamData]);

  const toggleExpand = async (address) => {
    setExpandedMap(prev => ({
      ...prev,
      [address]: !prev[address]
    }));

    if (!subMembersMap[address]) {
      try {
        const subMembers = await getDirectDownlines(contract, address);
        
        // 🛡️ 检测下级是否有循环
        const warnings = { ...circularWarnings };
        for (const member of subMembers) {
          const { hasCircular, depth, path } = await detectCircular(userAddress, member.address);
          if (hasCircular && !warnings[member.address]) {
            warnings[member.address] = { hasCircular: true, depth, path };
            console.warn(`⚠️ 检测到循环绑定: ${member.address} 深度 ${depth} 层`);
          }
        }
        setCircularWarnings(warnings);
        
        setSubMembersMap(prev => ({ ...prev, [address]: subMembers }));
      } catch (error) {
        console.error('加载团队成员失败', error);
      }
    }
  };

  // 根据深度获取颜色和样式
  const getLevelStyle = (level) => {
    const colors = [
      'border-l-blue-500',
      'border-l-green-500',
      'border-l-yellow-500',
      'border-l-orange-500',
      'border-l-red-500',
    ];
    return colors[level % colors.length];
  };

  const getDepthWarning = (level) => {
    if (level >= CIRCULAR_CONFIG.DANGER_DEPTH) {
      return { text: '🔴 深度过深', class: 'bg-red-100 text-red-700' };
    }
    if (level >= CIRCULAR_CONFIG.WARNING_DEPTH) {
      return { text: `⚠️ 深度 ${level}`, class: 'bg-yellow-100 text-yellow-700' };
    }
    return null;
  };

  const renderMember = (member, level = 0) => {
    const isExpanded = expandedMap[member.address];
    const isMemberPool = member.isPool;
    const isMemberNode = member.isNode;
    const circular = circularWarnings[member.address];
    const subMembers = subMembersMap[member.address] || [];
    const depthWarning = getDepthWarning(level);
    const isActive = (member.totalRewarded || 0) > 0 || (member.depositBase || 0) > 0;

    return (
      <div key={member.address} className={`relative border-l-2 ${getLevelStyle(level)} pl-3 ml-2`}>
        <div className={`flex items-center justify-between p-3 rounded-lg mb-1 transition-all ${
          circular?.hasCircular ? 'bg-red-50 hover:bg-red-100 border border-red-300' : 
          isActive ? 'bg-green-50 hover:bg-green-100' : 'bg-gray-50 hover:bg-gray-100'
        }`}>
          <div className="flex items-center space-x-3 flex-wrap gap-2">
            {/* 层级显示 */}
            <span className="text-xs text-gray-400 w-8 font-mono">
              L{level}
            </span>
            
            {/* 展开/折叠按钮 */}
            {member.subCount > 0 ? (
              <button
                onClick={() => toggleExpand(member.address)}
                className="w-8 h-8 flex items-center justify-center text-gray-700 bg-gray-200 rounded hover:bg-gray-300"
              >
                {isExpanded ? '▼' : '▶'}
              </button>
            ) : (
              <div className="w-8 h-8" />
            )}
            
            <div className="flex flex-wrap items-center gap-1">
              <span className="font-mono text-sm">
                {member.address.slice(0, 6)}...{member.address.slice(-4)}
              </span>
              
              {/* 深度警告 */}
              {depthWarning && (
                <span className={`px-1.5 py-0.5 text-xs rounded ${depthWarning.class}`}>
                  {depthWarning.text}
                </span>
              )}
              
              {/* 循环警告 */}
              {circular?.hasCircular && (
                <span className="px-1.5 py-0.5 bg-red-500 text-white text-xs rounded-full animate-pulse" title={`循环路径: ${circular.path?.join(' → ')}`}>
                  ⚠️ 循环绑定 (深度 {circular.depth})
                </span>
              )}
              
              {/* 活跃标识 */}
              {isActive && !circular?.hasCircular && (
                <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-xs rounded">
                  🟢 活跃
                </span>
              )}
              
              {/* 矿池/节点标识 */}
              {isMemberPool && (
                <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded">
                  ⛏️ 矿池
                </span>
              )}
              {isMemberNode && (
                <span className="px-1.5 py-0.5 bg-purple-100 text-purple-800 text-xs rounded">
                  🌟 节点
                </span>
              )}
              
              <span className="text-xs text-gray-500">
                (成员: {member.subCount || 0}人)
              </span>
            </div>
          </div>
          
          <div className="text-sm font-medium text-green-600 whitespace-nowrap ml-2">
            {member.totalRewarded ? member.totalRewarded.toFixed(2) : '0.00'} USDT
          </div>
        </div>

        {isExpanded && (
          <div className="mt-1">
            {subMembers.length > 0 ? (
              subMembers.map(subMember => renderMember(subMember, level + 1))
            ) : (
              <div className="ml-12 text-sm text-gray-400 py-2">暂无团队成员</div>
            )}
          </div>
        )}
      </div>
    );
  };

  // 渲染层级统计
  const renderLevelStats = () => {
    const maxLevel = Math.max(...Object.keys(levelStats).map(Number), 0);
    if (maxLevel === 0) return null;
    
    return (
      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
        <div className="text-sm text-gray-600 mb-2">📊 层级分布</div>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: maxLevel }, (_, i) => i + 1).map(level => (
            <div key={level} className="text-xs bg-white px-2 py-1 rounded shadow-sm">
              L{level}: {levelStats[level] || 0}人
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-[95vw] md:max-w-5xl max-h-[85vh] overflow-hidden">
        
        {/* 头部 */}
        <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-gray-800">🌳 团队树</h2>
            {poolManager?.isPool(userAddress) && (
              <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-sm rounded-full">
                ⛏️ 矿池
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl w-8 h-8 flex items-center justify-center rounded hover:bg-gray-200">
            ✕
          </button>
        </div>

        {/* 团队业绩统计卡片 */}
        <div className="p-5 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="text-sm text-gray-500">🏆 总奖励</div>
              <div className="text-2xl font-bold text-blue-600">
                {loading ? '...' : teamStats.reward.toFixed(2)} USDT
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="text-sm text-gray-500">👥 团队成员</div>
              <div className="text-2xl font-bold text-purple-600">
                {loading ? '...' : teamStats.count} 人
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="text-sm text-gray-500">💰 团队总存款</div>
              <div className="text-2xl font-bold text-green-600">
                {loading ? '...' : teamStats.totalDeposit.toFixed(2)} USDT
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="text-sm text-gray-500">⚡ 活跃成员</div>
              <div className="text-2xl font-bold text-orange-600">
                {loading ? '...' : teamStats.activeCount} / {teamStats.count}
              </div>
            </div>
          </div>
          {renderLevelStats()}
        </div>

        {/* 团队树列表 */}
        <div className="p-5 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 220px)' }}>
          {loading ? (
            <div className="text-center py-12 text-gray-500">
              <div className="animate-spin w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
              加载团队树中...
            </div>
          ) : (
            <>
              {directDownlines.length > 0 ? (
                <div className="space-y-1">
                  {directDownlines.map(member => renderMember(member, 1))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <div className="text-4xl mb-3">🌱</div>
                  <div>暂无团队成员</div>
                  <div className="text-sm mt-2">邀请好友加入，共同成长！</div>
                </div>
              )}
            </>
          )}
        </div>

        {/* 底部 */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
          <div className="text-xs text-gray-400">
            {Object.keys(circularWarnings).length > 0 && (
              <span className="text-red-500">⚠️ 检测到 {Object.keys(circularWarnings).length} 个循环绑定</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};

export default TeamView;