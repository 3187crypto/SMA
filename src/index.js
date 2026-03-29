import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { Web3ReactProvider } from '@web3-react/core';
import { ethers } from 'ethers';

// 自定义库函数，禁用 ENS
function getLibrary(provider) {
  const library = new ethers.providers.Web3Provider(provider);
  // 禁用 ENS 解析（BSC 网络不支持）
  library.ensAddress = null;
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