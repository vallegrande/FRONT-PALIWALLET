<script>
  import { onMount } from "svelte";
  import { BrowserProvider, formatEther } from "ethers";

  let address = null;
  let balance = null;
  let error = null;
  let isConnecting = false;

  async function connectWallet() {
    isConnecting = true;
    error = null;
    try {
      if (window.ethereum) {
        // Ethers v6 uses BrowserProvider
        const provider = new BrowserProvider(window.ethereum);

        // Solicita el acceso a la cuenta
        const accounts = await provider.send("eth_requestAccounts", []);

        if (accounts.length > 0) {
          address = accounts[0];
          const rawBalance = await provider.getBalance(address);
          balance = formatEther(rawBalance);
        } else {
          error = "No se encontraron cuentas.";
        }
      } else {
        error = "Pali Wallet u otro proveedor Web3 no está instalado.";
      }
    } catch (err) {
      console.error(err);
      error = err.message || "Error al conectar la billetera.";
    } finally {
      isConnecting = false;
    }
  }
</script>

<style>
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&family=Space+Grotesk:wght@500;700&display=swap');

  :global(:root) {
    font-family: 'Outfit', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #e2e8f0;
    background: #09090b; /* Deep black background */
    --accent: #10b981; /* Emerald */
    --accent-glow: rgba(16, 185, 129, 0.4);
    --surface: #18181b; /* Zinc 900 */
    --surface-border: #27272a; /* Zinc 800 */
  }

  :global(body) {
    margin: 0;
    min-height: 100vh;
    display: flex;
    justify-content: center;
    align-items: center;
    background-image: 
      radial-gradient(circle at 15% 50%, rgba(16, 185, 129, 0.08) 0%, transparent 50%),
      radial-gradient(circle at 85% 30%, rgba(59, 130, 246, 0.08) 0%, transparent 50%);
  }

  main {
    width: 100%;
    padding: 2rem;
    box-sizing: border-box;
    display: flex;
    justify-content: center;
  }

  .dapp-container {
    background: var(--surface);
    width: 100%;
    max-width: 440px;
    border-radius: 24px;
    border: 1px solid var(--surface-border);
    box-shadow: 0 30px 60px rgba(0, 0, 0, 0.6);
    overflow: hidden;
    position: relative;
  }

  /* Top Decorative line */
  .dapp-container::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 4px;
    background: linear-gradient(90deg, #10b981, #3b82f6);
  }

  .header {
    padding: 2.5rem 2rem 1.5rem;
    text-align: center;
  }

  .logo {
    width: 60px;
    height: 60px;
    margin: 0 auto 1.5rem;
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    border-radius: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 10px 25px var(--accent-glow);
  }

  .logo svg {
    width: 32px;
    height: 32px;
    color: white;
  }

  h1 {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 2rem;
    font-weight: 700;
    margin: 0 0 0.5rem;
    color: white;
    letter-spacing: -0.04em;
  }

  .description {
    color: #a1a1aa;
    font-size: 1rem;
    margin: 0;
    line-height: 1.5;
  }

  .content {
    padding: 0 2rem 2.5rem;
  }

  /* Botón Principal */
  .btn-connect {
    width: 100%;
    background: white;
    color: black;
    border: none;
    padding: 1.1rem 1.5rem;
    font-size: 1.1rem;
    font-family: 'Space Grotesk', sans-serif;
    font-weight: 700;
    border-radius: 14px;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
  }

  .btn-connect:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(255,255,255,0.2);
  }

  .btn-connect:active:not(:disabled) {
    transform: translateY(0);
  }

  .btn-connect:disabled {
    background: #3f3f46;
    color: #71717a;
    cursor: not-allowed;
  }

  /* Estado Conectado */
  .account-card {
    background: #09090b;
    border-radius: 16px;
    border: 1px solid var(--surface-border);
    padding: 1.5rem;
  }

  .balance-section {
    text-align: center;
    margin-bottom: 2rem;
  }

  .balance-label {
    color: #a1a1aa;
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: 600;
    margin-bottom: 0.5rem;
  }

  .balance-amount {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 2.5rem;
    font-weight: 700;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .currency {
    font-size: 1.2rem;
    color: var(--accent);
  }

  .address-section {
    background: var(--surface);
    border-radius: 12px;
    padding: 12px 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border: 1px solid var(--surface-border);
  }

  .address-badge {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .avatar {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: linear-gradient(135deg, #10b981, #3b82f6);
  }

  .address-text {
    font-family: 'Space Grotesk', monospace;
    font-size: 1rem;
    color: #e2e8f0;
    letter-spacing: 0.02em;
  }

  .network-badge {
    position: absolute;
    top: 1.5rem;
    right: 1.5rem;
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid rgba(16, 185, 129, 0.2);
    color: #10b981;
    padding: 6px 12px;
    border-radius: 20px;
    font-size: 0.75rem;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  
  .network-dot {
    width: 6px;
    height: 6px;
    background: #10b981;
    border-radius: 50%;
    box-shadow: 0 0 8px #10b981;
  }

  /* Loding Spinner */
  .spinner {
    width: 20px;
    height: 20px;
    border: 3px solid rgba(255,255,255,0.1);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .error-message {
    margin-top: 1rem;
    padding: 1rem;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.2);
    color: #f87171;
    border-radius: 12px;
    font-size: 0.9rem;
    text-align: center;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>

<main>
  <div class="dapp-container">
    {#if address}
      <div class="network-badge">
        <div class="network-dot"></div>
        Mainnet
      </div>
    {/if}

    <div class="header">
      <div class="logo">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      </div>
      <h1>Pali dApp</h1>
      <p class="description">Accede al futuro de las finanzas descentralizadas mediante tu billetera Web3.</p>
    </div>

    <div class="content">
      {#if !address}
        <button class="btn-connect" on:click={connectWallet} disabled={isConnecting}>
          {#if isConnecting}
            <div class="spinner"></div> Confirmar en Billetera
          {:else}
            Connect Wallet
          {/if}
        </button>
      {/if}

      {#if address}
        <div class="account-card">
          <div class="balance-section">
            <div class="balance-label">Total Balance</div>
            <div class="balance-amount">
              {balance ? Number(balance).toFixed(4) : '0.000'}
              <span class="currency">ETH</span>
            </div>
          </div>

          <div class="address-section">
            <div class="address-badge">
              <div class="avatar"></div>
              <span class="address-text">
                {address.substring(0, 6)}...{address.substring(address.length - 4)}
              </span>
            </div>
            <!-- Botón copiado opcional omitido para limpiar diseño -->
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="#71717a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
          </div>
        </div>
      {/if}

      {#if error}
        <div class="error-message">
          {error}
        </div>
      {/if}
    </div>
  </div>
</main>
