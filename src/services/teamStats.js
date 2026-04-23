// src/services/teamStats.js
import { supabase } from '../supabaseClient';
import { ethers } from 'ethers';

// 当前新合约地址
export const CURRENT_CONTRACT_ADDRESS = "0x03E333b86BB75575b5a1936193D21dCeeE413f5b";

// 缓存变量
let teamCache = new Map();
let lastCacheTime = 0;
const CACHE_DURATION = 60000; // 1分钟缓存

export const getDirectDownlines = async (contract, address) => {
  // ========== 缓存检查（30秒内不重复查询） ==========
  const cacheKey = `team_${address.toLowerCase()}`;
  try {
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      // 如果缓存时间在30秒以内，直接返回缓存数据
      if (Date.now() - timestamp < 300000) {
        console.log('使用缓存数据，共', data.length, '个下线');
        return data;
      }
    }
  } catch(e) {
    console.log('缓存读取失败:', e);
  }
  // ========== 缓存检查结束 ==========

  // 从 Supabase 查询下线地址列表
  const { data, error } = await supabase
    .from('team_bindings')
    .select('downline')
    .eq('upline', address.toLowerCase())
    .or(`contract_address.eq.${CURRENT_CONTRACT_ADDRESS},contract_address.is.null`);

  if (error || !data || data.length === 0) {
    return [];
  }

  // 并行查询所有下线的数据
  const [userInfos, isPools, isNodes, subCounts] = await Promise.all([
    Promise.all(data.map(row => contract.users(row.downline).catch(() => null))),
    Promise.all(data.map(row => contract.isMiningPool(row.downline).catch(() => false))),
    Promise.all(data.map(row => contract.nodes(row.downline).catch(() => ({ isNode: false })))),
    Promise.all(data.map(row => 
      supabase
        .from('team_bindings')
        .select('*', { count: 'exact', head: true })
        .eq('upline', row.downline)
        .eq('contract_address', CURRENT_CONTRACT_ADDRESS)
        .then(res => ({ count: res.count || 0 }))
        .catch(() => ({ count: 0 }))
    ))
  ]);

  // 组装结果
  const downlines = data.map((row, index) => ({
    address: row.downline,
    totalRewarded: userInfos[index] ? parseFloat(ethers.utils.formatEther(userInfos[index].totalMiningRewarded)) : 0,
    depositBase: userInfos[index] ? parseFloat(ethers.utils.formatEther(userInfos[index].depositBase)) : 0,
    isPool: isPools[index] || false,
    isNode: isNodes[index]?.isNode || false,
    subCount: subCounts[index]?.count || 0
  }));

  // ========== 保存到缓存 ==========
  try {
    sessionStorage.setItem(cacheKey, JSON.stringify({
      data: downlines,
      timestamp: Date.now()
    }));
  } catch(e) {
    console.log('缓存保存失败:', e);
  }
  // ========== 缓存保存结束 ==========

  return downlines;
};

export const getTeamStats = async (contract, address) => {
  // 递归统计所有下级
  const countTeam = async (addr) => {
    const { data, error } = await supabase
      .from('team_bindings')
      .select('downline')
      .eq('upline', addr.toLowerCase())
      .eq('contract_address', CURRENT_CONTRACT_ADDRESS);

    if (error || !data) return { reward: 0, count: 0 };

    let totalReward = 0;
    let totalCount = data.length;

    // 并行查询所有下线的用户信息
    const userInfos = await Promise.all(
      data.map(row => contract.users(row.downline).catch(() => null))
    );

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const userInfo = userInfos[i];
      if (userInfo) {
        totalReward += parseFloat(ethers.utils.formatEther(userInfo.totalMiningRewarded));
      }
      
      // 递归查询下级的下级
      const sub = await countTeam(row.downline);
      totalReward += sub.reward;
      totalCount += sub.count;
    }

    return { reward: totalReward, count: totalCount };
  };

  return countTeam(address);
};

