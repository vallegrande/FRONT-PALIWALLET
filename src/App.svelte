<script>
  import { onMount, onDestroy } from "svelte";
  import { BrowserProvider, formatEther, parseEther } from "ethers";
  import { 
    networks, 
    networksAdd, 
    getNetworkInfo, 
    getNetworkFamily,
    filterNetworksByFamily,
    getTransactionExplorerUrl,
    getProviderName, 
    getBalanceSafe,
    detectAvailableProviders as detectProviders,
    copyToClipboard,
    openInExplorer as openAddressInExplorer,
    getProviderNetworks,
    requestAccountSelection,
    filterAvailableNetworks,
    logNetworkAddError
  } from "./lib/web3Utils";

  // ===== STATE VARIABLES =====
  let address = $state(null);
  let balance = $state(null);
  let error = $state(null);
  let isConnecting = $state(false);
  let provider = $state(null);
  let chainId = $state(null);
  let chainName = $state(null);
  let blockNumber = $state(null);
  let signer = $state(null);
  let copied = $state(false);
  let networkLoading = $state(false);
  let selectedNetworkId = $state('');
  let selectedNetworkFamily = $state('utxo');
  let balancePollingTimer = null;

  // Multi-provider support
  let availableProviders = $state([]);
  let selectedProviderIndex = $state(0);
  let currentEthereumProvider = null;
  let accountsChangedHandler = null;

  // Available networks from wallet (filtered)
  let availableNetworks = $state(networks);

  // Account selection
  let availableAccounts = $state([]);
  let selectedAccountIndex = $state(0);

  // Reactive effect: update provider and balance when selected provider changes
  $effect(() => {
    const idx = selectedProviderIndex;
    if (availableProviders.length > 0 && availableProviders[idx]?.provider) {
      const newProvider = availableProviders[idx].provider;
      if (newProvider !== currentEthereumProvider) {
        currentEthereumProvider = newProvider;
        // Update the ethers provider if we have an address connected
        if (address && currentEthereumProvider) {
          provider = new BrowserProvider(currentEthereumProvider);
          // Re-attach event listeners
          if (accountsChangedHandler) {
            try {
              currentEthereumProvider.removeListener?.('accountsChanged', accountsChangedHandler);
            } catch (e) {}
          }
          accountsChangedHandler = (accounts) => handleAccountsChanged(accounts);
          if (typeof currentEthereumProvider.on === 'function') {
            currentEthereumProvider.on('accountsChanged', accountsChangedHandler);
          }
          // Refresh balance with new provider
          refreshBalance();
        }
      }
    }
  });

  // UI State
  let activeTab = $state('home');
  let toAddress = $state('');
  let sendAmount = $state('');
  let useContract = $state(false);
  let contractAddress = $state('');
  let contractData = $state('');
  let sending = $state(false);
  let txHash = $state(null);
  let txList = $state([]);

  // Animation state
  let scrollY = $state(0);
  let heroVisible = $state(false);
  let featuresVisible = $state(false);
  let ctaVisible = $state(false);

  function internalDetectProviders() {
    const detected = detectProviders();
    availableProviders = detected.map(p => ({ name: p.name, provider: p.raw }));
    if (availableProviders.length === 0) {
      availableProviders = [{ name: 'No provider detected', provider: null }];
    }
  }

  // Scroll animation handler
  function handleScroll() {
    scrollY = window.scrollY;
    
    // Trigger animations based on scroll position
    const hero = document.querySelector('.hero-section');
    const features = document.querySelector('.features-section');
    const cta = document.querySelector('.cta-section');
    
    if (hero) {
      const rect = hero.getBoundingClientRect();
      heroVisible = rect.top < window.innerHeight * 0.8;
    }
    if (features) {
      const rect = features.getBoundingClientRect();
      featuresVisible = rect.top < window.innerHeight * 0.8;
    }
    if (cta) {
      const rect = cta.getBoundingClientRect();
      ctaVisible = rect.top < window.innerHeight * 0.8;
    }
  }

  async function fetchNetworkInfo() {
    if (!provider) return;
    networkLoading = true;
    try {
      const network = await provider.getNetwork();
      chainId = network.chainId.toString();
      selectedNetworkId = chainId;
      selectedNetworkFamily = getNetworkFamily(chainId);
      const netInfo = getNetworkInfo(chainId);
      chainName = netInfo.name;
      const block = await provider.getBlockNumber();
      blockNumber = block;
    } catch (err) {
      console.error('Error fetching network info:', err);
    } finally {
      networkLoading = false;
    }
  }

  async function copyAddress() {
    if (!address) return;
    const success = await copyToClipboard(address);
    if (success) {
      copied = true;
      setTimeout(() => { copied = false; }, 2000);
    }
  }

  function stopBalancePolling() {
    if (balancePollingTimer) {
      clearInterval(balancePollingTimer);
      balancePollingTimer = null;
    }
  }

  function startBalancePolling() {
    stopBalancePolling();
    if (!address || !provider) return;
    balancePollingTimer = setInterval(() => {
      refreshBalance();
    }, 10000);
  }

  async function switchNetworkTo(chainIdKey) {
    if (!currentEthereumProvider) { error = 'No hay proveedor conectado para cambiar la red.'; return; }
    const params = networksAdd[String(chainIdKey)];
    if (!params) { error = 'Red no soportada para cambio automático.'; return; }
    try {
      await currentEthereumProvider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: params.chainIdHex }] });
      selectedNetworkId = String(chainIdKey);
      provider = new BrowserProvider(currentEthereumProvider);
      await fetchNetworkInfo();
      error = null;
    } catch (switchError) {
      const msg = String(switchError?.message || switchError);
      if (switchError?.code === 4902 || msg.toLowerCase().includes('4902') || msg.toLowerCase().includes('not found')) {
        try {
          await currentEthereumProvider.request({ method: 'wallet_addEthereumChain', params: [{ chainId: params.chainIdHex, chainName: params.chainName, rpcUrls: params.rpcUrls, nativeCurrency: params.nativeCurrency, blockExplorerUrls: params.blockExplorerUrls }] });
          selectedNetworkId = String(chainIdKey);
          provider = new BrowserProvider(currentEthereumProvider);
          await fetchNetworkInfo();
          error = null;
        } catch (addErr) {
          console.error('Error adding chain:', addErr);
          const errorDetails = logNetworkAddError(addErr, chainIdKey, params);
          error = `Error agregando red: ${errorDetails.analysis}`;
        }
      } else {
        console.error('Switch network error:', switchError);
        error = switchError?.message || 'Error cambiando la red.';
      }
    }
  }

  async function sendTransfer() {
    error = null;
    if (!signer) { error = 'Signer no disponible. Conecta la wallet primero.'; return; }
    if (!toAddress && !useContract) { error = 'Destino inválido.'; return; }
    sending = true;
    try {
      let tx;
      if (useContract) {
        if (!contractAddress || !contractData) { error = 'Proporcione la dirección del contrato y los datos (hex).'; sending = false; return; }
        tx = await signer.sendTransaction({ to: contractAddress, data: contractData });
      } else {
        if (!sendAmount) { error = 'Ingrese un monto válido.'; sending = false; return; }
        const value = parseEther(String(sendAmount));
        tx = await signer.sendTransaction({ to: toAddress, value });
      }
      await tx.wait();
      txHash = tx.hash;
      txList = [{ hash: txHash, to: tx.to, value: sendAmount || '0', network: chainId, explorerUrl: getTransactionExplorerUrl(chainId, txHash) }, ...txList];
      await refreshBalance();
    } catch (err) {
      console.error('Error sending tx:', err);
      error = err?.message || 'Error enviando la transacción.';
    } finally {
      sending = false;
    }
  }

  function openInExplorer() {
    openAddressInExplorer(address, chainId);
  }

  async function getSigner() {
    if (!provider) return;
    try {
      return await provider.getSigner();
    } catch (err) {
      console.error('Error getting signer:', err);
      return null;
    }
  }

  async function refreshBalance() {
    if (!address || !provider) return;
    try {
      error = null;
      const rawBalance = await getBalanceSafe(provider, address);
      balance = formatEther(rawBalance);
      await fetchNetworkInfo();
    } catch (err) {
      console.error(err);
      error = err.message || 'Error al refrescar balance';
    }
  }

  async function connectWallet() {
    isConnecting = true;
    error = null;
    try {
      // Re-detect providers fresh before connecting
      internalDetectProviders();

      // Identify which provider to use
      const idx = Math.max(0, Math.min(selectedProviderIndex, availableProviders.length - 1));
      const selectedProviderData = availableProviders[idx];
      
      if (!selectedProviderData || !selectedProviderData.provider) {
        error = 'No se detectó ninguna billetera. Por favor instala Pali Wallet u otra billetera Web3.';
        return;
      }

      currentEthereumProvider = selectedProviderData.provider;
      
      // If it's Pali, we might want to ensure we're using window.pali.ethereum specifically
      // but currentEthereumProvider already points to the correct raw provider.

      // Use our new helper to request account selection (shows wallet picker)
      const accounts = await requestAccountSelection(currentEthereumProvider);
      
      if (accounts && accounts.length > 0) {
        // Store all accounts the user shared
        availableAccounts = accounts.map((addr, idx) => ({ 
          address: addr, 
          index: idx, 
          name: `Cuenta ${idx + 1}` 
        }));
        
        // Let the user pick if there are multiple, or default to first
        selectedAccountIndex = 0;
        address = accounts[0];
        
        // Create BrowserProvider
        provider = new BrowserProvider(currentEthereumProvider);
        
        // Get available networks (filtered by provider)
        const providerNetworks = await getProviderNetworks(currentEthereumProvider);
        if (providerNetworks && providerNetworks.length > 0) {
          const chainIds = providerNetworks.map(n => n.chainId);
          // If we are on Pali, we want to make sure the current network is ALSO included 
          // even if it's not in the specific pali-recommended list
          const currentNet = await provider.getNetwork();
          const allRelevantChainIds = [...new Set([...chainIds, currentNet.chainId.toString()])];
          availableNetworks = filterAvailableNetworks(allRelevantChainIds, networks);
          selectedNetworkId = currentNet.chainId.toString();
          selectedNetworkFamily = getNetworkFamily(selectedNetworkId);
        } else {
          // If wallet doesn't report networks, default to all Syscoin networks if it's Pali
          if (currentEthereumProvider.isPali || (window.pali && currentEthereumProvider === window.pali.ethereum)) {
            availableNetworks = filterAvailableNetworks(['57', '5700', '57000', '57042', '57057', '560048'], networks);
            selectedNetworkFamily = 'utxo';
          } else {
            availableNetworks = networks; // Fallback to all if other wallet
            selectedNetworkFamily = 'evm';
          }
        }
        
        const rawBalance = await getBalanceSafe(provider, address);
        balance = formatEther(rawBalance);
        await fetchNetworkInfo();
        signer = await getSigner();
        startBalancePolling();

        // Attach event listeners after successful connection
        if (typeof currentEthereumProvider.on === 'function') {
          accountsChangedHandler = (accounts) => handleAccountsChanged(accounts);
          currentEthereumProvider.on('accountsChanged', accountsChangedHandler);
        }
      } else {
        error = 'No se encontraron cuentas. Por favor crea una cuenta en tu billetera.';
      }
    } catch (err) {
      console.error('Wallet connection error:', err);

      // Handle specific error codes
      if (err.code === 4100 || err.code === '4100') {
        error = 'Billetera bloqueada o no autorizada. Por favor desbloquea Pali Wallet y autoriza este sitio en Configuración > Trusted Sites.';
      } else if (err.code === 4001 || err.code === '4001') {
        error = 'Conexión rechazada por el usuario.';
      } else if (err.code === -32002) {
        error = 'Ya hay una solicitud de conexión pendiente. Revisa tu billetera.';
      } else if (err.code === -32603) {
        error = 'Error interno de la billetera. Intenta recargar la página.';
      } else {
        error = err.message || 'Error al conectar la billetera.';
      }
    } finally {
      isConnecting = false;
    }
  }

  function disconnectWallet() {
    if (currentEthereumProvider && accountsChangedHandler) {
      try {
        currentEthereumProvider.removeListener('accountsChanged', accountsChangedHandler);
      } catch (e) {
        console.error('Error removing listener:', e);
      }
      accountsChangedHandler = null;
    }
    address = null;
    balance = null;
    error = null;
    isConnecting = false;
    provider = null;
    currentEthereumProvider = null;
    stopBalancePolling();
  }

  async function switchAccount() {
    error = null;
    try {
      if (!currentEthereumProvider) {
        error = 'No hay proveedor Web3 conectado.';
        return;
      }
      // Refresh provider to avoid stale network/account errors
      provider = new BrowserProvider(currentEthereumProvider);

      // Use selected account from availableAccounts
      const selectedAccount = availableAccounts[selectedAccountIndex];
      if (!selectedAccount) {
        error = 'Cuenta seleccionada no válida.';
        return;
      }
      address = selectedAccount.address;
      await refreshBalance();
      signer = await getSigner();
    } catch (err) {
      console.error(err);
      error = err.message || 'Error al cambiar de cuenta.';
    }
  }

  // Reactive effect: switch account when selectedAccountIndex changes
  $effect(() => {
    const idx = selectedAccountIndex;
    if (address && availableAccounts.length > 0 && availableAccounts[idx]?.address !== address) {
      switchAccount();
    }
  });

  async function handleAccountsChanged(accounts) {
    if (!accounts || accounts.length === 0) {
      disconnectWallet();
      return;
    }
    address = accounts[0];
    
    // Re-create provider to ensure it's fresh for the new account/network
    if (currentEthereumProvider) {
      provider = new BrowserProvider(currentEthereumProvider);
    }
    
    try {
      await refreshBalance();
      signer = await getSigner();
    } catch (e) {
      console.error('Error updating on accounts changed:', e);
    }
  }

  function handleChainChanged(chainIdHex) {
    console.log('Network changed:', chainIdHex);
    selectedNetworkId = String(parseInt(chainIdHex, 16));
    // Refresh the full state
    if (currentEthereumProvider) {
      provider = new BrowserProvider(currentEthereumProvider);
      refreshBalance();
      startBalancePolling();
    } else {
      window.location.reload(); // Hard reset if lost
    }
  }

  onMount(() => {
    internalDetectProviders();
    if (availableProviders.length > 0 && availableProviders[0]?.provider) {
      currentEthereumProvider = availableProviders[0].provider;
      try {
        accountsChangedHandler = (accounts) => handleAccountsChanged(accounts);
        if (typeof currentEthereumProvider.on === 'function') {
          currentEthereumProvider.on('accountsChanged', accountsChangedHandler);
          currentEthereumProvider.on('chainChanged', handleChainChanged);
        }
      } catch (e) {
        console.error('Error attaching listeners:', e);
      }
    }
    
    // Add scroll listener for animations
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    // Trigger initial animation
    setTimeout(() => {
      heroVisible = true;
    }, 100);
    
    // Initial scroll check
    handleScroll();
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  });

  onDestroy(() => {
    stopBalancePolling();
    if (currentEthereumProvider) {
      try {
        if (accountsChangedHandler) currentEthereumProvider.removeListener('accountsChanged', accountsChangedHandler);
        currentEthereumProvider.removeListener('chainChanged', handleChainChanged);
      } catch (e) {
        console.error('Error removing listener on destroy:', e);
      }
    }
  });
