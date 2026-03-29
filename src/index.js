import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { ethers } from 'ethers';

// 禁用 ENS 解析（BSC 网络不支持 ENS）
const originalGetAddress = ethers.utils.getAddress;
ethers.utils.getAddress = (address) => {
  // 如果是地址格式，直接返回，不进行 ENS 解析
  if (address && address.startsWith('0x')) {
    return address;
  }
  return originalGetAddress(address);
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);