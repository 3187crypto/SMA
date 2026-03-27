// src/i18n.js
// 多语言配置文件：繁體中文、English、Deutsch、Español

export const languages = [
  { code: 'zh-TW', name: '繁體中文', flag: '🇭🇰' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'es', name: 'Español', flag: '🇪🇸' }
];

export const translations = {
  // 繁體中文
  'zh-TW': {
    // 通用
    appName: '⛏️ 比特超級礦工',
    connect: '連接錢包',
    disconnect: '斷開',
    refresh: '刷新',
    copy: '複製',
    copied: '✓ 已複製',
    
    // 数据卡片
    usdtBalance: 'USDT餘額',
    smaBalance: 'SMA餘額',
    currentPrice: '當前價格',
    marketPrice: '市場價格',
    
    // 邀请码
    inviteCode: '邀請碼',
    generateInviteCode: '生成邀請碼',
    generating: '生成中...',
    
    // 我的资产
    myAssets: '我的資產',
    depositPrincipal: '存款本金',
    remainingPrincipal: '剩餘本金',
    pendingReward: '待領取',
    totalReward: '累計獎勵',
    claimReward: '領取獎勵',
    claiming: '領取中...',
    
    // 存款/提款
    deposit: '存款',
    withdraw: '提款',
    enterAmount: '輸入數量',
    depositing: '存款中...',
    withdrawing: '提款中...',
    
    // 绑定推荐
    bindReferral: '綁定推薦',
    bindReferralDesc: '綁定推薦（需支付0.001 BNB）',
    enterAddress: '輸入地址',
    binding: '綁定中...',
    
    // 团队网络
    teamNetwork: '團隊網絡',
    networkHashrate: '網絡總算力',
    
    // 节点
    becomeNode: '成為節點',
    nodeTitle: '🌟 成為SMA節點',
    nodeBenefits: '💎 節點權益：',
    nodeBenefit1: '交易稅分成：每筆買賣的60%稅收直接分給節點',
    nodeBenefit2: '挖礦業績獎勵：節點按挖礦量獲得額外70%獎勵池',
    nodeBenefit3: '被動收入：無需操作，自動領取',
    nodeBenefit4: '稀缺權益：僅限99個節點，先到先得',
    nodePrice: '1000 USDT',
    nodeDesc: '鎖定節點身份，終身享受平台收益',
    nodeAgree: '我已閱讀並同意成為SMA節點，確認支付1000 USDT',
    nodeApply: '💎 立即申請，支付1000 USDT',
    nodeProcessing: '處理中...',
    nodeSuccess: '🎉 恭喜您成為SMA節點！節點權益將自動生效。',
    nodeAddressLabel: '支付USDT將發送至平台節點地址',
    
    // 邀请弹窗
    bindReferralModal: '綁定推薦',
    enterInviteCode: '輸入邀請碼，綁定推薦關係',
    inviteCodePlaceholder: '請輸入8位邀請碼',
    bind: '綁定',
    skip: '暫不綁定',
    
    // 矿池/节点标识
    miningPool: '礦池',
    nodeBadge: '節點',
    
    // 按钮状态
    maintenance: '維護中',
    success: '成功',
    failed: '失敗',
    
    // 提示信息
    pleaseConnectWallet: '請先連接錢包',
    pleaseEnterValidAddress: '請輸入有效地址',
    pleaseEnterInviteCode: '請輸入邀請碼',
    pleaseAgreeTerms: '請先閱讀並同意節點權益說明',
    depositSuccess: '存款成功！',
    depositFailed: '存款失敗：',
    withdrawSuccess: '提款成功！',
    withdrawFailed: '提款失敗：',
    claimSuccess: '領取獎勵成功！',
    claimFailed: '領取獎勵失敗：',
    bindSuccess: '綁定推薦成功！',
    bindFailed: '綁定推薦失敗：',
    generateCodeSuccess: '生成邀請碼成功！',
    generateCodeFailed: '生成邀請碼失敗：',
    copyFailed: '複製失敗，請手動複製：',
    paymentFailed: '支付失敗：',
    
    // SMA进度
    smaProgress: 'SMA進度',
    totalSupply: '總發行',
    
    // 其他
    loading: '加載中...',
    noMembers: '暫無團隊成員',
    inviteFriends: '邀請好友加入，共同成長！',
    close: '關閉'
  },

  // English (保持原有内容)
  'en': {
    appName: '⛏️ Bit Super Miner',
    connect: 'Connect Wallet',
    disconnect: 'Disconnect',
    refresh: 'Refresh',
    copy: 'Copy',
    copied: '✓ Copied',
    
    usdtBalance: 'USDT Balance',
    smaBalance: 'SMA Balance',
    currentPrice: 'Current Price',
    marketPrice: 'Market Price',
    
    inviteCode: 'Invite Code',
    generateInviteCode: 'Generate Invite Code',
    generating: 'Generating...',
    
    myAssets: 'My Assets',
    depositPrincipal: 'Deposit Principal',
    remainingPrincipal: 'Remaining Principal',
    pendingReward: 'Pending',
    totalReward: 'Total Rewards',
    claimReward: 'Claim Rewards',
    claiming: 'Claiming...',
    
    deposit: 'Deposit',
    withdraw: 'Withdraw',
    enterAmount: 'Enter amount',
    depositing: 'Depositing...',
    withdrawing: 'Withdrawing...',
    
    bindReferral: 'Bind Referral',
    bindReferralDesc: 'Bind Referral (0.001 BNB required)',
    enterAddress: 'Enter address',
    binding: 'Binding...',
    
    teamNetwork: 'Team Network',
    networkHashrate: 'Network Hashrate',
    
    becomeNode: 'Become Node',
    nodeTitle: '🌟 Become SMA Node',
    nodeBenefits: '💎 Node Benefits:',
    nodeBenefit1: 'Transaction Tax: 60% of trading fees distributed to nodes',
    nodeBenefit2: 'Mining Bonus: Extra 70% reward pool based on mining volume',
    nodeBenefit3: 'Passive Income: Auto-claim, no action needed',
    nodeBenefit4: 'Limited Spots: Only 99 nodes, first come first served',
    nodePrice: '1000 USDT',
    nodeDesc: 'Lock node status, lifetime platform benefits',
    nodeAgree: 'I have read and agree to become SMA Node, confirm payment of 1000 USDT',
    nodeApply: '💎 Apply Now, Pay 1000 USDT',
    nodeProcessing: 'Processing...',
    nodeSuccess: '🎉 Congratulations! You are now an SMA Node! Node benefits will be automatically activated.',
    nodeAddressLabel: 'Payment USDT will be sent to platform node address',
    
    bindReferralModal: 'Bind Referral',
    enterInviteCode: 'Enter invite code to bind referral',
    inviteCodePlaceholder: 'Enter 8-digit invite code',
    bind: 'Bind',
    skip: 'Skip',
    
    miningPool: 'Mining Pool',
    nodeBadge: 'Node',
    
    maintenance: 'Maintenance',
    success: 'Success',
    failed: 'Failed',
    
    pleaseConnectWallet: 'Please connect wallet first',
    pleaseEnterValidAddress: 'Please enter a valid address',
    pleaseEnterInviteCode: 'Please enter invite code',
    pleaseAgreeTerms: 'Please read and agree to the node terms',
    depositSuccess: 'Deposit successful!',
    depositFailed: 'Deposit failed: ',
    withdrawSuccess: 'Withdrawal successful!',
    withdrawFailed: 'Withdrawal failed: ',
    claimSuccess: 'Reward claimed successfully!',
    claimFailed: 'Claim failed: ',
    bindSuccess: 'Referral binding successful!',
    bindFailed: 'Referral binding failed: ',
    generateCodeSuccess: 'Invite code generated successfully!',
    generateCodeFailed: 'Failed to generate invite code: ',
    copyFailed: 'Copy failed, please copy manually: ',
    paymentFailed: 'Payment failed: ',
    
    smaProgress: 'SMA Progress',
    totalSupply: 'Total Supply',
    
    loading: 'Loading...',
    noMembers: 'No team members yet',
    inviteFriends: 'Invite friends to join and grow together!',
    close: 'Close'
  },

  // Deutsch (保留原有内容)
  'de': {
    appName: '⛏️ Bit Super Miner',
    connect: 'Wallet verbinden',
    disconnect: 'Trennen',
    refresh: 'Aktualisieren',
    copy: 'Kopieren',
    copied: '✓ Kopiert',
    
    usdtBalance: 'USDT Guthaben',
    smaBalance: 'SMA Guthaben',
    currentPrice: 'Aktueller Preis',
    marketPrice: 'Marktpreis',
    
    inviteCode: 'Einladungscode',
    generateInviteCode: 'Einladungscode generieren',
    generating: 'Generiere...',
    
    myAssets: 'Meine Vermögenswerte',
    depositPrincipal: 'Einzahlung',
    remainingPrincipal: 'Restbetrag',
    pendingReward: 'Ausstehend',
    totalReward: 'Gesamtbelohnung',
    claimReward: 'Belohnung einfordern',
    claiming: 'Fordere ein...',
    
    deposit: 'Einzahlen',
    withdraw: 'Auszahlen',
    enterAmount: 'Betrag eingeben',
    depositing: 'Zahle ein...',
    withdrawing: 'Zahle aus...',
    
    bindReferral: 'Empfehlung binden',
    bindReferralDesc: 'Empfehlung binden (0.001 BNB erforderlich)',
    enterAddress: 'Adresse eingeben',
    binding: 'Binde...',
    
    teamNetwork: 'Team-Netzwerk',
    networkHashrate: 'Netzwerk-Hashrate',
    
    becomeNode: 'Node werden',
    nodeTitle: '🌟 SMA Node werden',
    nodeBenefits: '💎 Node-Vorteile:',
    nodeBenefit1: 'Transaktionssteuer: 60% der Handelsgebühren gehen an Nodes',
    nodeBenefit2: 'Mining-Bonus: Zusätzlicher 70% Belohnungspool basierend auf Mining-Menge',
    nodeBenefit3: 'Passives Einkommen: Automatische Auszahlung',
    nodeBenefit4: 'Begrenzte Plätze: Nur 99 Nodes, wer zuerst kommt',
    nodePrice: '1000 USDT',
    nodeDesc: 'Node-Status sichern, lebenslange Plattformvorteile',
    nodeAgree: 'Ich habe die Node-Bedingungen gelesen und stimme zu, 1000 USDT zu zahlen',
    nodeApply: '💎 Jetzt bewerben, 1000 USDT zahlen',
    nodeProcessing: 'Verarbeite...',
    nodeSuccess: '🎉 Glückwunsch! Sie sind jetzt ein SMA Node! Node-Vorteile werden automatisch aktiviert.',
    nodeAddressLabel: 'Zahlung USDT wird an die Node-Adresse gesendet',
    
    bindReferralModal: 'Empfehlung binden',
    enterInviteCode: 'Einladungscode eingeben',
    inviteCodePlaceholder: '8-stelligen Einladungscode eingeben',
    bind: 'Binden',
    skip: 'Überspringen',
    
    miningPool: 'Mining-Pool',
    nodeBadge: 'Node',
    
    maintenance: 'Wartung',
    success: 'Erfolg',
    failed: 'Fehlgeschlagen',
    
    pleaseConnectWallet: 'Bitte zuerst Wallet verbinden',
    pleaseEnterValidAddress: 'Bitte gültige Adresse eingeben',
    pleaseEnterInviteCode: 'Bitte Einladungscode eingeben',
    pleaseAgreeTerms: 'Bitte lesen und akzeptieren Sie die Node-Bedingungen',
    depositSuccess: 'Einzahlung erfolgreich!',
    depositFailed: 'Einzahlung fehlgeschlagen: ',
    withdrawSuccess: 'Auszahlung erfolgreich!',
    withdrawFailed: 'Auszahlung fehlgeschlagen: ',
    claimSuccess: 'Belohnung erfolgreich eingefordert!',
    claimFailed: 'Einfordern fehlgeschlagen: ',
    bindSuccess: 'Empfehlungsbindung erfolgreich!',
    bindFailed: 'Empfehlungsbindung fehlgeschlagen: ',
    generateCodeSuccess: 'Einladungscode erfolgreich generiert!',
    generateCodeFailed: 'Einladungscode-Generierung fehlgeschlagen: ',
    copyFailed: 'Kopieren fehlgeschlagen, bitte manuell kopieren: ',
    paymentFailed: 'Zahlung fehlgeschlagen: ',
    
    smaProgress: 'SMA Fortschritt',
    totalSupply: 'Gesamtmenge',
    
    loading: 'Laden...',
    noMembers: 'Noch keine Teammitglieder',
    inviteFriends: 'Laden Sie Freunde ein, um gemeinsam zu wachsen!',
    close: 'Schließen'
  },

  // Español (保留原有内容)
  'es': {
    appName: '⛏️ Bit Super Miner',
    connect: 'Conectar Wallet',
    disconnect: 'Desconectar',
    refresh: 'Actualizar',
    copy: 'Copiar',
    copied: '✓ Copiado',
    
    usdtBalance: 'Saldo USDT',
    smaBalance: 'Saldo SMA',
    currentPrice: 'Precio Actual',
    marketPrice: 'Precio de Mercado',
    
    inviteCode: 'Código de Invitación',
    generateInviteCode: 'Generar Código',
    generating: 'Generando...',
    
    myAssets: 'Mis Activos',
    depositPrincipal: 'Depósito Principal',
    remainingPrincipal: 'Principal Restante',
    pendingReward: 'Pendiente',
    totalReward: 'Recompensa Total',
    claimReward: 'Reclamar Recompensa',
    claiming: 'Reclamando...',
    
    deposit: 'Depositar',
    withdraw: 'Retirar',
    enterAmount: 'Ingrese cantidad',
    depositing: 'Depositando...',
    withdrawing: 'Retirando...',
    
    bindReferral: 'Vincular Referido',
    bindReferralDesc: 'Vincular Referido (requiere 0.001 BNB)',
    enterAddress: 'Ingrese dirección',
    binding: 'Vinculando...',
    
    teamNetwork: 'Red de Equipo',
    networkHashrate: 'Hashrate de Red',
    
    becomeNode: 'Convertirse en Nodo',
    nodeTitle: '🌟 Convertirse en Nodo SMA',
    nodeBenefits: '💎 Beneficios de Nodo:',
    nodeBenefit1: 'Impuesto de Transacción: 60% de las tarifas de trading para nodos',
    nodeBenefit2: 'Bonificación de Minería: 70% extra según volumen minado',
    nodeBenefit3: 'Ingresos Pasivos: Reclamo automático',
    nodeBenefit4: 'Plazas Limitadas: Solo 99 nodos, primero en llegar',
    nodePrice: '1000 USDT',
    nodeDesc: 'Bloquee su estado de nodo, beneficios de por vida',
    nodeAgree: 'He leído y acepto convertirme en Nodo SMA, confirmo pago de 1000 USDT',
    nodeApply: '💎 Solicitar Ahora, Pagar 1000 USDT',
    nodeProcessing: 'Procesando...',
    nodeSuccess: '🎉 ¡Felicidades! Ahora es un Nodo SMA. Los beneficios se activarán automáticamente.',
    nodeAddressLabel: 'El pago USDT se enviará a la dirección del nodo',
    
    bindReferralModal: 'Vincular Referido',
    enterInviteCode: 'Ingrese código de invitación',
    inviteCodePlaceholder: 'Ingrese código de 8 dígitos',
    bind: 'Vincular',
    skip: 'Omitir',
    
    miningPool: 'Pool de Minería',
    nodeBadge: 'Nodo',
    
    maintenance: 'Mantenimiento',
    success: 'Éxito',
    failed: 'Falló',
    
    pleaseConnectWallet: 'Por favor conecte su wallet primero',
    pleaseEnterValidAddress: 'Por favor ingrese una dirección válida',
    pleaseEnterInviteCode: 'Por favor ingrese código de invitación',
    pleaseAgreeTerms: 'Por favor lea y acepte los términos del nodo',
    depositSuccess: '¡Depósito exitoso!',
    depositFailed: 'Depósito fallido: ',
    withdrawSuccess: '¡Retiro exitoso!',
    withdrawFailed: 'Retiro fallido: ',
    claimSuccess: '¡Recompensa reclamada con éxito!',
    claimFailed: 'Reclamo fallido: ',
    bindSuccess: '¡Vinculación exitosa!',
    bindFailed: 'Vinculación fallida: ',
    generateCodeSuccess: '¡Código generado con éxito!',
    generateCodeFailed: 'Error al generar código: ',
    copyFailed: 'Error al copiar, por favor copie manualmente: ',
    paymentFailed: 'Pago fallido: ',
    
    smaProgress: 'Progreso SMA',
    totalSupply: 'Suministro Total',
    
    loading: 'Cargando...',
    noMembers: 'Aún no hay miembros',
    inviteFriends: '¡Invita amigos a unirse y crecer juntos!',
    close: 'Cerrar'
  }
};

// 获取当前语言（从 localStorage 读取，默认繁体中文）
export const getCurrentLanguage = () => {
  const saved = localStorage.getItem('language');
  if (saved && translations[saved]) return saved;
  return 'zh-TW';
};

// 保存语言选择
export const setLanguage = (langCode) => {
  if (translations[langCode]) {
    localStorage.setItem('language', langCode);
    return true;
  }
  return false;
};

// 翻译函数
export const t = (langCode, key) => {
  const langData = translations[langCode];
  if (langData && langData[key] !== undefined) {
    return langData[key];
  }
  // 回退到繁体中文
  const fallback = translations['zh-TW'];
  return fallback[key] || key;
};