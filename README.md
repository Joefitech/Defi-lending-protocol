# 🛡️ Aegis Multi-Asset Protocol

> **A decentralized, multi-collateral algorithmic money market protocol enabling permissionless lending, borrowing, and risk management across diverse ERC-20 assets.**

---

## 📌 Overview

**Aegis Multi-Asset Protocol** is a full-stack, EVM-compatible lending and borrowing system inspired by protocols like Aave and Compound. Aegis allows users to deposit crypto assets as collateral to earn interest or borrow other assets against their position.

The protocol features dynamic interest rate models driven by pool utilization, real-time price feeds via a decentralized oracle architecture, strict health factor monitoring for system solvency, and asset-specific risk parameters (such as differential Loan-to-Value ratios and collateral permissions).

---

## ✨ Key Features

* **Multi-Collateral & Multi-Asset Accounting:** Supports assets with varying decimal places (e.g., 6-decimal USDC/USDT, 8-decimal WBTC, and 18-decimal WETH/DAI).
* **Algorithmic Interest Rate Curves:** Interest rates adapt dynamically based on pool utilization rates ($U$), incentivizing liquidity inflows during high-demand periods.
* **Risk Control & Custom Asset Governance:** Configurable Loan-To-Value (LTV) ratios, Liquidation Thresholds, and asset usage types (e.g., **Collateral Enabled** vs. **Borrow Only** like FRAX).
* **Dynamic Health Factor System:** Real-time account solvency checks to calculate collateral capacity vs. debt obligations in USD ($1\text{e}8$ oracle precision).
* **Time Warp Simulation:** Integrated EVM block time manipulation to simulate interest accrual and time-based yield over days or months on local testnets.
* **Modern Web3 Dashboard:** Built with React, Viem, and Tailwind CSS, providing clean UI visualization for positions, health factors, market utilization, and token metadata.

---

## 🏗️ Protocol Architecture

```text
                      +-----------------------------+
                      |         Web3 UI             |
                      |  (React / Viem / Wagmi)     |
                      +--------------+--------------+
                                     |
                                     v
                      +-----------------------------+
                      |     LendingEngine.sol       |
                      | (Core Accounting & Risk)    |
                      +------+---------------+------+
                             |               |
             +---------------+               +---------------+
             |                                               |
             v                                               v
+------------------------+                       +------------------------+
|    MockOracle.sol      |                       |    Mock ERC20 Tokens   |
| (USD Price Feed Engine)|                       | (WETH, WBTC, USDC, etc)|
+------------------------+                       +------------------------+