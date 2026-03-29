import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { Web3ReactProvider } from '@web3-react/core';
import { ethers } from 'ethers';

// 自定义库函数，完全禁用 ENS
function getLibrary(provider) {
  // 创建 provider
  const library = new ethers.providers.Web3Provider(provider);
  
  // 方法1：直接设置 ensAddress 为 null
  library.ensAddress = null;
  
  // 方法2：重写 getResolver 方法，直接返回 null
  const originalGetResolver = library.getResolver;
  library.getResolver = async (name) => {
    // BSC 网络不支持 ENS，直接返回 null
    return null;
  };
  
  // 方法3：重写 resolveName，直接返回输入的地址
  const originalResolveName = library.resolveName;
  library.resolveName = async (name) => {
    // 如果已经是 0x 开头的地址，直接返回
    if (name && name.startsWith('0x') && name.length === 42) {
      return name;
    }
    // 否则返回 null（不进行 ENS 解析）
    return null;
  };
  
  return library;
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <Web3ReactProvider getLibrary={getLibrary}>
      <App />
    </Web3ReactProvider>
  </React.StrictMode>
);