</script>

<style>
  /* Minimal custom styles - most styling via Tailwind classes */
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Space+Grotesk:wght@400;500;600;700&display=swap');

  :global(body) {
    margin: 0;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  }

  /* Keyframe animations */
  @keyframes bgFloat {
    0%, 100% { transform: translate(0, 0) rotate(0deg); }
    33% { transform: translate(2%, -2%) rotate(1deg); }
    66% { transform: translate(-1%, 1%) rotate(-1deg); }
  }

  @keyframes float {
    0%, 100% { transform: translate(0, 0) scale(1); }
    25% { transform: translate(50px, -50px) scale(1.1); }
    50% { transform: translate(-30px, 30px) scale(0.9); }
    75% { transform: translate(30px, 50px) scale(1.05); }
  }

  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(30px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(1.2); }
  }

  @keyframes logoPulse {
    0%, 100% { box-shadow: 0 0 20px rgba(0, 240, 255, 0.3); }
    50% { box-shadow: 0 0 40px rgba(0, 240, 255, 0.6); }
  }

  @keyframes shimmer {
    0% { left: -100%; }
    100% { left: 100%; }
  }

  @keyframes ctaGlow {
    0%, 100% { transform: translate(0, 0); }
    50% { transform: translate(10%, 10%); }
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Animation utilities */
  .animate-bg-float { animation: bgFloat 20s ease-in-out infinite; }
  .animate-float { animation: float 15s ease-in-out infinite; }
  .animate-fade-in-up { animation: fadeInUp 0.8s ease-out both; }
  .animate-pulse-slow { animation: pulse 2s ease-in-out infinite; }
  .animate-logo-pulse { animation: logoPulse 3s ease-in-out infinite; }
  .animate-shimmer::before { animation: shimmer 0.5s ease; }
  .animate-cta-glow::before { animation: ctaGlow 10s ease-in-out infinite; }
  .animate-spin { animation: spin 1s linear infinite; }

  /* Delay utilities */
  .delay-100 { animation-delay: 0.1s; }
  .delay-200 { animation-delay: 0.2s; }
  .delay-300 { animation-delay: 0.3s; }
  .delay-400 { animation-delay: 0.4s; }
  .delay-500 { animation-delay: -5s; }
  .delay-1000 { animation-delay: -10s; }

  /* Gradient text */
  .gradient-text {
    background: linear-gradient(135deg, #ffffff 0%, #a0a0a0 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  
  .gradient-text-accent {
    background: linear-gradient(135deg, #00f0ff 0%, #b829f7 50%, #00ff88 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  
  .gradient-bg {
    background: linear-gradient(135deg, #00f0ff 0%, #b829f7 50%, #00ff88 100%);
  }

  /* Shimmer effect for buttons */
  .btn-shimmer {
    position: relative;
    overflow: hidden;
  }
  
  .btn-shimmer::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
    transition: left 0.5s ease;
  }
  
  .btn-shimmer:hover::before {
    left: 100%;
  }

  /* CTA glow effect */
  .cta-glow::before {
    content: '';
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: radial-gradient(circle, rgba(0, 240, 255, 0.1) 0%, transparent 70%);
  }

  /* Scroll reveal - visible by default for better UX */
  .scroll-reveal {
    opacity: 1;
    transform: translateY(0);
    transition: all 0.8s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .scroll-reveal.visible {
    opacity: 1;
    transform: translateY(0);
  }

  .stagger-1 { transition-delay: 0.1s; }
  .stagger-2 { transition-delay: 0.2s; }
  .stagger-3 { transition-delay: 0.3s; }
  .stagger-4 { transition-delay: 0.4s; }
</style>

<!-- Animated Background -->
<div class="fixed inset-0 pointer-events-none z-0 overflow-hidden">
  <div class="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] animate-bg-float" style="background: radial-gradient(circle at 20% 80%, rgba(0, 240, 255, 0.03) 0%, transparent 40%), radial-gradient(circle at 80% 20%, rgba(184, 41, 247, 0.03) 0%, transparent 40%), radial-gradient(circle at 50% 50%, rgba(0, 255, 136, 0.02) 0%, transparent 50%);"></div>
</div>
<div class="fixed inset-0 pointer-events-none z-[1]" style="background-image: linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px); background-size: 60px 60px;"></div>

<main class="relative z-[2] w-full min-h-screen">
  <!-- Navigation -->
  <nav class="fixed top-0 left-0 right-0 z-[100] px-8 py-6 flex justify-between items-center backdrop-blur-xl border-b border-white/[0.08] transition-all duration-300" class:py-4={scrollY > 50} class:bg-[rgba(5,5,5,0.95)]={scrollY > 50} class:bg-[rgba(5,5,5,0.8)]={scrollY <= 50}>
    <div class="flex items-center gap-3 font-[Space_Grotesk] font-bold text-2xl text-white">
      <div class="w-10 h-10 gradient-bg rounded-xl flex items-center justify-center animate-logo-pulse">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
          <path d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      </div>
      <span>Pali</span>
    </div>
    <div class="flex items-center gap-10">
      <a href="#features" class="text-[#a0a0a0] text-sm font-medium hover:text-white transition-colors relative after:content-[''] after:absolute after:bottom-[-4px] after:left-0 after:w-0 after:h-[2px] after:bg-gradient-to-r after:from-[#00f0ff] after:via-[#b829f7] after:to-[#00ff88] after:transition-all hover:after:w-full">Características</a>
      <a href="#wallet" class="text-[#a0a0a0] text-sm font-medium hover:text-white transition-colors relative after:content-[''] after:absolute after:bottom-[-4px] after:left-0 after:w-0 after:h-[2px] after:bg-gradient-to-r after:from-[#00f0ff] after:via-[#b829f7] after:to-[#00ff88] after:transition-all hover:after:w-full" onclick={() => { activeTab = 'wallet'; document.getElementById('wallet')?.scrollIntoView({ behavior: 'smooth' }); }}>Billetera</a>
      <button class="gradient-bg text-black font-[Space_Grotesk] font-semibold px-6 py-2.5 rounded-xl text-sm btn-shimmer transition-all hover:-translate-y-[3px] hover:shadow-[0_20px_40px_rgba(0,240,255,0.3)]" onclick={() => { activeTab = 'wallet'; document.getElementById('wallet')?.scrollIntoView({ behavior: 'smooth' }); }}>
        {address ? 'Conectado' : 'Conectar Billetera'}
      </button>
    </div>
  </nav>

  <!-- Hero Section -->
  <section class="min-h-screen flex flex-col justify-center items-center text-center px-8 pt-32 pb-16 relative">
    <div class="absolute inset-0 overflow-hidden pointer-events-none">
      <div class="absolute w-[300px] h-[300px] rounded-full blur-[80px] opacity-40 animate-float bg-[#00f0ff] top-[20%] left-[10%]"></div>
      <div class="absolute w-[400px] h-[400px] rounded-full blur-[80px] opacity-40 animate-float bg-[#b829f7] bottom-[20%] right-[10%] delay-500"></div>
      <div class="absolute w-[250px] h-[250px] rounded-full blur-[80px] opacity-40 animate-float bg-[#00ff88] top-[50%] left-[50%] delay-1000"></div>
    </div>
    
    <div class="inline-flex items-center gap-2 px-4 py-2 bg-[rgba(0,240,255,0.1)] border border-[rgba(0,240,255,0.2)] rounded-full text-sm text-[#00f0ff] mb-8 animate-fade-in-up delay-100">
      <div class="w-1.5 h-1.5 bg-[#00f0ff] rounded-full animate-pulse-slow"></div>
      <span>Listo para Web3</span>
    </div>
    
    <h1 class="font-[Space_Grotesk] text-[clamp(3rem,8vw,6rem)] font-bold leading-tight mb-6 gradient-text animate-fade-in-up delay-200">
      El Futuro del
      <span class="gradient-text-accent">DeFi</span>
    </h1>
    
    <p class="text-[clamp(1.1rem,2.5vw,1.35rem)] text-[#a0a0a0] max-w-[600px] leading-relaxed mb-12 animate-fade-in-up delay-300">
      Conecta tu billetera, gestiona activos y ejecuta transacciones en múltiples cadenas EVM con una interfaz futurista y fluida.
    </p>
    
    <div class="flex gap-4 animate-fade-in-up delay-400">
      <button class="gradient-bg text-black font-[Space_Grotesk] font-semibold px-10 py-4 rounded-xl btn-shimmer transition-all hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(0,240,255,0.3)]" onclick={() => document.getElementById('wallet')?.scrollIntoView({ behavior: 'smooth' })}>
        Comenzar
      </button>
      <button class="bg-transparent border border-white/[0.08] text-white font-[Space_Grotesk] font-semibold px-10 py-4 rounded-xl transition-all hover:border-[#00f0ff] hover:bg-[rgba(0,240,255,0.05)] hover:-translate-y-1" onclick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}>
        Saber Más
      </button>
    </div>
  </section>

  <!-- Features Section -->
  <section id="features" class="py-32 px-8 max-w-[1400px] mx-auto">
    <div class="text-center mb-20 scroll-reveal" class:visible={featuresVisible}>
      <span class="inline-block px-4 py-1.5 bg-[rgba(184,41,247,0.1)] border border-[rgba(184,41,247,0.2)] rounded-full text-xs font-semibold text-[#b829f7] uppercase tracking-wider mb-4">Características</span>
      <h2 class="font-[Space_Grotesk] text-[clamp(2rem,5vw,3.5rem)] font-bold text-white">Todo lo que Necesitas</h2>
    </div>
    
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
      <div class="bg-[rgba(17,17,17,0.8)] border border-white/[0.08] rounded-3xl p-10 relative overflow-hidden backdrop-blur-xl transition-all duration-400 hover:border-[rgba(0,240,255,0.3)] hover:-translate-y-2 hover:shadow-[0_30px_60px_rgba(0,0,0,0.4)] group scroll-reveal stagger-1" class:visible={featuresVisible}>
        <div class="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#00f0ff] to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
        <div class="w-[60px] h-[60px] bg-[rgba(0,240,255,0.1)] rounded-2xl flex items-center justify-center mb-6 transition-all group-hover:bg-[rgba(0,240,255,0.2)] group-hover:scale-110">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00f0ff" stroke-width="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
        </div>
        <h3 class="font-[Space_Grotesk] text-xl font-semibold text-white mb-3">Soporte Multi-Cadena</h3>
        <p class="text-[#a0a0a0] leading-relaxed">Conecta con Ethereum, Polygon, BSC y otras cadenas EVM. Cambia de red automáticamente con detección de redes.</p>
      </div>
      
      <div class="bg-[rgba(17,17,17,0.8)] border border-white/[0.08] rounded-3xl p-10 relative overflow-hidden backdrop-blur-xl transition-all duration-400 hover:border-[rgba(0,240,255,0.3)] hover:-translate-y-2 hover:shadow-[0_30px_60px_rgba(0,0,0,0.4)] group scroll-reveal stagger-2" class:visible={featuresVisible}>
        <div class="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#00f0ff] to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
        <div class="w-[60px] h-[60px] bg-[rgba(0,240,255,0.1)] rounded-2xl flex items-center justify-center mb-6 transition-all group-hover:bg-[rgba(0,240,255,0.2)] group-hover:scale-110">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00f0ff" stroke-width="2">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
          </svg>
        </div>
        <h3 class="font-[Space_Grotesk] text-xl font-semibold text-white mb-3">Transacciones Instantáneas</h3>
        <p class="text-[#a0a0a0] leading-relaxed">Envía ETH y tokens con estimación de gas optimizada. Ejecuta llamadas a contratos con soporte de datos personalizados.</p>
      </div>
      
      <div class="bg-[rgba(17,17,17,0.8)] border border-white/[0.08] rounded-3xl p-10 relative overflow-hidden backdrop-blur-xl transition-all duration-400 hover:border-[rgba(0,240,255,0.3)] hover:-translate-y-2 hover:shadow-[0_30px_60px_rgba(0,0,0,0.4)] group scroll-reveal stagger-3" class:visible={featuresVisible}>
        <div class="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#00f0ff] to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
        <div class="w-[60px] h-[60px] bg-[rgba(0,240,255,0.1)] rounded-2xl flex items-center justify-center mb-6 transition-all group-hover:bg-[rgba(0,240,255,0.2)] group-hover:scale-110">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00f0ff" stroke-width="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>
        <h3 class="font-[Space_Grotesk] text-xl font-semibold text-white mb-3">Seguro por Diseño</h3>
        <p class="text-[#a0a0a0] leading-relaxed">Tus claves permanecen en tu billetera. Nunca almacenamos datos privados. Transparencia total con verificación blockchain.</p>
      </div>
      
      <div class="bg-[rgba(17,17,17,0.8)] border border-white/[0.08] rounded-3xl p-10 relative overflow-hidden backdrop-blur-xl transition-all duration-400 hover:border-[rgba(0,240,255,0.3)] hover:-translate-y-2 hover:shadow-[0_30px_60px_rgba(0,0,0,0.4)] group scroll-reveal stagger-4" class:visible={featuresVisible}>
        <div class="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#00f0ff] to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
        <div class="w-[60px] h-[60px] bg-[rgba(0,240,255,0.1)] rounded-2xl flex items-center justify-center mb-6 transition-all group-hover:bg-[rgba(0,240,255,0.2)] group-hover:scale-110">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00f0ff" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 6v6l4 2"/>
          </svg>
        </div>
        <h3 class="font-[Space_Grotesk] text-xl font-semibold text-white mb-3">Balance en Tiempo Real</h3>
        <p class="text-[#a0a0a0] leading-relaxed">Rastrea tu portafolio con actualizaciones en vivo. Visualiza el historial de transacciones y monitorea el estado de la red al instante.</p>
      </div>
    </div>
  </section>

  <!-- Developer Section -->
  <section id="developer" class="py-24 px-8 max-w-[1200px] mx-auto">
    <div class="bg-[rgba(17,17,17,0.8)] border border-white/[0.08] rounded-3xl p-12 backdrop-blur-xl scroll-reveal" class:visible={featuresVisible}>
      <div class="text-center mb-10">
        <span class="inline-block px-4 py-1.5 bg-[rgba(0,255,136,0.1)] border border-[rgba(0,255,136,0.2)] rounded-full text-xs font-semibold text-[#00ff88] uppercase tracking-wider mb-4">Equipo</span>
        <h2 class="font-[Space_Grotesk] text-3xl font-bold text-white">Sobre el Desarrollador</h2>
      </div>
      
      <div class="flex flex-col md:flex-row items-center gap-10 max-w-[800px] mx-auto">
        <div class="relative">
          <div class="w-40 h-40 rounded-2xl gradient-bg p-1">
            <img 
              src="/perfil.jpeg" 
              alt="Developer" 
              class="w-full h-full rounded-2xl object-cover"
            />
          </div>
          <div class="absolute -bottom-2 -right-2 w-10 h-10 bg-[#00ff88] rounded-full flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
        </div>
        
        <div class="text-center md:text-left">
          <h3 class="font-[Space_Grotesk] text-2xl font-bold text-white mb-2">Desarrollador Web3 Full-Stack</h3>
          <p class="text-[#00f0ff] font-medium mb-4">Especialista en Blockchain & Arquitecto de DApps</p>
          <p class="text-[#a0a0a0] leading-relaxed mb-6">
            Apasionado por construir aplicaciones descentralizadas que conectan las finanzas tradicionales 
            con Web3. Especializado en cadenas compatibles con EVM, integración de contratos inteligentes, 
            y creación de experiencias de usuario intuitivas para billeteras crypto.
          </p>
          <div class="flex flex-wrap gap-3 justify-center md:justify-start">
            <span class="px-3 py-1 bg-[rgba(0,240,255,0.1)] border border-[rgba(0,240,255,0.2)] rounded-full text-xs text-[#00f0ff]">Solidity</span>
            <span class="px-3 py-1 bg-[rgba(184,41,247,0.1)] border border-[rgba(184,41,247,0.2)] rounded-full text-xs text-[#b829f7]">Svelte</span>
            <span class="px-3 py-1 bg-[rgba(0,255,136,0.1)] border border-[rgba(0,255,136,0.2)] rounded-full text-xs text-[#00ff88]">Ethers.js</span>
            <span class="px-3 py-1 bg-[rgba(255,193,7,0.1)] border border-[rgba(255,193,7,0.2)] rounded-full text-xs text-[#ffc107]">Tailwind</span>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- Wallet Section -->
  <section id="wallet" class="py-24 px-8 max-w-[1200px] mx-auto">
    <div class="bg-[rgba(17,17,17,0.8)] border border-white/[0.08] rounded-3xl p-12 backdrop-blur-xl">
      <div class="text-center mb-8">
        <h2 class="font-[Space_Grotesk] text-3xl font-bold text-white mb-2">Panel de Billetera</h2>
        <p class="text-[#a0a0a0]">Conecta tu billetera para empezar a gestionar tus activos</p>
      </div>
      
      {#if !address}
        <div class="text-center py-12">
          {#if availableProviders.length > 0}
            <div class="mb-8 max-w-[400px] mx-auto">
              <label for="provider-select" class="block text-[#a0a0a0] text-sm uppercase tracking-wider font-semibold mb-3">Proveedor de Billetera Detectado</label>
              <div class="flex flex-col gap-3">
                {#each availableProviders as p, idx}
                  <button 
                    class="w-full px-6 py-4 rounded-2xl flex items-center justify-between transition-all duration-300 border {selectedProviderIndex === idx ? 'bg-[rgba(0,240,255,0.1)] border-[#00f0ff] shadow-[0_0_30px_rgba(0,240,255,0.2)]' : 'bg-[#111] border-white/[0.08] hover:border-white/20'}"
                    onclick={() => selectedProviderIndex = idx}
                  >
                    <div class="flex items-center gap-4">
                      <div class="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center shadow-lg">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                          <rect x="2" y="5" width="20" height="14" rx="2" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      </div>
                      <div class="text-left">
                        <div class="font-bold text-white text-lg leading-tight">{p.name}</div>
                        <div class="text-[#666] text-xs uppercase tracking-widest mt-0.5">EIP-1193 Compatible</div>
                      </div>
                    </div>
                    {#if selectedProviderIndex === idx}
                      <div class="flex items-center gap-2">
                        <span class="text-[#00f0ff] text-xs font-bold uppercase">Seleccionado</span>
                        <div class="w-2.5 h-2.5 rounded-full bg-[#00f0ff] animate-pulse"></div>
                      </div>
                    {/if}
                  </button>
                {/each}
              </div>
            </div>
          {:else}
            <div class="mb-8 p-6 bg-[rgba(239,68,68,0.05)] border border-[rgba(239,68,68,0.2)] rounded-2xl text-[#f87171]">
              <p class="font-semibold mb-2">No se detectaron proveedores Web3</p>
              <p class="text-xs opacity-80">Por favor, instala Pali Wallet para continuar.</p>
              <button class="mt-4 text-xs underline" onclick={internalDetectProviders}>Re-detectar billeteras</button>
            </div>
          {/if}
          
          <button class="gradient-bg text-black font-[Space_Grotesk] font-semibold px-8 py-4 rounded-xl btn-shimmer transition-all hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(0,240,255,0.3)] disabled:opacity-50 disabled:cursor-not-allowed min-w-[280px] inline-flex items-center justify-center gap-3" onclick={connectWallet} disabled={isConnecting}>
            {#if isConnecting}
              <div class="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
              <span>Confirma en tu Billetera...</span>
            {:else}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"/>
                <path d="M20 12v4H4a2 2 0 0 1-2-2V6"/>
                <path d="M20 12h2"/>
              </svg>
              Conectar Billetera
            {/if}
          </button>
        </div>
      {:else}
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <!-- Account Info -->
          <div class="bg-[#09090b] rounded-2xl border border-white/[0.08] p-8">
            <div class="text-center mb-6">
              <div class="text-[#a0a0a0] text-sm uppercase tracking-wider font-semibold mb-2">Balance Total</div>
              <div class="font-[Space_Grotesk] text-4xl font-bold text-white flex items-center justify-center gap-3">
                {balance ? Number(balance).toFixed(4) : '0.000'}
                <span class="text-[#00f0ff] text-base">ETH</span>
              </div>
            </div>

            <div class="bg-[rgba(0,240,255,0.05)] rounded-xl p-5 mb-4 border border-[rgba(0,240,255,0.1)]">
              <div class="flex justify-between items-center mb-2 text-sm">
                <span class="text-[#a0a0a0] font-semibold">Red:</span>
                <span class="text-[#00f0ff] font-[Space_Grotesk] font-bold">{chainName || 'Loading...'}</span>
              </div>
              <div class="flex justify-between items-center text-sm mb-4">
                <span class="text-[#a0a0a0] font-semibold">ID de Cadena:</span>
                <span class="text-[#00f0ff] font-[Space_Grotesk] font-bold">{chainId || '-'}</span>
              </div>
              
              <!-- Network Switcher -->
              <div class="pt-4 border-t border-[rgba(0,240,255,0.1)]">
                <label class="block text-[#a0a0a0] text-xs uppercase tracking-wider font-semibold mb-2">Cambiar Red por Proveedor</label>
                <div class="flex flex-wrap gap-2 mb-3">
                  <button class="px-3 py-2 rounded-lg text-xs font-semibold border transition-all {selectedNetworkFamily === 'utxo' ? 'bg-[rgba(0,240,255,0.12)] border-[#00f0ff] text-[#00f0ff]' : 'bg-[#0a0a0a] border-white/[0.08] text-[#a0a0a0]'}" onclick={() => { selectedNetworkFamily = 'utxo'; selectedNetworkId = Object.keys(filterNetworksByFamily(availableNetworks, 'utxo'))[0] || selectedNetworkId; }}>
                    Syscoin / zkSYS / PoB
                  </button>
                  <button class="px-3 py-2 rounded-lg text-xs font-semibold border transition-all {selectedNetworkFamily === 'evm' ? 'bg-[rgba(0,240,255,0.12)] border-[#00f0ff] text-[#00f0ff]' : 'bg-[#0a0a0a] border-white/[0.08] text-[#a0a0a0]'}" onclick={() => { selectedNetworkFamily = 'evm'; selectedNetworkId = Object.keys(filterNetworksByFamily(availableNetworks, 'evm'))[0] || selectedNetworkId; }}>
                    EVM Networks
                  </button>
                </div>
                <p class="text-[11px] text-[#666] mb-3">zkSYS PoB Devnet y zkSYS Testnet están agrupadas aquí junto con Syscoin NEVM y Rollux.</p>
                <div class="flex gap-2">
                  <select class="flex-1 px-3 py-2 rounded-lg bg-[#0a0a0a] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-[#00f0ff]" bind:value={selectedNetworkId}>
                    <option value="">Seleccionar red...</option>
                    {#each Object.entries(filterNetworksByFamily(availableNetworks, selectedNetworkFamily)) as [id, net]}
                      <option value={id}>{net.name}</option>
                    {/each}
                  </select>
                  <button class="px-4 py-2 bg-[#00f0ff]/10 border border-[#00f0ff]/30 text-[#00f0ff] rounded-lg text-sm font-semibold transition-all hover:bg-[#00f0ff]/20" onclick={() => { if(selectedNetworkId) switchNetworkTo(selectedNetworkId); }}>
                    Cambiar
                  </button>
                </div>
              </div>
            </div>

            <!-- Account Selector (Always visible when connected) -->
            <div class="bg-[#0a0a0a] rounded-xl p-4 border border-white/[0.08] mb-4">
              <label for="account-select" class="block text-[#a0a0a0] text-xs uppercase tracking-wider font-semibold mb-2">Cuentas Autorizadas</label>
              <select id="account-select" class="w-full px-3 py-2 rounded-lg bg-[#111] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-[#00f0ff] mb-2" bind:value={selectedAccountIndex}>
                {#each availableAccounts as account, idx}
                  <option value={idx}>{account.name} ({account.address.substring(0, 6)}...{account.address.substring(account.address.length - 4)})</option>
                {/each}
              </select>
              <p class="text-[10px] text-[#666] px-1">Si no ves tu otra cuenta, selecciónala primero en Pali Wallet y vuelve a conectar.</p>
            </div>

            <div class="bg-[#0a0a0a] rounded-xl p-4 flex items-center justify-between border border-white/[0.08] mb-4">
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-full gradient-bg flex-shrink-0"></div>
                <span class="font-[Space_Grotesk] text-lg text-white tracking-wide">
                  {address.substring(0, 6)}...{address.substring(address.length - 4)}
                </span>
              </div>
              <button class="p-2 transition-transform hover:scale-110" onclick={copyAddress} title="Copiar dirección">
                {#if copied}
                  <svg width="18" height="18" fill="none" stroke="#00ff88" stroke-width="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
                {:else}
                  <svg width="18" height="18" fill="none" stroke="#666" stroke-width="2" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                {/if}
              </button>
            </div>

            <button class="w-full bg-transparent border border-white/[0.08] text-white font-[Space_Grotesk] font-semibold py-3 rounded-xl transition-all hover:border-[#00f0ff] hover:bg-[rgba(0,240,255,0.05)] hover:-translate-y-0.5" onclick={disconnectWallet}>Desconectar</button>
          </div>

          <!-- Transfer Form -->
          <div class="bg-[#111] border border-white/[0.08] rounded-2xl p-6">
            <h3 class="font-[Space_Grotesk] text-xl font-semibold text-white mb-4">Enviar Transacción</h3>
            
            <input placeholder="Destino (0x...)" bind:value={toAddress} class="w-full px-4 py-3 rounded-lg bg-[#0a0a0a] border border-white/[0.08] text-white mb-3 focus:outline-none focus:border-[#00f0ff]" />
            <input placeholder="Monto (ETH)" bind:value={sendAmount} class="w-full px-4 py-3 rounded-lg bg-[#0a0a0a] border border-white/[0.08] text-white mb-4 focus:outline-none focus:border-[#00f0ff]" />
            
            <button class="w-full gradient-bg text-black font-[Space_Grotesk] font-semibold py-3 rounded-xl btn-shimmer transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed" onclick={sendTransfer} disabled={sending}>
              {#if sending}
                <div class="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin inline-block mr-2"></div>
                Enviando...
              {:else}
                Enviar Transacción
              {/if}
            </button>

            {#if txHash}
              <div class="mt-5 rounded-2xl border border-[rgba(0,240,255,0.18)] bg-[rgba(0,240,255,0.05)] p-4">
                <div class="text-[11px] uppercase tracking-[0.25em] text-[#a0a0a0] mb-2">Hash de transacción</div>
                <div class="break-all text-sm text-white mb-3">{txHash}</div>
                <div class="flex flex-wrap gap-3">
                  {#if getTransactionExplorerUrl(chainId, txHash)}
                    <a class="px-4 py-2 rounded-lg bg-[#00f0ff] text-black text-sm font-semibold transition-all hover:opacity-90" href={getTransactionExplorerUrl(chainId, txHash)} target="_blank" rel="noopener noreferrer">
                      Ver detalle
                    </a>
                  {/if}
                </div>
              </div>
            {/if}

            {#if txList.length > 0}
              <div class="mt-5 space-y-3">
                <div class="text-[11px] uppercase tracking-[0.25em] text-[#a0a0a0]">Últimas transacciones</div>
                {#each txList as tx}
                  <div class="rounded-2xl border border-white/[0.08] bg-[#0a0a0a] p-4">
                    <div class="flex items-center justify-between gap-3 mb-2">
                      <span class="text-sm text-white font-medium">{tx.value} ETH</span>
                      <span class="text-[11px] uppercase tracking-wider text-[#00f0ff]">{tx.network}</span>
                    </div>
                    <div class="text-xs text-[#a0a0a0] break-all mb-2">{tx.hash}</div>
                    {#if tx.explorerUrl}
                      <a class="text-sm text-[#00f0ff] hover:underline" href={tx.explorerUrl} target="_blank" rel="noopener noreferrer">Abrir en explorador</a>
                    {/if}
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </div>
      {/if}
      
      {#if error}
        <div class="mt-6 p-4 bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] text-[#f87171] rounded-xl text-sm text-center">
          {error}
        </div>
      {/if}
    </div>
  </section>

  <!-- CTA Section -->
  <section class="py-32 px-8">
    <div class="max-w-[1000px] mx-auto bg-gradient-to-br from-[rgba(0,240,255,0.05)] to-[rgba(184,41,247,0.05)] border border-white/[0.08] rounded-[32px] p-16 text-center relative overflow-hidden backdrop-blur-xl scroll-reveal" class:visible={ctaVisible}>
      <div class="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] cta-glow pointer-events-none"></div>
      <div class="relative z-10">
        <h2 class="font-[Space_Grotesk] text-[clamp(2rem,5vw,3rem)] font-bold text-white mb-4">¿Listo para Entrar a Web3?</h2>
        <p class="text-[#a0a0a0] text-lg max-w-[500px] mx-auto mb-10 leading-relaxed">Únete a miles de usuarios que ya gestionan sus activos crypto con Pali.</p>
        <button class="gradient-bg text-black font-[Space_Grotesk] font-semibold text-lg px-12 py-4 rounded-xl btn-shimmer transition-all hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(0,240,255,0.3)]" onclick={() => document.getElementById('wallet')?.scrollIntoView({ behavior: 'smooth' })}>
          Iniciar App
        </button>
      </div>
    </div>
  </section>

  <!-- Footer -->
  <footer class="py-16 px-8 border-t border-white/[0.08] mt-16">
    <div class="max-w-[1400px] mx-auto flex flex-wrap justify-between items-center gap-8">
      <div class="flex items-center gap-4">
        <div class="w-8 h-8 gradient-bg rounded-lg flex items-center justify-center">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
            <path d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <span class="text-[#666] text-sm">2026 Pali dApp. Todos los derechos reservados.</span>
      </div>
      
      <div class="flex gap-8">
        <a href="https://docs.pali.com" target="_blank" rel="noopener noreferrer" class="text-[#a0a0a0] text-sm transition-colors hover:text-[#00f0ff]">Documentación</a>
        <a href="https://github.com/pali" target="_blank" rel="noopener noreferrer" class="text-[#a0a0a0] text-sm transition-colors hover:text-[#00f0ff]">GitHub</a>
        <a href="https://support.pali.com" target="_blank" rel="noopener noreferrer" class="text-[#a0a0a0] text-sm transition-colors hover:text-[#00f0ff]">Soporte</a>
      </div>
    </div>
  </footer>
</main>