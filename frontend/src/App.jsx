import React, { useState, useEffect } from 'react';
import { useAccount, useConnect, useDisconnect, useWalletClient } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { createPublicClient, http, formatUnits, parseUnits } from 'viem';
import { foundry } from 'viem/chains';
import { 
  LENDING_ENGINE_ADDRESS, 
  MOCK_ORACLE_ADDRESS, 
  LENDING_ENGINE_ABI, 
  ERC20_ABI, 
  ORACLE_ABI 
} from './contracts';

// Metadata mapping for real crypto logos & full names
const ASSET_META = {
  WETH: { 
    name: 'Wrapped Ether', 
    logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png' 
  },
  WBTC: { 
    name: 'Wrapped Bitcoin', 
    logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599/logo.png' 
  },
  LINK: { 
    name: 'Chainlink', 
    logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x514910771AF9Ca656af840dff83E8264EcF986CA/logo.png' 
  },
  UNI: { 
    name: 'Uniswap', 
    logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984/logo.png' 
  },
  USDC: { 
    name: 'USD Coin', 
    logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png' 
  },
  USDT: { 
    name: 'Tether USD', 
    logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png' 
  },
  DAI: { 
    name: 'Dai Stablecoin', 
    logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x6B175474E89094C44Da98b954EedeAC495271d0F/logo.png' 
  },
  FRAX: { 
    name: 'Frax', 
    logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x3432B6A60D23Ca0dFCa7761E7ab56459D9C964D0/logo.png' 
  },
};

const publicClient = createPublicClient({
  chain: foundry,
  transport: http('http://127.0.0.1:8545')
});

