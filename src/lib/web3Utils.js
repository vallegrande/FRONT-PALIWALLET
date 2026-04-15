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
  '57042': { name: 'zkSYS PoB Devnet', explorer: 'https://explorer-pob.dev11.top' },
  '57057': { name: 'zkSYS Testnet', explorer: 'https://explorer-zk.tanenbaum.io' },
  '560048': { name: 'Ethereum Hoodi', explorer: 'https://hoodi.etherscan.io' },
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

  // Check for Pali Wallet first (separate from window.ethereum)
  if (window.pali?.ethereum) {
    providers.push({ name: 'Pali Wallet', raw: window.pali.ethereum });
  }

  // Check for other standard providers
  const eth = window.ethereum;
  if (eth) {
    // If multiple providers exist (e.g., when both MetaMask and Coinbase are installed)
    if (Array.isArray(eth.providers) && eth.providers.length > 0) {
      eth.providers.forEach((p) => {
        const name = getProviderName(p);
        // Avoid duplicates (check if already added as Pali)
        const isDuplicate = providers.some(existing => existing.raw === p);
        if (!isDuplicate) {
          providers.push({ name, raw: p });
        }
      });
    } else {
      // Single provider - check if not already added
      const name = getProviderName(eth);
      const isDuplicate = providers.some(existing => existing.raw === eth);
      if (!isDuplicate) {
        providers.push({ name, raw: eth });
      }
    }
  }

  // Check for other known wallet extensions
  if (window.coinbaseWalletExtension && !providers.some(p => p.raw === window.coinbaseWalletExtension)) {
    providers.push({ name: 'Coinbase Wallet', raw: window.coinbaseWalletExtension });
  }

  return providers;
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
export const networksAdd = {
  '1': { chainIdHex: '0x1', chainName: 'Ethereum Mainnet', rpcUrls: ['https://mainnet.infura.io/v3/'], nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, blockExplorerUrls: ['https://etherscan.io'] },
  '5': { chainIdHex: '0x5', chainName: 'Goerli Testnet', rpcUrls: ['https://rpc.ankr.com/eth_goerli'], nativeCurrency: { name: 'Goerli Ether', symbol: 'ETH', decimals: 18 }, blockExplorerUrls: ['https://goerli.etherscan.io'] },
  '137': { chainIdHex: '0x89', chainName: 'Polygon Mainnet', rpcUrls: ['https://polygon-rpc.com/'], nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 }, blockExplorerUrls: ['https://polygonscan.com'] },
  '80001': { chainIdHex: '0x13881', chainName: 'Polygon Mumbai', rpcUrls: ['https://rpc-mumbai.maticvigil.com/'], nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 }, blockExplorerUrls: ['https://mumbai.polygonscan.com'] },
  '56': { chainIdHex: '0x38', chainName: 'BSC Mainnet', rpcUrls: ['https://bsc-dataseed.binance.org/'], nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 }, blockExplorerUrls: ['https://bscscan.com'] },
  '5700': { chainIdHex: '0x1644', chainName: 'Rollux', rpcUrls: ['https://rpc.rollux.com'], nativeCurrency: { name: 'Syscoin', symbol: 'SYS', decimals: 18 }, blockExplorerUrls: ['https://explorer.rollux.com'] },
  '57': { chainIdHex: '0x39', chainName: 'Syscoin NEVM', rpcUrls: ['https://rpc.syscoin.org'], nativeCurrency: { name: 'Syscoin', symbol: 'SYS', decimals: 18 }, blockExplorerUrls: ['https://explorer.syscoin.org'] },
  '57000': { chainIdHex: '0xDEA8', chainName: 'Syscoin NEVM Testnet', rpcUrls: ['https://rpc.tanenbaum.io'], nativeCurrency: { name: 'Syscoin', symbol: 'SYS', decimals: 18 }, blockExplorerUrls: ['https://tanenbaum.io'] },
  '57042': { chainIdHex: '0xDED2', chainName: 'zkSYS PoB Devnet', rpcUrls: ['https://rpc-pob.dev11.top/'], nativeCurrency: { name: 'Syscoin', symbol: 'TSYS', decimals: 18 }, blockExplorerUrls: ['https://explorer-pob.dev11.top'] },
  '57057': { chainIdHex: '0xDEE1', chainName: 'zkSYS Testnet', rpcUrls: ['https://rpc-zk.tanenbaum.io/'], nativeCurrency: { name: 'Syscoin', symbol: 'TSYS', decimals: 18 }, blockExplorerUrls: ['https://explorer-zk.tanenbaum.io'] },
  '560048': { chainIdHex: '0x88BB0', chainName: 'Ethereum Hoodi', rpcUrls: ['https://0xrpc.io/hoodi'], nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, blockExplorerUrls: ['https://hoodi.etherscan.io'] },
  '11155111': { chainIdHex: '0xAA36A7', chainName: 'Sepolia Testnet', rpcUrls: ['https://ethereum-sepolia-rpc.publicnode.com/'], nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 }, blockExplorerUrls: ['https://sepolia.etherscan.io'] },
};
/**
 * Get available networks from the provider
 * @returns {Promise<Array<{chainId: string, name: string}>>}
 */
