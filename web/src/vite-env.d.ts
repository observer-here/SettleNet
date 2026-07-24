/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_RPC_URL?: string;
  readonly VITE_CHAIN_ID?: string;
  readonly VITE_WALLETCONNECT_PROJECT_ID?: string;
  readonly VITE_ARCSCAN_API?: string;
  readonly VITE_FAUCET_URL?: string;
  readonly VITE_USDC_ADDRESS?: string;
  readonly VITE_IDENTITY_ADDRESS?: string;
  readonly VITE_SETTLENET_ADDRESS: string;
  readonly VITE_EVALUATOR_STAKE_ADDRESS: string;
  readonly VITE_PROVIDER_BOND_ADDRESS: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