export default function App() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: walletClient } = useWalletClient();

  const [assetsData, setAssetsData] = useState([]);
  const [accountInfo, setAccountInfo] = useState({ collateralUsd: '0.00', debtUsd: '0.00', healthFactor: '∞' });
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [actionAmount, setActionAmount] = useState('');
  const [actionType, setActionType] = useState('deposit');
  const [loading, setLoading] = useState(false);

  const refreshData = async () => {
    try {
      const allowedAssets = await publicClient.readContract({
        address: LENDING_ENGINE_ADDRESS,
        abi: LENDING_ENGINE_ABI,
        functionName: 'getAllowedAssets'
      });

      const updatedAssets = await Promise.all(
        allowedAssets.map(async (assetAddress) => {
          const symbol = await publicClient.readContract({
            address: assetAddress,
            abi: ERC20_ABI,
            functionName: 'symbol'
          });

          const decimalsRaw = await publicClient.readContract({
            address: assetAddress,
            abi: ERC20_ABI,
            functionName: 'decimals'
          });
          const decimals = Number(decimalsRaw);

          const config = await publicClient.readContract({
            address: LENDING_ENGINE_ADDRESS,
            abi: LENDING_ENGINE_ABI,
            functionName: 's_assetConfigs',
            args: [assetAddress]
          });

          const priceRaw = await publicClient.readContract({
            address: MOCK_ORACLE_ADDRESS,
            abi: ORACLE_ABI,
            functionName: 'getPrice',
            args: [assetAddress]
          });

          const utilizationRaw = await publicClient.readContract({
            address: LENDING_ENGINE_ADDRESS,
            abi: LENDING_ENGINE_ABI,
            functionName: 'getUtilizationRate',
            args: [assetAddress]
          });

          const rates = await publicClient.readContract({
            address: LENDING_ENGINE_ADDRESS,
            abi: LENDING_ENGINE_ABI,
            functionName: 'getBorrowRates',
            args: [assetAddress]
          });

          let walletBal = '0', collateral = '0', debt = '0';
          if (address) {
            const balRaw = await publicClient.readContract({
              address: assetAddress,
              abi: ERC20_ABI,
              functionName: 'balanceOf',
              args: [address]
            });
            const colRaw = await publicClient.readContract({
              address: LENDING_ENGINE_ADDRESS,
              abi: LENDING_ENGINE_ABI,
              functionName: 's_collateralDeposits',
              args: [address, assetAddress]
            });
            const debtRaw = await publicClient.readContract({
              address: LENDING_ENGINE_ADDRESS,
              abi: LENDING_ENGINE_ABI,
              functionName: 's_borrowedBalances',
              args: [address, assetAddress]
            });

            walletBal = formatUnits(balRaw, decimals);
            collateral = formatUnits(colRaw, decimals);
            debt = formatUnits(debtRaw, decimals);
          }

          const meta = ASSET_META[symbol] || { name: symbol, logo: '' };

          return {
            address: assetAddress,
            symbol: symbol,
            name: meta.name,
            logo: meta.logo,
            decimals: decimals,
            isCollateral: config[1],
            isBorrowable: config[2],
            price: (Number(priceRaw) / 1e8).toFixed(2),
            utilization: (Number(utilizationRaw) / 100).toFixed(1),
            borrowApy: (Number(rates[0]) / 100).toFixed(2),
            supplyApy: (Number(rates[1]) / 100).toFixed(2),
            walletBal: Number(walletBal).toFixed(2),
            collateral: Number(collateral).toFixed(2),
            debt: Number(debt).toFixed(2)
          };
        })
      );

      setAssetsData(updatedAssets);
      if (updatedAssets.length > 0 && !selectedAsset) setSelectedAsset(updatedAssets[0]);

      if (address) {
        const info = await publicClient.readContract({
          address: LENDING_ENGINE_ADDRESS,
          abi: LENDING_ENGINE_ABI,
          functionName: 'getAccountInformation',
          args: [address]
        });

        const hfRaw = await publicClient.readContract({
          address: LENDING_ENGINE_ADDRESS,
          abi: LENDING_ENGINE_ABI,
          functionName: 'getHealthFactor',
          args: [address]
        });

        const colUsd = formatUnits(info[0], 18);
        const debtUsd = formatUnits(info[1], 18);
        const hf = hfRaw > 1e30 ? '∞' : (Number(formatUnits(hfRaw, 18))).toFixed(2);

        setAccountInfo({
          collateralUsd: Number(colUsd).toFixed(2),
          debtUsd: Number(debtUsd).toFixed(2),
          healthFactor: hf
        });
      }
    } catch (e) {
      console.error('Error loading data:', e);
    }
  };

  useEffect(() => {
    refreshData();
  }, [address]);

  const handleExecuteAction = async () => {
    if (!walletClient || !selectedAsset || !actionAmount) return;
    setLoading(true);
    try {
      const parsedAmount = parseUnits(actionAmount, selectedAsset.decimals);

      if (actionType === 'deposit' || actionType === 'supply' || actionType === 'repay') {
        const approveHash = await walletClient.writeContract({
          address: selectedAsset.address,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [LENDING_ENGINE_ADDRESS, parsedAmount]
        });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }

      let functionName = 'depositCollateral';
      if (actionType === 'supply') functionName = 'supplyLiquidity';
      if (actionType === 'borrow') functionName = 'borrow';
      if (actionType === 'repay') functionName = 'repay';

      const txHash = await walletClient.writeContract({
        address: LENDING_ENGINE_ADDRESS,
        abi: LENDING_ENGINE_ABI,
        functionName: functionName,
        args: [selectedAsset.address, parsedAmount]
      });

      await publicClient.waitForTransactionReceipt({ hash: txHash });
      setActionAmount('');
      await refreshData();
    } catch (e) {
      console.error('Transaction Failed:', e);
      alert('Transaction Failed! Check console for details.');
    } finally {
      setLoading(false);
    }
  };

  const fastForwardTime = async (seconds) => {
    try {
      await publicClient.request({
        method: 'evm_increaseTime',
        params: [seconds]
      });
      await publicClient.request({ method: 'evm_mine', params: [] });
      await refreshData();
      alert(`Warped time forward by ${seconds / 86400} days!`);
    } catch (e) {
      console.error('Time warp failed:', e);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8 font-sans">
      {/* Top Header */}
      <div className="flex justify-between items-center mb-8 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            Aegis Multi-Asset Protocol
          </h1>
          <p className="text-sm text-slate-400 mt-1">Multi-Collateral Algorithmic Money Market</p>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => fastForwardTime(30 * 86400)} 
            className="px-3 py-2 bg-indigo-900/40 border border-indigo-500/30 text-indigo-300 rounded-lg text-sm hover:bg-indigo-900/60 transition"
          >
            ⏳ Fast Forward 30 Days
          </button>
          {isConnected ? (
            <button onClick={() => disconnect()} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg font-medium text-sm">
              {address.slice(0, 6)}...{address.slice(-4)}
            </button>
          ) : (
            <button onClick={() => connect({ connector: injected() })} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-medium text-sm">
              Connect Wallet
            </button>
          )}
        </div>
      </div>

      {/* Account Overview Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
          <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Total Collateral</p>
          <p className="text-2xl font-bold text-emerald-400 mt-2">${accountInfo.collateralUsd}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
          <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Total Debt</p>
          <p className="text-2xl font-bold text-rose-400 mt-2">${accountInfo.debtUsd}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
          <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Health Factor</p>
          <p className={`text-2xl font-bold mt-2 ${accountInfo.healthFactor < 1.1 ? 'text-rose-500' : 'text-indigo-400'}`}>
            {accountInfo.healthFactor}
          </p>
        </div>
      </div>

      {/* Main Protocol Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Markets Table */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="text-xl font-bold mb-4">Supported Asset Markets</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="pb-3">Asset</th>
                  <th className="pb-3">Oracle Price</th>
                  <th className="pb-3">Supply APY</th>
                  <th className="pb-3">Borrow APY</th>
                  <th className="pb-3">Utilization</th>
                  <th className="pb-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {assetsData.map((asset, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/30 transition">
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <img 
                          src={asset.logo} 
                          alt={asset.symbol} 
                          className="w-8 h-8 rounded-full bg-slate-800 p-0.5 object-contain"
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                        <div>
                          <div className="font-bold text-slate-100 flex items-center gap-2">
                            {asset.symbol}
                            {asset.isCollateral ? (
                              <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800 px-1.5 py-0.2 rounded font-normal">Collateral</span>
                            ) : (
                              <span className="text-[10px] bg-indigo-950 text-indigo-400 border border-indigo-800 px-1.5 py-0.2 rounded font-normal">Borrow Only</span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400">{asset.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 font-semibold text-slate-200">${asset.price}</td>
                    <td className="py-4 text-emerald-400 font-medium">{asset.supplyApy}%</td>
                    <td className="py-4 text-indigo-400 font-medium">{asset.borrowApy}%</td>
                    <td className="py-4">
                      <div className="w-24 bg-slate-800 rounded-full h-2 mt-1">
                        <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${Math.min(asset.utilization, 100)}%` }}></div>
                      </div>
                      <span className="text-xs text-slate-400 mt-1 block">{asset.utilization}%</span>
                    </td>
                    <td className="py-4">
                      <button 
                        onClick={() => setSelectedAsset(asset)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs rounded-md text-indigo-300 font-medium border border-slate-700"
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Action Panel */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            {selectedAsset && selectedAsset.logo && (
              <img src={selectedAsset.logo} alt={selectedAsset.symbol} className="w-6 h-6 rounded-full" />
            )}
            <h2 className="text-xl font-bold">
              Interact {selectedAsset && `(${selectedAsset.symbol})`}
            </h2>
          </div>

          <div className="grid grid-cols-4 gap-2 mb-6">
            {['deposit', 'supply', 'borrow', 'repay'].map((mode) => (
              <button
                key={mode}
                onClick={() => setActionType(mode)}
                className={`py-2 text-xs font-semibold rounded-lg capitalize transition ${
                  actionType === mode 
                    ? 'bg-indigo-600 text-white' 
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs text-slate-400 font-medium">Amount</label>
                {selectedAsset && address && (
                  <span className="text-xs text-slate-400">
                    Wallet: {selectedAsset.walletBal} {selectedAsset.symbol}
                  </span>
                )}
              </div>
              <input
                type="number"
                placeholder="0.00"
                value={actionAmount}
                onChange={(e) => setActionAmount(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <button
              onClick={handleExecuteAction}
              disabled={loading || !actionAmount}
              className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white font-semibold rounded-lg shadow-lg transition"
            >
              {loading ? 'Processing Transaction...' : `Execute ${actionType.toUpperCase()}`}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}