export async function getProviderNetworks(ethProvider) {
  if (!ethProvider) return null;

  try {
    // 1. Try Pali-specific API
    if (ethProvider.isPali) {
      // Priorice Syscoin/zkSYS/Rollux networks for Pali
      const syscoinNetworks = ['57', '5700', '57000', '57042', '57057', '560048'];

      try {
        const pali = window['pali'];
        if (pali?.getNetworks) {
          const pNetworks = await pali.getNetworks();
          if (pNetworks && pNetworks.length > 0) return pNetworks;
        }
      } catch (e) { }

      // Fallback: return our known Syscoin/Rollux networks + some defaults
      return syscoinNetworks.map(id => ({ chainId: id, name: networks[id]?.name || `Chain ${id}` }));
    }

    // 2. Try standard wallet_getEthereumChains
    try {
      const chains = await ethProvider.request({ method: 'wallet_getEthereumChains' });
      if (chains && Array.isArray(chains)) {
        return chains.map(c => ({
          chainId: String(parseInt(c.chainId, 16)),
          name: c.chainName || c.name
        }));
      }
    } catch (e) { }

  } catch (e) {
    console.log('Error getting provider networks:', e);
  }
  return null;
}

/**
 * Request account selection from the wallet
 * @returns {Promise<string[]>} Array of accounts
 */
export async function requestAccountSelection(ethProvider) {
  if (!ethProvider) return [];

  // Identify if it's Pali
  const isPali = ethProvider.isPali || (window.pali && ethProvider === window.pali.ethereum);

  try {
    // 1. Force the wallet to show its account selection/permission UI
    try {
      if (isPali) {
        // Pali specific manual switch trigger
        await ethProvider.request({ method: 'wallet_changeAccount' });
      } else {
        await ethProvider.request({
          method: 'wallet_requestPermissions',
          params: [{ eth_accounts: {} }]
        });
      }
    } catch (e) {
      console.warn('Selection trigger failed, falling back to requestAccounts:', e);
    }

    // 2. Get accounts (this will return whatever the user authorized)
    const accounts = await ethProvider.request({ method: 'eth_requestAccounts' });
    return accounts || [];
  } catch (e) {
    console.error('Error in requestAccountSelection:', e);
    // Silent fallback
    try {
      return await ethProvider.request({ method: 'eth_accounts' });
    } catch (e2) {
      return [];
    }
  }
}

/**
 * Filter networks to only show those available in wallet
 */
export function filterAvailableNetworks(availableChainIds, allNetworks) {
  if (!availableChainIds || availableChainIds.length === 0) return allNetworks;

  const filtered = {};
  availableChainIds.forEach(id => {
    const chainIdStr = String(id);
    if (allNetworks[chainIdStr]) {
      filtered[chainIdStr] = allNetworks[chainIdStr];
    }
  });

  return Object.keys(filtered).length > 0 ? filtered : allNetworks;
}

/**
 * Helper function to log detailed network add errors
 */
export function logNetworkAddError(error, chainId, params) {
  console.group('🔴 Error al agregar red');
  console.log('Chain ID:', chainId);
  console.log('Chain ID Hex:', params?.chainIdHex);
  console.log('Chain Name:', params?.chainName);
  console.log('RPC URLs:', params?.rpcUrls);
  console.log('Error Code:', error?.code);
  console.log('Error Message:', error?.message);
  console.log('Error Stack:', error?.stack);
  console.log('Full Error:', error);

  // Common error analysis
  if (error?.code === 4902) {
    console.log('⚠️ Análisis: La red no existe en la wallet y necesita ser agregada primero');
  } else if (error?.code === -32602) {
    console.log('⚠️ Análisis: Parámetros inválidos - verifica el chainId hex');
  } else if (error?.code === -32603) {
    console.log('⚠️ Análisis: Error interno del wallet - posiblemente la red ya existe o los datos son incorrectos');
  } else if (error?.message?.includes('user rejected')) {
    console.log('⚠️ Análisis: El usuario rechazó la solicitud');
  }
  console.groupEnd();

  return {
    code: error?.code,
    message: error?.message,
    chainId,
    chainIdHex: params?.chainIdHex,
    analysis: getErrorAnalysis(error?.code, error?.message)
  };
}

function getErrorAnalysis(code, message) {
  const analyses = {
    4902: 'La red no existe en la wallet y necesita ser agregada primero',
    '-32602': 'Parámetros inválidos - verifica el chainId hex',
    '-32603': 'Error interno del wallet - posiblemente la red ya existe o los datos son incorrectos',
    4001: 'Usuario rechazó la solicitud',
    '-32000': 'Error de RPC - verifica que el endpoint esté funcionando'
  };

  if (message?.toLowerCase().includes('user rejected')) return 'Usuario rechazó la solicitud';
  return analyses[code] || 'Error desconocido - revisa la consola para más detalles';
}

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

