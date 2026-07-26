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



Local Development Setup
Prerequisites
Node.js (v18 or higher)

Git

Foundry

Clone Repository & Install Dependencies
git clone [https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git](https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git)
cd YOUR_REPO_NAME

# Install smart contract dependencies
forge install

# Install frontend dependencies
cd frontend
npm install
cd ..

Roadmap & Future Enhancements[ ] Liquidation Bot Integration: Automated execution scripts for undercollateralized positions ($HF < 1.0$).[ ] Flash Loans: Permissionless single-transaction borrowing and repayment pool feature.[ ] Chainlink Data Feed Integration: Production mainnet/testnet Chainlink Price Feeds.[ ] Governance & Staking: Tokenized safety module for protocol shortfall backstopping.

## 📐 Mathematical & Algorithmic Models

### 1. Utilization Rate ($U$)

Pool utilization determines market demand for a given asset:

$$U = \frac{\text{Total Borrows}}{\text{Total Liquidity} + \text{Total Borrows}}$$

### 2. Two-Kink Interest Rate Model

To optimize capital efficiency and prevent liquidity run-outs, interest rates follow a two-slope curve based on an optimal utilization point ($U_{\text{optimal}}$):

$$\text{Borrow APY} = \text{Base Rate} + \begin{cases} \left( \frac{U}{U_{\text{optimal}}} \right) \cdot \text{Slope}_1 & \text{if } U \le U_{\text{optimal}} \\[10pt] \text{Slope}_1 + \left( \frac{U - U_{\text{optimal}}}{1 - U_{\text{optimal}}} \right) \cdot \text{Slope}_2 & \text{if } U > U_{\text{optimal}} \end{cases}$$

### 3. Health Factor ($HF$)

A position’s health factor measures total collateral value weighted by liquidation thresholds against total borrowed debt in USD:

$$\text{Health Factor} = \frac{\sum_{i} \left( \text{Collateral}_i \times \text{Price}_i \times \text{Liquidation Threshold}_i \right)}{\sum_{j} \left( \text{Debt}_j \times \text{Price}_j \right)}$$

> ⚠️ **Note:** If $HF < 1.0$, the account is undercollateralized and becomes eligible for liquidation to preserve protocol solvency.

---

## 🛠️ Tech Stack

### **Smart Contracts (Backend)**
* **Solidity (`^0.8.20`)** – Core smart contract logic.
* **Foundry / Forge** – Smart contract compilation, testing, and deployment scripting.
* **Anvil** – Local Ethereum node environment.
* **OpenZeppelin** – Security standards (`IERC20`, `SafeERC20`, `ReentrancyGuard`).

### **Frontend & Web3 Integration**
* **React** – Component-driven UI development.
* **Viem** – Modular, high-performance TypeScript interface for EVM contracts (`parseAbi`, contract client).
* **Wagmi** – React Hooks for wallet connection handling.
* **Tailwind CSS** – Styling and responsive dark-mode DeFi UI.

---

## 📊 Supported Asset Markets

| Asset | Name | Decimals | Role | Oracle Price (USD) |
| :--- | :--- | :---: | :---: | :---: |
| **WETH** | Wrapped Ether | 18 | Collateral | $3,000.00 |
| **WBTC** | Wrapped Bitcoin | 8 | Collateral | $65,000.00 |
| **LINK** | Chainlink | 18 | Collateral | $18.00 |
| **UNI** | Uniswap | 18 | Collateral | $8.00 |
| **USDC** | USD Coin | 6 | Collateral | $1.00 |
| **USDT** | Tether USD | 6 | Collateral | $1.00 |
| **DAI** | Dai Stablecoin | 18 | Collateral | $1.00 |
| **FRAX** | Frax | 18 | Borrow Only | $1.00 |

---

## 🚀 Local Development Setup

### **Prerequisites**
* [Node.js](https://nodejs.org/) (v18 or higher)
* [Git](https://git-scm.com/)
* [Foundry](https://getfoundry.sh/)

---

### **1. Clone Repository & Install Dependencies**

```bash
git clone [https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git](https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git)
cd YOUR_REPO_NAME

# Install smart contract dependencies
forge install

# Install frontend dependencies
cd frontend
npm install
cd ..