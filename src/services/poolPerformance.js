// src/services/poolPerformance.js
import { supabase } from '../supabaseClient';
import { ethers } from 'ethers';

// 配置
const BASE_REQUIREMENT = 1000;  // 基础要求 1000 SMA
const INCREMENT = 300;           // 每期递增 300 SMA
const CYCLE_DAYS = 45;           // 45天周期

// 递归获取伞下所有成员（排除下级矿池）
export const getDownlinesExcludingPools = async (contract, address, excludePools = new Set()) => {
  const downlines = await getDirectDownlines(contract, address);
  let totalMining = 0;
  const allMembers = [];
  
  for (const member of downlines) {
    // 如果下级是矿池，记录但不递归
    const isPool = await contract.isMiningPool(member.address);
    if (isPool) {
      excludePools.add(member.address);
      allMembers.push({ ...member, isPool: true, children: [] });
      continue;
    }
    
    // 普通成员：累加业绩并继续递归
    const userInfo = await contract.users(member.address);
    const miningReward = parseFloat(ethers.utils.formatEther(userInfo.totalMiningRewarded));
    totalMining += miningReward;
    
    const children = await getDownlinesExcludingPools(contract, member.address, excludePools);
    totalMining += children.totalMining;
    allMembers.push({ ...member, isPool: false, children: children.members });
  }
  
  return { totalMining, members: allMembers, excludePools };
};

// 获取矿池伞下总挖矿（排除下级矿池）
export const getPoolTeamMining = async (contract, poolAddress) => {
  const result = await getDownlinesExcludingPools(contract, poolAddress);
  return result.totalMining;
};

// 获取矿池的考核数据
export const getPoolPerformance = async (contract, poolAddress, poolData) => {
  const now = Math.floor(Date.now() / 1000);
  const lastRewardTime = await contract.lastPoolRewardTime(poolAddress);
  const ageDays = (now - Number(lastRewardTime)) / 86400;
  const periodsCompleted = Math.floor(ageDays / CYCLE_DAYS);
  const daysIntoCycle = ageDays % CYCLE_DAYS;
  const remainingDays = Math.max(0, CYCLE_DAYS - daysIntoCycle);
  
  // 获取矿池伞下总挖矿
  const teamMining = await getPoolTeamMining(contract, poolAddress);
  
  // 计算本期要求（如果有下级矿池，需要减去下级矿池的业绩）
  let baseRequirement = BASE_REQUIREMENT + periodsCompleted * INCREMENT;
  let adjustedRequirement = baseRequirement;
  let childPoolsDeduction = 0;
  
  // 如果有缓存的池数据，使用缓存的基数
  if (poolData && poolData.base_requirement) {
    adjustedRequirement = poolData.base_requirement + periodsCompleted * INCREMENT;
  }
  
  const isQualified = teamMining >= adjustedRequirement;
  
  return {
    poolAddress,
    teamMining: teamMining.toFixed(2),
    requirement: adjustedRequirement.toFixed(0),
    requirementBase: baseRequirement.toFixed(0),
    isQualified,
    periodsCompleted,
    remainingDays: Math.floor(remainingDays),
    daysIntoCycle: Math.floor(daysIntoCycle),
    lastRewardTime: Number(lastRewardTime),
    childPoolsDeduction
  };
};

// 获取所有矿池列表（从 Supabase 获取）
export const getAllPoolsFromDB = async () => {
  const { data, error } = await supabase
    .from('pool_performance')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('获取矿池列表失败:', error);
    return [];
  }
  return data || [];
};

// 保存矿池业绩数据到 Supabase
export const savePoolPerformance = async (poolAddress, performanceData) => {
  const { data, error } = await supabase
    .from('pool_performance')
    .upsert({
      pool_address: poolAddress,
      parent_pool: performanceData.parentPool || null,
      base_requirement: performanceData.baseRequirement || 1000,
      total_team_mining: parseFloat(performanceData.teamMining),
      period_start_time: performanceData.lastRewardTime,
      period_requirement: performanceData.requirement,
      periods_completed: performanceData.periodsCompleted,
      child_pools: performanceData.childPools || [],
      is_active: performanceData.isQualified !== false,
      last_sync_time: Math.floor(Date.now() / 1000)
    }, {
      onConflict: 'pool_address'
    });
  
  if (error) {
    console.error('保存矿池业绩失败:', error);
  }
  return data;
};

// 同步所有矿池数据
export const syncAllPools = async (contract) => {
  // 获取所有矿池地址（需要从历史事件获取或管理员手动录入）
  // 这里简化：从 Supabase 获取已有列表，然后从合约验证
  const existingPools = await getAllPoolsFromDB();
  const results = [];
  
  for (const pool of existingPools) {
    const isValid = await contract.isMiningPool(pool.pool_address);
    if (!isValid) {
      // 矿池已失效，标记为非活跃
      await supabase
        .from('pool_performance')
        .update({ is_active: false })
        .eq('pool_address', pool.pool_address);
      continue;
    }
    
    const performance = await getPoolPerformance(contract, pool.pool_address, pool);
    await savePoolPerformance(pool.pool_address, {
      ...performance,
      parentPool: pool.parent_pool,
      childPools: pool.child_pools
    });
    results.push(performance);
  }
  
  return results;
};

// 获取下级矿池列表
export const getChildPools = async (contract, poolAddress) => {
  // 从 Supabase 获取
  const { data, error } = await supabase
    .from('pool_performance')
    .select('pool_address, total_team_mining, period_requirement, is_active')
    .eq('parent_pool', poolAddress);
  
  if (error) return [];
  return data || [];
};

// 记录矿池业绩历史
export const logPerformanceHistory = async (poolAddress, action, oldRequirement, newRequirement, reason) => {
  const { error } = await supabase
    .from('pool_performance_history')
    .insert({
      pool_address: poolAddress,
      action_type: action,
      old_requirement: oldRequirement,
      new_requirement: newRequirement,
      reason: reason
    });
  
  if (error) console.error('记录历史失败:', error);
};

// 获取矿池健康度（含下级矿池信息）
export const getPoolHealth = async (contract, poolAddress) => {
  const poolData = await getPoolPerformance(contract, poolAddress);
  const childPools = await getChildPools(contract, poolAddress);
  
  return {
    ...poolData,
    childPools,
    hasChildPools: childPools.length > 0,
    warningMessage: !poolData.isQualified ? `业绩不达标！需达到 ${poolData.requirement} SMA` : null
  };
};