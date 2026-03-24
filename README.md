# PaliWallet — Interfaz de la dApp (Svelte + Vite)

PaliWallet es la interfaz frontend de una dApp ligera desarrollada con Svelte y Vite. Está pensada como ejemplo/plantilla para conectar una interfaz web con billeteras Web3 (MetaMask u otros proveedores compatibles con `window.ethereum`), mostrar cuentas, consultar balances y enviar transacciones hacia smart contracts.

**Estado**: demo / plantilla de desarrollo

**Principales objetivos:**
- Proveer una UI simple para interactuar con cuentas Ethereum
- Demostrar integración básica con proveedores Web3 (conexión, firma y envío de transacciones)
- Servir como base para integrar smart contracts y construir dApps más completas

**Características implementadas (demo)**
- Conexión a MetaMask / proveedores compatibles
- Visualización de la cuenta activa y dirección
- Envío de transacciones sencillas (ej. transferencias de ETH/tokens)
- Estructura basada en Svelte para fácil extensión

**Riesgos y notas**
- Esta app es una interfaz cliente: las claves privadas las gestiona la wallet del usuario (MetaMask). No se almacenan claves en el repositorio.
- Úsala solo con redes de prueba mientras desarrollas (Goerli, Sepolia u otras). No envíes fondos reales hasta auditar la integración.

**Fuentes y referencias**
- Proyectos y documentación de referencia: Uniswap, Aave (estos protocolos ilustran cómo las dApps usan smart contracts en producción).

**Requisitos**
- Node.js 16+ (recomendado)
- npm o yarn
- Extensión recomendada en VS Code: Svelte for VS Code

**Instalación y ejecución local**
1. Instala dependencias:

```bash
npm install
```

2. Ejecuta en modo desarrollo (Vite):

```bash
npm run dev
```

3. Abre la app en tu navegador en `http://localhost:5173` (Vite) y conecta tu wallet.

**Comandos útiles**
- `npm run dev` — servidor de desarrollo con HMR
- `npm run build` — construye la versión de producción
- `npm run preview` — sirve la build localmente para pruebas

**Estructura del proyecto**
- `index.html` — página principal
- `src/main.js` — punto de entrada
- `src/App.svelte` — componente raíz
- `src/lib/` — componentes reutilizables (ej. `Counter.svelte` como ejemplo)

**Propuestas de mejora**
- Integrar soporte para múltiples redes y selección dinámica de RPC
- Añadir visualización de balances ERC-20 y tokens personalizados
- Integrar llamadas a smart contracts concretos (contratos de ejemplo para swaps o lending)
- Añadir pruebas (unitarias / e2e) para flujos críticos

**Contribuir**
- Haz fork y abre un PR con una descripción clara de los cambios.
- Incluye instrucciones de testing si agregas funcionalidades.

**Licencia**
- Repositorio de ejemplo (elige la licencia que prefieras o especifica una).

---

Si quieres, puedo: añadir instrucciones para conectar un smart contract específico, incluir ejemplos de código para llamadas a contratos desde `src/` o agregar capturas/diagrama del flujo. ¿Qué prefieres que integre ahora?
