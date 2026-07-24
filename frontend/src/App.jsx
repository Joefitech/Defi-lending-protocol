import React, { useState, useEffect } from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { createWalletClient, createPublicClient, http, custom, parseEther, parseUnits, formatEther, formatUnits } from 'viem';
import { foundry } from 'viem/chains';
import { Shield, Zap, TrendingDown, ArrowUpRight, ArrowDownRight, RefreshCw } from 'lucide-react';
import { 
  LENDING_ENGINE_ADDRESS, 
  MOCK_ORACLE_ADDRESS, 
  WETH_ADDRESS, 
  USDC_ADDRESS,
  LENDING_ENGINE_ABI,
  MOCK_ORACLE_ABI,
  ERC20_ABI
} from './constants';

// Public client initialized outside component to avoid re-renders
const publicClient = createPublicClient({ 
  chain: foundry, 
  transport: http('http://127.0.0.1:8545') 
});

export default function App() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();

  // State
  const [wethPrice, setWethPrice] = useState(3000);
  const [userWethBal, setUserWethBal] = useState('0');
  const [userUsdcBal, setUserUsdcBal] = useState('0');
  const [userCollateral, setUserCollateral] = useState('0');
  const [userDebt, setUserDebt] = useState('0');
  const [loading, setLoading] = useState(false);

  // Inputs
  const [depositAmount, setDepositAmount] = useState('');
  const [simulatedPrice, setSimulatedPrice] = useState('3000');

  // Fetch Protocol State
  const fetchData = async () => {
    try {
      // 1. Get WETH Price from Oracle
      const rawPrice = await publicClient.readContract({
        address: MOCK_ORACLE_ADDRESS,
        abi: MOCK_ORACLE_ABI,
        functionName: 'getPrice',
        args: [WETH_ADDRESS]
      });
      setWethPrice(Number(rawPrice) / 1e8);

      if (address) {
        // 2. User Balances
        const wBal = await publicClient.readContract({
          address: WETH_ADDRESS,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [address]
        });
        setUserWethBal(formatEther(wBal));

        const uBal = await publicClient.readContract({
          address: USDC_ADDRESS,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [address]
        });
        setUserUsdcBal(formatUnits(uBal, 6));

        // 3. Protocol Position
        const col = await publicClient.readContract({
          address: LENDING_ENGINE_ADDRESS,
          abi: LENDING_ENGINE_ABI,
          functionName: 's_collateralDeposits',
          args: [address, WETH_ADDRESS]
        });
        setUserCollateral(formatEther(col));

        const debt = await publicClient.readContract({
          address: LENDING_ENGINE_ADDRESS,
          abi: LENDING_ENGINE_ABI,
          functionName: 's_borrowedBalances',
          args: [address, USDC_ADDRESS]
        });
        setUserDebt(formatUnits(debt, 6));
      }
    } catch (err) {
      console.error("Error fetching protocol data:", err);
    }
  };

  useEffect(() => {
    fetchData();
  }, [address]);

  // Actions
  const handleMintTokens = async () => {
    if (!window.ethereum || !address) return;
    setLoading(true);
    try {
      const walletClient = createWalletClient({ chain: foundry, transport: custom(window.ethereum) });
      
      await walletClient.writeContract({
        address: WETH_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'mint',
        args: [address, parseEther('10')],
        account: address
      });

      await walletClient.writeContract({
        address: USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'mint',
        args: [address, parseUnits('50000', 6)],
        account: address
      });

      await fetchData();
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleDeposit = async () => {
    if (!depositAmount || !address || !window.ethereum) return;
    setLoading(true);
    try {
      const walletClient = createWalletClient({ chain: foundry, transport: custom(window.ethereum) });
      const parsedAmount = parseEther(depositAmount);

      await walletClient.writeContract({
        address: WETH_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [LENDING_ENGINE_ADDRESS, parsedAmount],
        account: address
      });

      await walletClient.writeContract({
        address: LENDING_ENGINE_ADDRESS,
        abi: LENDING_ENGINE_ABI,
        functionName: 'depositCollateral',
        args: [WETH_ADDRESS, parsedAmount],
        account: address
      });

      setDepositAmount('');
      await fetchData();
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleUpdatePrice = async () => {
    if (!address || !window.ethereum) return;
    setLoading(true);
    try {
      const walletClient = createWalletClient({ chain: foundry, transport: custom(window.ethereum) });
      const scaledPrice = parseUnits(simulatedPrice, 8);

      await walletClient.writeContract({
        address: MOCK_ORACLE_ADDRESS,
        abi: MOCK_ORACLE_ABI,
        functionName: 'setPrice',
        args: [WETH_ADDRESS, scaledPrice],
        account: address
      });

      await fetchData();
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      {/* Header */}
      <header className="max-w-6xl mx-auto flex justify-between items-center pb-8 border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="bg-indigo-600 p-2 rounded-xl">
            <Shield className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Aegis Lending Protocol</h1>
            <p className="text-xs text-slate-400">Overcollateralized Liquidity Engine</p>
          </div>
        </div>

        <div>
          {isConnected ? (
            <div className="flex items-center space-x-3">
              <span className="text-xs bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/20 font-mono">
                {address.slice(0, 6)}...{address.slice(-4)}
              </span>
              <button onClick={() => disconnect()} className="text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-700">
                Disconnect
              </button>
            </div>
          ) : (
            <button onClick={() => connect({ connector: injected() })} className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-4 py-2 rounded-xl text-sm transition">
              Connect Wallet
            </button>
          )}
        </div>
      </header>

      {/* Main Grid */}
      <main className="max-w-6xl mx-auto mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left Column */}
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">My Protocol Balances</h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-slate-300">Wallet WETH</span>
                <span className="font-mono text-emerald-400">{Number(userWethBal).toFixed(2)} WETH</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-300">Wallet USDC</span>
                <span className="font-mono text-emerald-400">${Number(userUsdcBal).toLocaleString()}</span>
              </div>
              <hr className="border-slate-800" />
              <div className="flex justify-between items-center">
                <span className="text-slate-300">Deposited Collateral</span>
                <span className="font-mono text-indigo-400">{Number(userCollateral).toFixed(2)} WETH</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-300">Borrowed Debt</span>
                <span className="font-mono text-rose-400">${Number(userDebt).toLocaleString()}</span>
              </div>
            </div>

            <button 
              onClick={handleMintTokens} 
              disabled={loading || !isConnected}
              className="mt-6 w-full flex items-center justify-center space-x-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 py-2.5 rounded-xl text-sm transition disabled:opacity-50"
            >
              <Zap className="h-4 w-4 text-amber-400" />
              <span>Claim Test Faucet Tokens</span>
            </button>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center space-x-2 mb-2">
              <TrendingDown className="h-5 w-5 text-amber-400" />
              <h2 className="text-sm font-semibold text-slate-200">Oracle Price Simulator</h2>
            </div>
            <p className="text-xs text-slate-400 mb-4">Simulate market crashes to test health factors.</p>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-400">Current WETH Price</label>
                <div className="text-2xl font-mono font-bold text-slate-100">${wethPrice.toLocaleString()}</div>
              </div>

              <div className="flex space-x-2">
                <input 
                  type="number" 
                  value={simulatedPrice} 
                  onChange={(e) => setSimulatedPrice(e.target.value)}
                  placeholder="New Price USD" 
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm font-mono w-full text-slate-200 focus:outline-none focus:border-indigo-500"
                />
                <button 
                  onClick={handleUpdatePrice}
                  disabled={loading || !isConnected}
                  className="bg-amber-600 hover:bg-amber-500 text-white font-medium px-4 py-2 rounded-xl text-xs transition whitespace-nowrap disabled:opacity-50"
                >
                  Set Oracle Price
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center space-x-2 mb-4">
              <ArrowUpRight className="h-5 w-5 text-indigo-400" />
              <h3 className="font-semibold text-slate-200">Deposit Collateral</h3>
            </div>
            <p className="text-xs text-slate-400 mb-4">Deposit WETH to increase borrowing capacity.</p>

            <div className="space-y-4">
              <input 
                type="number" 
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="Amount in WETH (e.g. 1.0)" 
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm font-mono w-full text-slate-200 focus:outline-none focus:border-indigo-500"
              />
              <button 
                onClick={handleDeposit}
                disabled={loading || !isConnected}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 rounded-xl text-sm transition disabled:opacity-50"
              >
                Deposit WETH
              </button>
            </div>
          </div>

          <div className="bg-indigo-950/40 border border-indigo-900/50 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <RefreshCw className="h-5 w-5 text-indigo-400" />
              <div>
                <p className="text-xs font-semibold text-slate-200">Connected to Local Anvil Chain (ID: 31337)</p>
                <p className="text-xs text-slate-400">All transactions execute against local smart contracts.</p>
              </div>
            </div>
            <button onClick={fetchData} className="text-xs bg-indigo-600/30 text-indigo-300 hover:bg-indigo-600/50 px-3 py-1.5 rounded-lg border border-indigo-500/30 transition">
              Sync State
            </button>
          </div>
        </div>

      </main>
    </div>
  );
}