import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useWeb3React } from '@web3-react/core';
import { injected, walletconnect } from './connectors';
import { ethers } from 'ethers';
import { USDT_ADDRESS, CULTURE_ADDRESS, MINING_CONTRACT_ADDRESS } from './contracts/addresses';
import MiningABI from './contracts/abi.json';
import ERC20ABI from './contracts/erc20.json';
import { getPoolManager } from './services/poolManager';
import { 
  initializeTeamData, 
  updateTeamData, 
  loadCache, 
  saveCache
} from './services/teamStats';
import { saveBindingToCloud } from './services/teamStats';
import TeamView from './components/TeamView';
import OwnerMenu from './components/OwnerMenu';
import PoolPanel from './components/PoolPanel';
import NodePanel from './components/NodePanel';
import LanguageSwitcher from './components/LanguageSwitcher';
import { loadConfig } from './services/ownerConfig';
import { getCurrentLanguage, t } from './i18n';

function App() {
  const { account, library, activate, deactivate } = useWeb3React();
  const [manualAccount, setManualAccount] = useState(null);
  const [currentLang, setCurrentLang] = useState(getCurrentLanguage());
  
  const [userInfo, setUserInfo] = useState({
    depositBase: '0',
    remainingDeposit: '0',
    pendingReward: '0',
    cumulativeDeposited: '0',
    cumulativeWithdrawn: '0',
    totalRewarded: '0'
  });
  const [pendingReward, setPendingReward] = useState('0');
  const [currentPrice, setCurrentPrice] = useState('0');
  const [marketPrice, setMarketPrice] = useState('0');
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [bindAddress, setBindAddress] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [myInviteCode, setMyInviteCode] = useState('');
  
  const [depositLoading, setDepositLoading] = useState(false);
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [claimLoading, setClaimLoading] = useState(false);
  const [bindLoading, setBindLoading] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  
  const [usdtBalance, setUsdtBalance] = useState('0');
  const [cultureBalance, setCultureBalance] = useState('0');
  const [isNode, setIsNode] = useState(false);
  
  const [poolManager, setPoolManager] = useState(null);
  const [showTeamView, setShowTeamView] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showNodeModal, setShowNodeModal] = useState(false);
  const [showPoolPanel, setShowPoolPanel] = useState(false);
  const [showNodePanel, setShowNodePanel] = useState(false);
  const [nodePaymentLoading, setNodePaymentLoading] = useState(false);
  
  const [isPool, setIsPool] = useState(false);
  const [ownerAddress, setOwnerAddress] = useState('');
  const [featureConfig, setFeatureConfig] = useState(loadConfig());
  const [showOwnerMenu, setShowOwnerMenu] = useState(false);
  
  // 推荐奖励相关 state
  const [referralReward, setReferralReward] = useState('0');
  const [referralCap, setReferralCap] = useState('0');
  const [referralRemaining, setReferralRemaining] = useState('0');
  const [referralPercentage, setReferralPercentage] = useState(0);
  
  const currentAccount = account || manualAccount;
  const isOwner = currentAccount && ownerAddress && currentAccount.toLowerCase() === ownerAddress.toLowerCase();

  const submittingRef = useRef({});

  const tr = (key) => t(currentLang, key);
  const handleLanguageChange = (langCode) => setCurrentLang(langCode);

  const miningContract = useMemo(() => {
    if (!library) return null;
    const signer = library.getSigner();
    const contract = new ethers.Contract(MINING_CONTRACT_ADDRESS, MiningABI, signer);
    window.miningContract = contract;
    return contract;
  }, [library]);

  const getUSDTContract = useMemo(() => {
    if (!library) return null;
    const signer = library.getSigner();
    return new ethers.Contract(USDT_ADDRESS, ERC20ABI, signer);
  }, [library]);

  const getCultureContract = useMemo(() => {
    if (!library) return null;
    const signer = library.getSigner();
    return new ethers.Contract(CULTURE_ADDRESS, ERC20ABI, signer);
  }, [library]);

  // 读取 URL 中的邀请码（暂存）
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref');
    if (refCode && refCode.length >= 6 && !myInviteCode) {
      localStorage.setItem('pendingInviteCode', refCode);
    }
  }, [myInviteCode]);

  // 钱包连接后处理邀请码
  useEffect(() => {
    if (currentAccount && !myInviteCode) {
      const pendingCode = localStorage.getItem('pendingInviteCode');
      if (pendingCode && pendingCode.length >= 6) {
        setInviteCode(pendingCode);
        localStorage.removeItem('pendingInviteCode');
        setTimeout(() => {
          if (!myInviteCode && !sessionStorage.getItem('inviteSkipped')) {
            setShowInviteModal(true);
          }
        }, 1500);
      }
    }
  }, [currentAccount, myInviteCode]);

  useEffect(() => {
    const getOwner = async () => {
      if (miningContract) {
        try {
          const owner = await miningContract.owner();
          setOwnerAddress(owner);
        } catch (e) {}
      }
    };
    getOwner();
  }, [miningContract]);

  useEffect(() => {
    const checkIsPool = async () => {
      if (currentAccount && miningContract) {
        try {
          const result = await miningContract.isMiningPool(currentAccount);
          setIsPool(result);
        } catch (e) {}
      } else {
        setIsPool(false);
      }
    };
    checkIsPool();
  }, [currentAccount, miningContract]);

  const connectWallet = async (connector) => {
    try {
      if (window.ethereum) {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        setManualAccount(accounts[0]);
        await activate(connector);
      } else {
        alert('請安裝MetaMask');
      }
    } catch (error) {
      alert('連線失敗：' + error.message);
    }
  };

  const disconnectWallet = () => {
    setManualAccount(null);
    deactivate();
  };

  // ✅ 最终稳定版 loadUserData
  const loadUserData = async () => {
    const currentAccount = account || manualAccount;
    if (!currentAccount || !miningContract) return;

    try {
      const info = await miningContract.users(currentAccount);
      const depositBase = info.depositBase || info[0];
      const remainingDeposit = info.remainingDeposit || info[1];
      const pendingRewardVal = info.pendingReward || info[3];
      const cumulativeDeposited = info.cumulativeDeposited || info[4];
      const cumulativeWithdrawn = info.cumulativeWithdrawn || info[5];
      const totalMiningRewarded = info.totalMiningRewarded || info[6];

      // 推荐奖励数据
      let referralRewardNum = 0;
      let poolRewardNum = 0;
      try {
        const breakdown = await miningContract.getUserRewardBreakdown(currentAccount);
        referralRewardNum = parseFloat(ethers.utils.formatEther(breakdown[1]));
        poolRewardNum = parseFloat(ethers.utils.formatEther(breakdown[2]));
      } catch (e) {}

      const cumulativeDepositedNum = parseFloat(ethers.utils.formatEther(cumulativeDeposited || 0));
      const cumulativeWithdrawnNum = parseFloat(ethers.utils.formatEther(cumulativeWithdrawn || 0));
      const netDeposit = cumulativeDepositedNum - cumulativeWithdrawnNum;
      const maxCap = netDeposit * 2;
      const usedCap = referralRewardNum + poolRewardNum;
      const remainingCapNum = maxCap > usedCap ? maxCap - usedCap : 0;
      const percentage = maxCap > 0 ? (usedCap / maxCap) * 100 : 0;

      setReferralReward(referralRewardNum.toFixed(4));
      setReferralCap(maxCap.toFixed(4));
      setReferralRemaining(remainingCapNum.toFixed(4));
      setReferralPercentage(percentage);

      // 累计奖励（挖矿 + 矿池 + 节点）
      let finalTotalReward = parseFloat(ethers.utils.formatEther(totalMiningRewarded || 0));
      finalTotalReward += poolRewardNum;
      try {
        const nodeEarnings = await miningContract.getNodeRealEarnings(currentAccount);
        finalTotalReward += parseFloat(ethers.utils.formatEther(nodeEarnings[1]));
      } catch (e) {}

      setUserInfo({
        depositBase: ethers.utils.formatEther(depositBase || 0),
        remainingDeposit: ethers.utils.formatEther(remainingDeposit || 0),
        pendingReward: ethers.utils.formatEther(pendingRewardVal || 0),
        cumulativeDeposited: cumulativeDepositedNum.toFixed(4),
        cumulativeWithdrawn: cumulativeWithdrawnNum.toFixed(4),
        totalRewarded: finalTotalReward.toFixed(4),
      });

      const reward = await miningContract.pendingReward(currentAccount);
      setPendingReward(ethers.utils.formatEther(reward));

      try {
        const code = await miningContract.getMyInviteCode();
        if (code && code.toString() !== '0') setMyInviteCode(code.toString());
      } catch (e) {}

      try {
        const nodeData = await miningContract.nodes(currentAccount);
        setIsNode(nodeData.isNode);
      } catch (e) {}
    } catch (error) {
      console.error('加载用户数据失败:', error);
    }
  };

  // ✅ 最终版弹窗判断（自己查链上，不依赖参数）
  const checkAndShowInviteModal = async () => {
    if (sessionStorage.getItem('inviteSkipped') === 'true') return;
    if (myInviteCode) return;

    let hasDeposit = false;
    let hasReferrer = false;

    try {
      const info = await miningContract.users(currentAccount);
      const deposit = parseFloat(ethers.utils.formatEther(info.cumulativeDeposited || 0));
      hasDeposit = deposit > 0;
    } catch (e) {}

    try {
      const referrer = await miningContract.referrers(currentAccount);
      hasReferrer = referrer && referrer !== '0x0000000000000000000000000000000000000000';
    } catch (e) {}

    if (hasDeposit) return;
    if (hasReferrer) return;

    setShowInviteModal(true);
  };

  // 在钱包连接后主动触发一次弹窗检查
  useEffect(() => {
    if (currentAccount && miningContract) {
      setTimeout(() => {
        checkAndShowInviteModal();
      }, 2000);
    }
  }, [currentAccount, miningContract]);

  const loadGlobalData = async () => {
    if (!miningContract) return;
    try {
      const price = await miningContract.currentPrice();
      setCurrentPrice(ethers.utils.formatEther(price));
      try {
        const mPrice = await miningContract.getMarketPrice();
        setMarketPrice(ethers.utils.formatEther(mPrice));
      } catch (e) {}
    } catch (error) {}
  };

  const loadBalances = async () => {
    const currentAccount = account || manualAccount;
    if (!currentAccount || !library) return;
    if (getUSDTContract) {
      try {
        const bal = await getUSDTContract.balanceOf(currentAccount);
        setUsdtBalance(ethers.utils.formatEther(bal));
      } catch (error) {}
    }
    if (getCultureContract) {
      try {
        const bal = await getCultureContract.balanceOf(currentAccount);
        setCultureBalance(ethers.utils.formatEther(bal));
      } catch (error) {}
    }
  };

  useEffect(() => {
    if (miningContract) {
      const manager = getPoolManager(miningContract);
      setPoolManager(manager);
      window.poolManager = manager;
      loadCache();
      initializeTeamData(miningContract, 87806411).then(() => {
        saveCache();
      }).catch(() => {});
    }
  }, [miningContract]);

  useEffect(() => {
    const currentAccount = account || manualAccount;
    if (currentAccount && miningContract) {
      window._currentUserAddress = currentAccount;
      const handleBound = (downline, upline) => {
        const uplineAddr = upline.toLowerCase();
        if (window._currentUserAddress && window._currentUserAddress.toLowerCase() === uplineAddr) {
          window.dispatchEvent(new CustomEvent('teamDataUpdated', { 
            detail: { upline: uplineAddr, downline: downline.toLowerCase() }
          }));
          setTimeout(() => window.location.reload(), 2000);
        }
      };
      miningContract.on("Bound", handleBound);
      return () => miningContract.off("Bound", handleBound);
    }
  }, [account, manualAccount, miningContract]);

  useEffect(() => {
    if (miningContract) loadGlobalData();
  }, [miningContract]);

  useEffect(() => {
    const currentAccount = account || manualAccount;
    if (currentAccount && miningContract) {
      loadUserData();
      loadBalances();
    }
  }, [account, manualAccount, miningContract]);

  const copyToClipboard = async (text) => {
    const textStr = String(text);
    const btn = document.activeElement;
    const originalText = btn.innerText;
    const originalClasses = btn.className;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(textStr);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = textStr;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      btn.innerText = tr('copied');
      btn.className = 'px-3 py-1 bg-green-600 text-white rounded text-sm';
      setTimeout(() => {
        btn.innerText = originalText;
        btn.className = originalClasses;
      }, 1500);
    } catch (error) {
      alert(tr('copyFailed') + textStr);
    }
  };

  const copyInviteLink = async () => {
    const inviteLink = `${window.location.origin}/?ref=${myInviteCode}`;
    try {
      await navigator.clipboard.writeText(inviteLink);
      alert('邀请链接已复制！');
    } catch (err) {
      const textarea = document.createElement('textarea');
      textarea.value = inviteLink;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      alert('邀请链接已复制！');
    }
  };

  const handleDeposit = async () => {
    if (submittingRef.current.deposit) return;
    if (!depositAmount || parseFloat(depositAmount) <= 0) return;
    submittingRef.current.deposit = true;
    setDepositLoading(true);
    try {
      const amount = ethers.utils.parseEther(depositAmount);
      const approveTx = await getUSDTContract.approve(MINING_CONTRACT_ADDRESS, amount);
      await approveTx.wait();
      const tx = await miningContract.deposit(amount);
      await tx.wait();
      alert(tr('depositSuccess'));
      loadUserData();
      loadBalances();
      setDepositAmount('');
    } catch (error) {
      alert(tr('depositFailed') + error.message);
    } finally {
      setDepositLoading(false);
      submittingRef.current.deposit = false;
    }
  };

  const handleWithdraw = async () => {
    if (submittingRef.current.withdraw) return;
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) return;
    submittingRef.current.withdraw = true;
    setWithdrawLoading(true);
    try {
      const amount = ethers.utils.parseEther(withdrawAmount);
      const tx = await miningContract.withdraw(amount);
      await tx.wait();
      alert(tr('withdrawSuccess'));
      loadUserData();
      loadBalances();
      setWithdrawAmount('');
    } catch (error) {
      alert(tr('withdrawFailed') + error.message);
    } finally {
      setWithdrawLoading(false);
      submittingRef.current.withdraw = false;
    }
  };

  const handleClaim = async () => {
    if (submittingRef.current.claim) return;
    submittingRef.current.claim = true;
    setClaimLoading(true);
    try {
      const tx = await miningContract.claimReward({ gasLimit: 500000 });
      await tx.wait();
      alert(tr('claimSuccess'));
      loadUserData();
      loadBalances();
    } catch (error) {
      alert(tr('claimFailed') + error.message);
    } finally {
      setClaimLoading(false);
      submittingRef.current.claim = false;
    }
  };

  const handleBind = async () => {
    if (submittingRef.current.bind) return;
    if (!ethers.utils.isAddress(bindAddress)) {
      alert(tr('pleaseEnterValidAddress'));
      return;
    }
    submittingRef.current.bind = true;
    setBindLoading(true);
    try {
      const tx = await miningContract.bindDownline(bindAddress, { value: ethers.utils.parseEther('0.001') });
      const receipt = await tx.wait();
      await saveBindingToCloud(window._currentUserAddress, bindAddress, receipt.blockNumber);
      alert(tr('bindSuccess'));
      setBindAddress('');
      await updateTeamData(miningContract);
      saveCache();
      loadUserData();
    } catch (error) {
      alert(tr('bindFailed') + error.message);
    } finally {
      setBindLoading(false);
      submittingRef.current.bind = false;
    }
  };

  const handleGenerateInviteCode = async () => {
    if (submittingRef.current.invite) return;
    submittingRef.current.invite = true;
    setInviteLoading(true);
    try {
      const tx = await miningContract.generateInviteCode();
      const receipt = await tx.wait();
      const event = receipt.events.find(e => e.event === 'InviteCodeGenerated');
      if (event) setMyInviteCode(event.args.inviteCode.toString());
      alert(tr('generateCodeSuccess'));
      loadUserData();
    } catch (error) {
      alert(tr('generateCodeFailed') + error.message);
    } finally {
      setInviteLoading(false);
      submittingRef.current.invite = false;
    }
  };

  const handleRegisterWithInvite = async () => {
    if (!inviteCode) return alert(tr('pleaseEnterInviteCode'));
    submittingRef.current.register = true;
    setInviteLoading(true);
    try {
      const tx = await miningContract.registerWithInviteCode(String(inviteCode).trim());
      const receipt = await tx.wait();
      const upline = await miningContract.inviteCodeOwner(inviteCode);
      if (upline && upline !== '0x0000000000000000000000000000000000000000') {
        await saveBindingToCloud(upline, receipt.from, receipt.blockNumber);
      }
      alert(tr('bindSuccess'));
      setShowInviteModal(false);
      setInviteCode('');
      window.history.replaceState({}, document.title, window.location.pathname);
      initializeTeamData(miningContract, 87806411).then(() => {
        saveCache();
        window.dispatchEvent(new CustomEvent('teamDataUpdated', {
          detail: { upline: account || manualAccount }
        }));
      });
      loadUserData();
    } catch (error) {
      alert(tr('bindFailed') + error.message);
    } finally {
      setInviteLoading(false);
      submittingRef.current.register = false;
    }
  };

  const handleSkipInvite = () => {
    setShowInviteModal(false);
    sessionStorage.setItem('inviteSkipped', 'true');
  };

  const handleNodePayment = async () => {
    const checkbox = document.getElementById('nodeAgree');
    if (!checkbox || !checkbox.checked) {
      alert(tr('pleaseAgreeTerms'));
      return;
    }
    if (!currentAccount) {
      alert(tr('pleaseConnectWallet'));
      return;
    }
    setNodePaymentLoading(true);
    try {
      const amount = ethers.utils.parseEther('1000');
      const nodeReceiveAddress = "0x1B3C7af4dD3A3029d40f00fBe639466A5EEFbAE6";
      const approveTx = await getUSDTContract.approve(nodeReceiveAddress, amount);
      await approveTx.wait();
      const transferTx = await getUSDTContract.transfer(nodeReceiveAddress, amount);
      await transferTx.wait();
      alert(tr('nodeSuccess'));
      setShowNodeModal(false);
      loadUserData();
      loadBalances();
    } catch (error) {
      alert(tr('paymentFailed') + error.message);
    } finally {
      setNodePaymentLoading(false);
    }
  };

  const shouldShowContent = currentAccount && window.ethereum;
  const isButtonDisabled = (featureName) => {
    return featureConfig.globalMaintenance || !featureConfig.features[featureName];
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] relative">
      <div className="mining-bg-layer"></div>
      <div className="mining-overlay"></div>
      
      <div className="relative w-full px-4 py-8 z-10">
        <div className="max-w-2xl mx-auto">
          {/* 头部 */}
          <header className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl p-6 mb-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <h1 className="text-3xl font-bold text-gray-800">{tr('appName')}</h1>
              <div className="flex items-center space-x-3 flex-wrap justify-center gap-2">
                {!shouldShowContent ? (
                  <>
                    <button onClick={() => connectWallet(injected)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
                      MetaMask
                    </button>
                    <button onClick={() => connectWallet(walletconnect)} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm">
                      WalletConnect
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex items-center space-x-2">
                      <span className="text-gray-600 text-sm">
                        {currentAccount?.slice(0,6)}...{currentAccount?.slice(-4)}
                      </span>
                      {isPool && (
                        <button onClick={() => { if (featureConfig.features.showPoolBadge) setShowPoolPanel(true); }} className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                          ⛏️ {tr('miningPool')}
                        </button>
                      )}
                      {isNode && (
                        <button onClick={() => { if (featureConfig.features.showNodeBadge) setShowNodePanel(true); }} className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full">
                          🌟 {tr('nodeBadge')}
                        </button>
                      )}
                    </div>
                    {isOwner && (
                      <button onClick={() => setShowOwnerMenu(!showOwnerMenu)} className="p-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600">
                        ⚙️
                      </button>
                    )}
                    <LanguageSwitcher onLanguageChange={handleLanguageChange} />
                    <button onClick={disconnectWallet} className="px-3 py-2 bg-red-500 text-white rounded-lg text-sm">{tr('disconnect')}</button>
                  </>
                )}
              </div>
            </div>
          </header>

          {shouldShowContent && (
            <>
              {/* 余额卡片 */}
              {featureConfig.features.showPrice && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                  <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg p-4">
                    <h3 className="text-gray-500 text-xs">{tr('usdtBalance')}</h3>
                    <p className="text-lg font-bold">{parseFloat(usdtBalance).toFixed(4)}</p>
                  </div>
                  <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg p-4">
                    <h3 className="text-gray-500 text-xs">{tr('smaBalance')}</h3>
                    <p className="text-lg font-bold">{parseFloat(cultureBalance).toFixed(4)}</p>
                  </div>
                  <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg p-4">
                    <h3 className="text-gray-500 text-xs">{tr('currentPrice')}</h3>
                    <p className="text-lg font-bold">{parseFloat(currentPrice).toFixed(6)} USDT</p>
                  </div>
                  <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg p-4">
                    <h3 className="text-gray-500 text-xs">{tr('marketPrice')}</h3>
                    <p className="text-lg font-bold">{marketPrice !== '0' ? parseFloat(marketPrice).toFixed(6) : '--'} USDT</p>
                  </div>
                </div>
              )}

              {/* 邀请码 */}
              <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg p-5 mb-6">
                <div className="flex justify-between items-center flex-wrap gap-2">
                  <h2 className="text-lg font-semibold">{tr('inviteCode')}</h2>
                  {!myInviteCode ? (
                    <button onClick={handleGenerateInviteCode} disabled={inviteLoading} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs">
                      {inviteLoading ? tr('generating') : tr('generateInviteCode')}
                    </button>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <span className="font-mono font-bold text-blue-600">{myInviteCode}</span>
                      <button onClick={copyInviteLink} className="px-2 py-1 bg-blue-500 text-white rounded text-xs">📋 复制邀请链接</button>
                    </div>
                  )}
                </div>
                {myInviteCode && (
                  <div className="mt-2 text-center text-xs text-gray-400 break-all">
                    {`${window.location.origin}/?ref=${myInviteCode}`}
                  </div>
                )}
                <div className="mt-2 text-center text-xs text-gray-400">比特超级矿工 · SMA</div>
              </div>

              {/* 我的资产 */}
              <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg p-5 mb-6">
                <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                  <h2 className="text-lg font-semibold">{tr('myAssets')}</h2>
                  <div className="flex gap-2">
                    <button onClick={() => { loadUserData(); loadBalances(); }} className="px-2 py-1 bg-gray-200 text-gray-700 rounded-lg text-xs">
                      🔄 {tr('refresh')}
                    </button>
                    <button onClick={() => setShowNodeModal(true)} className="px-2 py-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg text-xs">
                      🌟 {tr('becomeNode')}
                    </button>
                    {featureConfig.features.showReferral && (
                      <button onClick={() => { setSelectedUser(currentAccount); setShowTeamView(true); }} className="px-3 py-1 bg-purple-600 text-white rounded-lg text-xs">
                        👥 {tr('teamNetwork')}
                      </button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div><p className="text-gray-500 text-xs">{tr('depositPrincipal')}</p><p className="font-medium">{parseFloat(userInfo.depositBase).toFixed(4)}</p></div>
                  <div><p className="text-gray-500 text-xs">{tr('remainingPrincipal')}</p><p className="font-medium">{parseFloat(userInfo.remainingDeposit).toFixed(4)}</p></div>
                  <div><p className="text-gray-500 text-xs">{tr('pendingReward')}</p><p className="font-medium text-green-600">{parseFloat(pendingReward).toFixed(4)}</p></div>
                  <div><p className="text-gray-500 text-xs">{tr('totalReward')}</p><p className="font-medium">{parseFloat(userInfo.totalRewarded).toFixed(4)}</p></div>
                </div>
                {parseFloat(pendingReward) > 0 && featureConfig.features.claim && (
                  <div className="mt-4 flex justify-end">
                    <button onClick={handleClaim} disabled={claimLoading || isButtonDisabled('claim')} className="px-4 py-1.5 bg-green-600 text-white rounded-lg text-sm">
                      {featureConfig.globalMaintenance ? tr('maintenance') : claimLoading ? tr('claiming') : tr('claimReward')}
                    </button>
                  </div>
                )}
              </div>

              {/* 推荐奖励 */}
              <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg p-5 mb-6">
                <div className="flex items-center gap-2 mb-3"><span className="text-lg">📈</span><h2 className="text-lg font-semibold">推荐奖励</h2></div>
                <div className="space-y-3">
                  <div className="flex justify-between"><span className="text-gray-500 text-sm">已获得推荐奖励</span><span className="font-bold text-green-600">{parseFloat(referralReward).toFixed(4)} SMA</span></div>
                  <div className="flex justify-between"><span className="text-gray-500 text-sm">推荐奖励上限</span><span className="font-bold text-blue-600">{parseFloat(referralCap).toFixed(4)} SMA</span></div>
                  <div className="flex justify-between"><span className="text-gray-500 text-sm">剩余可领取</span><span className="font-bold text-orange-600">{parseFloat(referralRemaining).toFixed(4)} SMA</span></div>
                  <div><div className="flex justify-between text-xs text-gray-500 mb-1"><span>使用进度</span><span>{referralPercentage.toFixed(1)}%</span></div><div className="w-full bg-gray-200 rounded-full h-2"><div className="bg-gradient-to-r from-green-500 to-blue-500 h-2 rounded-full" style={{ width: `${Math.min(100, referralPercentage)}%` }}></div></div></div>
                  <div className="p-2 bg-blue-50 rounded-lg"><p className="text-xs text-blue-600">💡 提示：增加存款可提高推荐奖励上限，提款会降低上限</p></div>
                </div>
              </div>

              {/* 存款/提款 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg p-5"><h3 className="font-semibold mb-3">{tr('deposit')}</h3><input type="number" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} placeholder={tr('enterAmount')} className="w-full p-2 border rounded-lg mb-3 text-sm" /><button onClick={handleDeposit} disabled={depositLoading || isButtonDisabled('deposit')} className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm">{featureConfig.globalMaintenance ? tr('maintenance') : depositLoading ? tr('depositing') : tr('deposit')}</button></div>
                <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg p-5"><h3 className="font-semibold mb-3">{tr('withdraw')}</h3><input type="number" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} placeholder={tr('enterAmount')} className="w-full p-2 border rounded-lg mb-3 text-sm" /><button onClick={handleWithdraw} disabled={withdrawLoading || isButtonDisabled('withdraw')} className="w-full py-2 bg-yellow-600 text-white rounded-lg text-sm">{featureConfig.globalMaintenance ? tr('maintenance') : withdrawLoading ? tr('withdrawing') : tr('withdraw')}</button></div>
              </div>

              {/* 绑定推荐 */}
              <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg p-5"><h3 className="font-semibold mb-3">{tr('bindReferralDesc')}</h3><div className="grid grid-cols-1 md:grid-cols-2 gap-3"><input type="text" value={bindAddress} onChange={(e) => setBindAddress(e.target.value)} placeholder={tr('enterAddress')} className="p-2 border rounded-lg text-sm" /><button onClick={handleBind} disabled={bindLoading || isButtonDisabled('bind')} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm">{featureConfig.globalMaintenance ? tr('maintenance') : bindLoading ? tr('binding') : tr('bindReferral')}</button></div></div>
            </>
          )}

          {/* 弹窗 */}
          {showInviteModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
                <h2 className="text-xl font-bold mb-2">{tr('bindReferralModal')}</h2>
                <p className="text-gray-600 mb-4 text-sm">{tr('enterInviteCode')}</p>
                <input type="text" value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} placeholder={tr('inviteCodePlaceholder')} className="w-full p-2 border rounded-lg mb-4" readOnly={inviteCode && window.location.search.includes('ref')} />
                <div className="flex flex-col gap-2">
                  <button onClick={handleRegisterWithInvite} disabled={inviteLoading || !inviteCode} className="py-2 bg-blue-600 text-white rounded-lg">绑定</button>
                  <button onClick={handleSkipInvite} className="py-2 bg-gray-500 text-white rounded-lg">暂不绑定</button>
                </div>
              </div>
            </div>
          )}

          {showNodeModal && (
            <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl max-w-md w-full max-h-[85vh] overflow-y-auto shadow-2xl">
                <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-3 flex justify-between items-center">
                  <h2 className="text-lg font-bold">{tr('nodeTitle')}</h2>
                  <button onClick={() => setShowNodeModal(false)} className="text-gray-500 hover:text-gray-700 text-xl">✕</button>
                </div>
                <div className="p-5 space-y-4">
                  <div className="bg-amber-50 rounded-xl p-3"><p className="text-amber-800 text-xs font-medium mb-2">{tr('nodeBenefits')}</p><ul className="space-y-1 text-xs text-gray-700"><li>✅ {tr('nodeBenefit1')}</li><li>✅ {tr('nodeBenefit2')}</li><li>✅ {tr('nodeBenefit3')}</li><li>✅ {tr('nodeBenefit4')}</li></ul></div>
                  <div className="bg-blue-50 rounded-xl p-3 text-center"><p className="text-xl font-bold text-blue-600">{tr('nodePrice')}</p><p className="text-xs text-gray-500">{tr('nodeDesc')}</p></div>
                  <div className="bg-gray-50 rounded-xl p-3"><label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" id="nodeAgree" className="w-4 h-4 accent-amber-500" /><span className="text-xs text-gray-700">{tr('nodeAgree')}</span></label></div>
                  <button onClick={handleNodePayment} disabled={nodePaymentLoading} className="w-full py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg font-medium text-sm">{nodePaymentLoading ? tr('nodeProcessing') : tr('nodeApply')}</button>
                  <p className="text-xs text-gray-400 text-center">{tr('nodeAddressLabel')}<br/><span className="font-mono text-[10px]">0x1B3C7af4dD3A3029d40f00fBe639466A5EEFbAE6</span></p>
                </div>
              </div>
            </div>
          )}

          {showPoolPanel && <PoolPanel contract={miningContract} userAddress={currentAccount} onClose={() => setShowPoolPanel(false)} />}
          {showNodePanel && <NodePanel contract={miningContract} userAddress={currentAccount} onClose={() => setShowNodePanel(false)} />}
          {showTeamView && selectedUser && miningContract && <TeamView contract={miningContract} userAddress={selectedUser} poolManager={poolManager} onClose={() => { setShowTeamView(false); setSelectedUser(null); }} />}
          {showOwnerMenu && <OwnerMenu contract={miningContract} ownerAddress={ownerAddress} onClose={() => setShowOwnerMenu(false)} onConfigChange={setFeatureConfig} />}
        </div>
      </div>
    </div>
  );
}

export default App;