// 保存绑定关系到云数据库
export const saveBindingToCloud = async (upline, downline, blockNumber) => {
  const cleanUpline = upline.toLowerCase();
  const cleanDownline = downline.toLowerCase();

  // 1️⃣ 先检查是否已存在（去重）
  const { data: existing, error: checkError } = await supabase
    .from('team_bindings')
    .select('id')
    .eq('upline', cleanUpline)
    .eq('downline', cleanDownline)
    .eq('contract_address', CURRENT_CONTRACT_ADDRESS);

  if (checkError) {
    console.error('检查绑定关系失败:', checkError);
    return;
  }

  if (existing && existing.length > 0) {
    console.log('⚠️ 绑定关系已存在，跳过写入');
    return;
  }

  // 2️⃣ 不存在才插入
  const { error: insertError } = await supabase
    .from('team_bindings')
    .insert({
      upline: cleanUpline,
      downline: cleanDownline,
      block_number: blockNumber,
      contract_address: CURRENT_CONTRACT_ADDRESS,
      created_at: new Date().toISOString()
    });

  if (insertError) {
    console.error('保存绑定关系失败:', insertError);
  } else {
    console.log('✅ 绑定关系已保存到云数据库');
  }
};

// 更新团队数据
export const updateTeamData = async (contract) => {
  // 获取所有绑定关系
  const { data, error } = await supabase
    .from('team_bindings')
    .select('*')
    .eq('contract_address', CURRENT_CONTRACT_ADDRESS);

  if (error) {
    console.error('获取绑定关系失败:', error);
    return;
  }

  // 重新计算团队统计
  const teamStats = new Map();
  for (const binding of data) {
  const upline = binding.upline;
  if (!teamStats.has(upline)) {
    teamStats.set(upline, { reward: 0, count: 0 });
  }
  const stats = teamStats.get(upline);
  stats.count++;
  
  // ✅ 修复：正确获取 userInfo
  try {
    const userInfo = await contract.users(binding.downline);
    stats.reward += parseFloat(ethers.utils.formatEther(userInfo.totalMiningRewarded));
  } catch (e) {
    console.error('获取用户信息失败:', binding.downline);
  }
  teamStats.set(upline, stats);
}

  // 保存到 team_stats 表
  for (const [address, stats] of teamStats.entries()) {
    const { error: upsertError } = await supabase
      .from('team_stats')
      .upsert({
        address: address,
        total_reward: stats.reward,
        member_count: stats.count,
        contract_address: CURRENT_CONTRACT_ADDRESS,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'address,contract_address'
      });

    if (upsertError) {
      console.error('保存团队统计失败:', upsertError);
    }
  }
};

// 初始化团队数据（从合约事件同步）
export const initializeTeamData = async (contract, fromBlock) => {
  console.log('🔄 开始初始化团队数据...');
  
  // 清空当前合约的旧数据
  const { error: deleteError } = await supabase
    .from('team_bindings')
    .delete()
    .eq('contract_address', CURRENT_CONTRACT_ADDRESS);

  if (deleteError) {
    console.error('清空旧数据失败:', deleteError);
  }

  // 获取当前区块号
  const currentBlock = await contract.provider.getBlockNumber();
  const startBlock = fromBlock || currentBlock - 100000; // 如果未指定，扫描最近10万块
  
  console.log(`扫描区块范围: ${startBlock} - ${currentBlock}`);
  
  // 获取 Bound 事件
  const filter = contract.filters.Bound();
  const events = await contract.queryFilter(filter, startBlock, currentBlock);
  
  console.log(`找到 ${events.length} 个绑定事件`);
  
  for (const event of events) {
    const downline = event.args.downline;
    const upline = event.args.upline;
    const blockNumber = event.blockNumber;
    
    await saveBindingToCloud(upline, downline, blockNumber);
  }
  
  // 更新团队统计
  await updateTeamData(contract);
  
  console.log('✅ 团队数据初始化完成');
};

// 加载缓存
export const loadCache = () => {
  try {
    const cached = localStorage.getItem('teamCache');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed.timestamp && Date.now() - parsed.timestamp < CACHE_DURATION) {
        teamCache = new Map(Object.entries(parsed.data));
        lastCacheTime = parsed.timestamp;
      }
    }
  } catch (e) {}
};

// 保存缓存
export const saveCache = () => {
  try {
    const cacheObj = Object.fromEntries(teamCache);
    localStorage.setItem('teamCache', JSON.stringify({
      timestamp: Date.now(),
      data: cacheObj
    }));
  } catch (e) {}
};

// 清除缓存
export const clearCache = () => {
  teamCache.clear();
  localStorage.removeItem('teamCache');
};