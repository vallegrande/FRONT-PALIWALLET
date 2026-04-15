// Mapa de redes conocidas
export const networks = {
  '1': { name: 'Ethereum Mainnet', explorer: 'https://etherscan.io' },
  '5': { name: 'Goerli Testnet', explorer: 'https://goerli.etherscan.io' },
  '11155111': { name: 'Sepolia Testnet', explorer: 'https://sepolia.etherscan.io' },
  '137': { name: 'Polygon Mainnet', explorer: 'https://polygonscan.com' },
  '80001': { name: 'Polygon Mumbai', explorer: 'https://mumbai.polygonscan.com' },
  '56': { name: 'BSC Mainnet', explorer: 'https://bscscan.com' },
  '97': { name: 'BSC Testnet', explorer: 'https://testnet.bscscan.com' },
  '42161': { name: 'Arbitrum One', explorer: 'https://arbiscan.io' },
  '421613': { name: 'Arbitrum Goerli', explorer: 'https://goerli.arbiscan.io' },
  '10': { name: 'Optimism', explorer: 'https://optimistic.etherscan.io' },
  '5700': { name: 'Rollux', explorer: 'https://explorer.rollux.com' },
  '57': { name: 'Syscoin NEVM', explorer: 'https://explorer.syscoin.org' },
  '57000': { name: 'Syscoin NEVM Testnet', explorer: 'https://tanenbaum.io' },
};

export function getNetworkInfo(id) {
  return networks[String(id)] || { name: `Chain ${id}`, explorer: null };
}

export function getProviderName(ethProvider) {
  if (!ethProvider) return 'No provider';
  try {
    if (ethProvider.isPali) return 'Pali Wallet';
    if (ethProvider.isMetaMask) return 'MetaMask';
    if (ethProvider.isCoinbaseWallet) return 'Coinbase Wallet';
    if (ethProvider.isBraveWallet) return 'Brave Wallet';
    if (ethProvider.isTrust) return 'Trust Wallet';
    if (ethProvider._name) return ethProvider._name;
    if (ethProvider.constructor?.name) return ethProvider.constructor.name;
  } catch (e) {
    console.error('Error detecting provider name:', e);
  }
  return 'Unknown Provider';
}

export function detectAvailableProviders() {
  const providers = [];
  if (typeof window === 'undefined') return providers;

  const eth = window.ethereum;
  if (!eth) return providers;

  if (Array.isArray(eth.providers) && eth.providers.length > 0) {
    return eth.providers.map((p) => ({ name: getProviderName(p), raw: p }));
  }
  return [{ name: getProviderName(eth), raw: eth }];
}

export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Error copying:', err);
    return false;
  }
}

export function openInExplorer(address, chainId) {
  const netInfo = getNetworkInfo(chainId);
  if (netInfo.explorer && address) {
    window.open(`${netInfo.explorer}/address/${address}`, '_blank');
  }
}

/**
 * Parámetros para añadir redes EVM cuando faltan
 */
export const networksAdd = {
  '1': { chainIdHex: '0x1', chainName: 'Ethereum Mainnet', rpcUrls: ['https://mainnet.infura.io/v3/'], nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, blockExplorerUrls: ['https://etherscan.io'] },
  '5': { chainIdHex: '0x5', chainName: 'Goerli Testnet', rpcUrls: ['https://rpc.ankr.com/eth_goerli'], nativeCurrency: { name: 'Goerli Ether', symbol: 'ETH', decimals: 18 }, blockExplorerUrls: ['https://goerli.etherscan.io'] },
  '137': { chainIdHex: '0x89', chainName: 'Polygon Mainnet', rpcUrls: ['https://polygon-rpc.com/'], nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 }, blockExplorerUrls: ['https://polygonscan.com'] },
  '80001': { chainIdHex: '0x13881', chainName: 'Polygon Mumbai', rpcUrls: ['https://rpc-mumbai.maticvigil.com/'], nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 }, blockExplorerUrls: ['https://mumbai.polygonscan.com'] },
  '56': { chainIdHex: '0x38', chainName: 'BSC Mainnet', rpcUrls: ['https://bsc-dataseed.binance.org/'], nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 }, blockExplorerUrls: ['https://bscscan.com'] },
  '5700': { chainIdHex: '0x1644', chainName: 'Rollux', rpcUrls: ['https://rpc.rollux.com'], nativeCurrency: { name: 'Syscoin', symbol: 'SYS', decimals: 18 }, blockExplorerUrls: ['https://explorer.rollux.com'] },
  '57': { chainIdHex: '0x39', chainName: 'Syscoin NEVM', rpcUrls: ['https://rpc.syscoin.org'], nativeCurrency: { name: 'Syscoin', symbol: 'SYS', decimals: 18 }, blockExplorerUrls: ['https://explorer.syscoin.org'] },
  '57000': { chainIdHex: '0xDE90', chainName: 'Syscoin NEVM Testnet', rpcUrls: ['https://rpc.tanenbaum.io'], nativeCurrency: { name: 'Syscoin', symbol: 'SYS', decimals: 18 }, blockExplorerUrls: ['https://tanenbaum.io'] },
};

/**
 * Intenta obtener el balance con reintentos y detecta rate-limit RPC
 */
export async function getBalanceSafe(provider, addr, attempts = 3) {
  let lastErr = null;
  for (let i = 0; i < attempts; i++) {
    try {
      if (!provider) throw new Error('No provider disponible');
      return await provider.getBalance(addr);
    } catch (err) {
      lastErr = err;
      const msg = String(err?.message || err);
      if (
        msg.toLowerCase().includes('rate-limit') ||
        msg.toLowerCase().includes('cooldown') ||
        err?.code === -32603
      ) {
         throw new Error('RPC rate limit: modifica la URL RPC en la configuración de la red o inténtalo más tarde.');
      }
      const delay = 300 * Math.pow(2, i);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

