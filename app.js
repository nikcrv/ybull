// Web3 Provider
let ethersProvider = null;
let signer = null;
let userAddress = null;
let walletProvider = null;

// Contract Addresses
const VEYB_NFT_ADDRESS = '0x8235c179E9e84688FBd8B12295EfC26834dAC211'; // veYB Token
const MARKETPLACE_ADDRESS = '0x0000000000000068F116a894984e2DB1123eB395'; // Seaport 1.6
const YB_TOKEN_ADDRESS = '0x01791F726B4103694969820be083196cC7c045fF'; // YB Token
const GAUGE_CONTROLLER_ADDRESS = '0x1Be14811A3a06F6aF4fA64310a636e1Df04c1c21'; // GaugeController


// veYB NFT ABI
const ERC721_ABI = [
    "function setApprovalForAll(address operator, bool approved) external",
    "function isApprovedForAll(address owner, address operator) external view returns (bool)",
    "function balanceOf(address owner) external view returns (uint256)",
    "function locked(address owner) external view returns (int256 amount, uint256 end)"
];

// YB Token ABI (ERC20)
const YB_TOKEN_ABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) external view returns (uint256)",
    "function balanceOf(address account) external view returns (uint256)",
    "function decimals() external view returns (uint8)"
];

// GaugeController ABI
const GAUGE_CONTROLLER_ABI = [
    "function vote_for_gauge_weights(address[] gauges, uint256[] weights) external",
    "function ve_transfer_allowed(address owner) external view returns (bool)",
    "function vote_user_slopes(address user, address gauge) external view returns (uint256 slope, uint256 power, uint256 end)",
    "function last_user_vote(address user, address gauge) external view returns (uint256)",
    "event VoteForGauge(uint256 time, address user, address gauge_addr, uint256 weight)"
];

// Seaport 1.6 ABI (validate function and getCounter)
const SEAPORT_ABI = [
    {
        "inputs": [
            {
                "components": [
                    {
                        "components": [
                            {"internalType": "address", "name": "offerer", "type": "address"},
                            {"internalType": "address", "name": "zone", "type": "address"},
                            {
                                "components": [
                                    {"internalType": "enum ItemType", "name": "itemType", "type": "uint8"},
                                    {"internalType": "address", "name": "token", "type": "address"},
                                    {"internalType": "uint256", "name": "identifierOrCriteria", "type": "uint256"},
                                    {"internalType": "uint256", "name": "startAmount", "type": "uint256"},
                                    {"internalType": "uint256", "name": "endAmount", "type": "uint256"}
                                ],
                                "internalType": "struct OfferItem[]",
                                "name": "offer",
                                "type": "tuple[]"
                            },
                            {
                                "components": [
                                    {"internalType": "enum ItemType", "name": "itemType", "type": "uint8"},
                                    {"internalType": "address", "name": "token", "type": "address"},
                                    {"internalType": "uint256", "name": "identifierOrCriteria", "type": "uint256"},
                                    {"internalType": "uint256", "name": "startAmount", "type": "uint256"},
                                    {"internalType": "uint256", "name": "endAmount", "type": "uint256"},
                                    {"internalType": "address payable", "name": "recipient", "type": "address"}
                                ],
                                "internalType": "struct ConsiderationItem[]",
                                "name": "consideration",
                                "type": "tuple[]"
                            },
                            {"internalType": "enum OrderType", "name": "orderType", "type": "uint8"},
                            {"internalType": "uint256", "name": "startTime", "type": "uint256"},
                            {"internalType": "uint256", "name": "endTime", "type": "uint256"},
                            {"internalType": "bytes32", "name": "zoneHash", "type": "bytes32"},
                            {"internalType": "uint256", "name": "salt", "type": "uint256"},
                            {"internalType": "bytes32", "name": "conduitKey", "type": "bytes32"},
                            {"internalType": "uint256", "name": "totalOriginalConsiderationItems", "type": "uint256"}
                        ],
                        "internalType": "struct OrderParameters",
                        "name": "parameters",
                        "type": "tuple"
                    },
                    {"internalType": "bytes", "name": "signature", "type": "bytes"}
                ],
                "internalType": "struct Order[]",
                "name": "orders",
                "type": "tuple[]"
            }
        ],
        "name": "validate",
        "outputs": [{"internalType": "bool", "name": "validated", "type": "bool"}],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "address", "name": "offerer", "type": "address"}],
        "name": "getCounter",
        "outputs": [{"internalType": "uint256", "name": "counter", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    }
];

// Get wallet provider (Rabby or MetaMask)
function getWalletProvider() {
    if (window.rabby) return window.rabby;
    if (window.ethereum) return window.ethereum;
    return null;
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    const connectBtn = document.getElementById('connectWallet');
    const walletAddressBtn = document.getElementById('walletAddressBtn');
    const approveBtn = document.getElementById('approveBtn');

    connectBtn.addEventListener('click', () => {
        document.getElementById('walletModal').style.display = 'flex';
    });

    walletAddressBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to disconnect your wallet?')) {
            disconnectWallet();
        }
    });

    if (approveBtn) {
        approveBtn.addEventListener('click', approveMarketplace);
    }

    checkPreviousConnection();
});

// Check if wallet was previously connected
async function checkPreviousConnection() {
    walletProvider = getWalletProvider();

    if (walletProvider) {
        try {
            const accounts = await walletProvider.request({ method: 'eth_accounts' });
            if (accounts.length > 0) {
                await initializeWallet(accounts[0]);
            }
        } catch (error) {
            console.error('Error checking previous connection:', error);
        }
    }
}

// Connect wallet
async function connectWallet() {
    try {
        walletProvider = getWalletProvider();

        if (!walletProvider) {
            // Show error message in modal
            const modalBody = document.querySelector('#walletModal .modal-body');
            if (modalBody) {
                modalBody.innerHTML = `
                    <div style="padding: 24px; text-align: center;">
                        <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
                        <h3 style="margin: 0 0 12px 0; color: var(--text-primary);">No Wallet Detected</h3>
                        <p style="margin: 0 0 24px 0; color: var(--text-secondary); line-height: 1.6;">
                            Please install a Web3 wallet extension (Rabby, MetaMask, or else ERC20 wallets) to connect to this marketplace.
                        </p>
                        <button class="btn-primary" onclick="location.reload()">
                            Refresh Page
                        </button>
                    </div>
                `;
            }
            showToast('Please install Rabby, MetaMask or another Web3 wallet');
            return;
        }

        const accounts = await walletProvider.request({
            method: 'eth_requestAccounts'
        });

        await initializeWallet(accounts[0]);
        closeModal();
        showToast('Wallet connected successfully', 'success');

        walletProvider.on('accountsChanged', handleAccountsChanged);
        walletProvider.on('chainChanged', () => window.location.reload());

    } catch (error) {
        console.error('Error connecting wallet:', error);
        if (error.code === 4001) {
            showToast('Connection rejected by user');
        } else {
            showToast('Failed to connect wallet');
        }
    }
}

// Initialize wallet
async function initializeWallet(address) {
    try {
        ethersProvider = new ethers.providers.Web3Provider(walletProvider);
        signer = ethersProvider.getSigner();
        userAddress = address;

        // Get YB token balance
        const ybTokenContract = new ethers.Contract(YB_TOKEN_ADDRESS, YB_TOKEN_ABI, ethersProvider);
        const ybBalance = await ybTokenContract.balanceOf(address);
        const formattedYbBalance = ethers.utils.formatEther(ybBalance);
        const shortAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;

        document.getElementById('walletBalance').textContent = `${Math.floor(parseFloat(formattedYbBalance)).toLocaleString()} YB`;
        document.getElementById('walletAddress').textContent = shortAddress;
        document.getElementById('connectWallet').style.display = 'none';
        document.getElementById('walletConnected').style.display = 'flex';

        // Show tabs navigation
        document.getElementById('tabsSection').style.display = 'block';

        // Check approval status in background
        await checkApprovalStatus();

        // Switch to marketplace tab by default
        switchTab('marketplace');

    } catch (error) {
        console.error('Error initializing wallet:', error);
        showToast('Error loading wallet data');
    }
}

// Disconnect wallet
function disconnectWallet() {
    ethersProvider = null;
    signer = null;
    userAddress = null;

    document.getElementById('connectWallet').style.display = 'block';
    document.getElementById('walletConnected').style.display = 'none';
    document.getElementById('tabsSection').style.display = 'none';
    document.getElementById('sellerSection').style.display = 'none';
    document.getElementById('myListingSection').style.display = 'none';
    document.getElementById('marketplaceSection').style.display = 'none';

    if (walletProvider) {
        walletProvider.removeAllListeners('accountsChanged');
        walletProvider.removeAllListeners('chainChanged');
    }

    showToast('Wallet disconnected');
}

// Handle account changes
async function handleAccountsChanged(accounts) {
    if (accounts.length === 0) {
        disconnectWallet();
    } else {
        await initializeWallet(accounts[0]);
    }
}

// Close modal
function closeModal() {
    document.getElementById('walletModal').style.display = 'none';
}

// Show toast notification
function showToast(message, type = '') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast show ${type}`;

    setTimeout(() => {
        toast.className = 'toast';
    }, 5000);
}

// Check approval status and locked amount
async function checkApprovalStatus() {
    if (!ethersProvider || !userAddress) return;

    try {
        const nftContract = new ethers.Contract(VEYB_NFT_ADDRESS, ERC721_ABI, ethersProvider);

        // Check NFT balance (should be 0 or 1)
        const balance = await nftContract.balanceOf(userAddress);
        const hasNFT = balance.gt(0);

        // Check locked amount
        const lockedData = await nftContract.locked(userAddress);
        const lockedAmount = lockedData.amount; // int256
        const lockEnd = lockedData.end; // uint256

        // Format locked amount (assuming 18 decimals like YB token)
        const formattedAmount = ethers.utils.formatEther(lockedAmount.abs());

        // Check if lock is active
        const now = Math.floor(Date.now() / 1000);
        const isLockActive = lockEnd.gt(now);

        // Check if permalock (lock end is very far in the future - more than 10 years)
        const tenYearsFromNow = now + (10 * 365 * 24 * 60 * 60);
        const isPermalock = lockEnd.gt(tenYearsFromNow);

        // Check voting power using GaugeController
        let hasVotingPower = false;

        if (hasNFT) {
            try {
                const gaugeController = new ethers.Contract(GAUGE_CONTROLLER_ADDRESS, GAUGE_CONTROLLER_ABI, ethersProvider);
                const transferAllowed = await gaugeController.ve_transfer_allowed(userAddress);
                hasVotingPower = !transferAllowed; // If transfer NOT allowed, then has voting power
            } catch (error) {
                console.log('Could not check voting power:', error);
            }
        }

        // Display locked amount
        if (hasNFT && isLockActive) {
            document.getElementById('nftBalance').textContent = `${parseFloat(formattedAmount).toLocaleString()} veYB (locked)`;
        } else if (hasNFT) {
            document.getElementById('nftBalance').textContent = `${parseFloat(formattedAmount).toLocaleString()} veYB (expired)`;
        } else {
            document.getElementById('nftBalance').textContent = '0 veYB (no veYB NFT)';
        }

        // Update selling amount in listing form
        if (typeof updateSellingAmount === 'function') {
            const veYBAmount = hasNFT ? parseFloat(formattedAmount) : 0;
            updateSellingAmount(veYBAmount);
        }

        // Display permalock status
        const permalockEl = document.getElementById('permalockStatus');
        if (hasNFT && isPermalock) {
            permalockEl.innerHTML = '<span style="color: var(--success);">✓ Permalock Active</span>';
        } else if (hasNFT && isLockActive) {
            const lockEndDate = new Date(lockEnd.toNumber() * 1000).toLocaleDateString();
            permalockEl.innerHTML = `<span style="color: var(--text-secondary);">Temporary lock until ${lockEndDate}</span>`;
        } else if (hasNFT) {
            permalockEl.innerHTML = '<span style="color: var(--text-secondary);">Lock expired</span>';
        } else {
            permalockEl.textContent = 'No veYB NFT';
        }

        // Update navbar wallet stats
        const walletLockAmount = document.getElementById('walletLockAmount');
        const walletPermalockBadge = document.getElementById('walletPermalockBadge');

        if (hasNFT && isLockActive && !isPermalock) {
            // Has veYB but no permalock
            walletLockAmount.textContent = `${Math.floor(parseFloat(formattedAmount)).toLocaleString()} veYB - No permalock!`;
            walletLockAmount.style.display = 'inline';
            walletLockAmount.style.opacity = '0.5';
            walletLockAmount.style.color = '';
        } else if (hasNFT && isLockActive) {
            // Has veYB with permalock
            walletLockAmount.textContent = `${Math.floor(parseFloat(formattedAmount)).toLocaleString()} veYB`;
            walletLockAmount.style.display = 'inline';
            walletLockAmount.style.opacity = '1';
            walletLockAmount.style.color = '';
        } else {
            // No veYB
            walletLockAmount.textContent = 'No veYB';
            walletLockAmount.style.display = 'inline';
            walletLockAmount.style.opacity = '0.5';
            walletLockAmount.style.color = '';
        }

        if (hasNFT && isPermalock) {
            walletPermalockBadge.style.display = 'inline-flex';
        } else {
            walletPermalockBadge.style.display = 'none';
        }

        const statusEl = document.getElementById('approvalStatus');
        const approveBtn = document.getElementById('approveBtn');

        // Check if user has voting power - blocks transfers
        if (hasNFT && hasVotingPower) {
            statusEl.innerHTML = `
                <div class="status-not-approved">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <circle cx="10" cy="10" r="9" stroke="currentColor" stroke-width="2" fill="none"/>
                        <path d="M10 6V10M10 13V14" stroke="currentColor" stroke-width="2"/>
                    </svg>
                    <span>Active Voting Power Blocks Transfer</span>
                </div>
            `;
            approveBtn.style.display = 'none';
            document.getElementById('listingCard').style.display = 'none';

            // Add explanation message
            const cardBody = statusEl.closest('.card-body');
            let explanationEl = cardBody.querySelector('.permalock-explanation');
            if (!explanationEl) {
                explanationEl = document.createElement('div');
                explanationEl.className = 'permalock-explanation';
                explanationEl.style.cssText = 'margin-top: 16px; padding: 16px; background: rgba(232, 213, 183, 0.1); border: 1px solid rgba(232, 213, 183, 0.3); border-radius: 8px; color: var(--text-secondary); line-height: 1.6;';
                cardBody.appendChild(explanationEl);
            }
            // Check when user last voted to show countdown
            explanationEl.innerHTML = `
                <p style="margin: 0 0 12px 0;"><strong>Your veYB NFT cannot be transferred while it has active voting power.</strong></p>
                <p style="margin: 0 0 12px 0;">To sell your NFT, you must first reset your votes by setting all gauge weights to zero.</p>
                <p style="margin: 0 0 12px 0; font-size: 13px; color: var(--text-secondary);">Note: You can only update votes on a gauge once every 10 days.</p>
                <div id="voteResetContainer" style="display: flex; gap: 12px; margin-top: 16px;">
                    <div class="spinner" style="width: 24px; height: 24px; border-width: 2px; margin: 0 auto;"></div>
                    <p style="margin: 0; color: var(--text-secondary);">Checking last vote time...</p>
                </div>
            `;

            // Check last vote time and update UI
            setTimeout(async () => {
                const container = document.getElementById('voteResetContainer');
                if (!container) return;

                const lastVoteTime = await getLastVoteTimestamp(userAddress);
                const now = Math.floor(Date.now() / 1000);
                const tenDaysInSeconds = 10 * 24 * 60 * 60;
                const timeSinceVote = now - lastVoteTime;
                const timeRemaining = tenDaysInSeconds - timeSinceVote;

                if (lastVoteTime === 0 || timeRemaining <= 0) {
                    // Can reset now
                    container.innerHTML = `
                        <button id="resetVotesBtn" class="btn-primary">
                            Reset All Votes
                        </button>
                        <a href="https://yieldbasis.com/vote" target="_blank" class="btn-secondary no-hover-effect" style="display: inline-flex; align-items: center; justify-content: center; text-decoration: none;">
                            Go to Voting Page
                        </a>
                    `;

                    const resetBtn = document.getElementById('resetVotesBtn');
                    if (resetBtn) {
                        resetBtn.onclick = function(e) {
                            e.preventDefault();
                            resetAllVotes(this);
                        };
                    }
                } else {
                    // Must wait - show countdown
                    const updateCountdown = () => {
                        const now = Math.floor(Date.now() / 1000);
                        const remaining = tenDaysInSeconds - (now - lastVoteTime);

                        if (remaining <= 0) {
                            // Time's up - reload to show button
                            checkApprovalStatus();
                            return;
                        }

                        const timeStr = formatTimeRemaining(remaining);
                        container.innerHTML = `
                            <div style="padding: 12px; background: rgba(255, 193, 7, 0.1); border: 1px solid rgba(255, 193, 7, 0.3); border-radius: 8px; flex: 1;">
                                <p style="margin: 0 0 4px 0; font-size: 13px; color: var(--text-secondary);">Next vote reset available in:</p>
                                <p style="margin: 0; font-size: 18px; font-weight: 700; color: var(--primary);" id="countdownTimer">${timeStr}</p>
                            </div>
                            <a href="https://yieldbasis.com/vote" target="_blank" class="btn-secondary no-hover-effect" style="display: inline-flex; align-items: center; justify-content: center; text-decoration: none; white-space: nowrap;">
                                Go to Voting Page
                            </a>
                        `;
                    };

                    updateCountdown();
                    // Update countdown every minute
                    setInterval(updateCountdown, 60000);
                }
            }, 0);

            return;
        }

        // Check if user has permalock - required to sell
        if (!hasNFT || !isPermalock) {
            statusEl.innerHTML = `
                <div class="status-not-approved">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <circle cx="10" cy="10" r="9" stroke="currentColor" stroke-width="2" fill="none"/>
                        <path d="M10 6V10M10 13V14" stroke="currentColor" stroke-width="2"/>
                    </svg>
                    <span>Permalock Required to Sell</span>
                </div>
            `;
            approveBtn.style.display = 'none';
            document.getElementById('listingCard').style.display = 'none';

            // Add explanation message
            const cardBody = statusEl.closest('.card-body');
            let explanationEl = cardBody.querySelector('.permalock-explanation');
            if (!explanationEl) {
                explanationEl = document.createElement('div');
                explanationEl.className = 'permalock-explanation';
                explanationEl.style.cssText = 'margin-top: 16px; padding: 16px; background: rgba(232, 213, 183, 0.1); border: 1px solid rgba(232, 213, 183, 0.3); border-radius: 8px; color: var(--text-secondary); line-height: 1.6;';
                cardBody.appendChild(explanationEl);
            }
            explanationEl.innerHTML = `
                <p style="margin: 0 0 12px 0;">The veYB NFT contract requires both seller and buyer to have permalock for transfers.</p>
                <p style="margin: 0 0 12px 0;">To sell your veYB NFT, you need apply permalock.</p>
                <a href="https://yieldbasis.com/lock" target="_blank" class="btn-primary" style="display: inline-flex; text-decoration: none; margin-top: 8px;">
                    Go to Lock Page
                </a>
            `;
            return;
        }

        // Remove explanation if it exists
        const cardBody = statusEl.closest('.card-body');
        const explanationEl = cardBody.querySelector('.permalock-explanation');
        if (explanationEl) {
            explanationEl.remove();
        }

        // Check if approved
        const isApproved = await nftContract.isApprovedForAll(userAddress, MARKETPLACE_ADDRESS);
        approveBtn.style.display = 'inline-flex';

        if (isApproved) {
            statusEl.innerHTML = `
                <div class="status-approved">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <circle cx="10" cy="10" r="9" fill="currentColor" opacity="0.2"/>
                        <path d="M6 10L9 13L14 7" stroke="currentColor" stroke-width="2" fill="none"/>
                    </svg>
                    <span>✓ Marketplace approved</span>
                </div>
            `;
            approveBtn.disabled = true;
            approveBtn.textContent = '✓ Already Approved';

            // Show Step 2 - Create Listing
            document.getElementById('listingCard').style.display = 'block';
        } else {
            statusEl.innerHTML = `
                <div class="status-not-approved">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <circle cx="10" cy="10" r="9" stroke="currentColor" stroke-width="2" fill="none"/>
                        <path d="M10 6V10M10 13V14" stroke="currentColor" stroke-width="2"/>
                    </svg>
                    <span>Approval required to list NFTs</span>
                </div>
            `;
            approveBtn.disabled = false;
            document.getElementById('listingCard').style.display = 'none';
        }

    } catch (error) {
        console.error('Error checking approval:', error);
        showToast('Error checking approval status');
    }
}

// Approve marketplace
async function approveMarketplace() {
    if (!ethersProvider || !signer) {
        showToast('Please connect your wallet first');
        return;
    }

    const approveBtn = document.getElementById('approveBtn');
    const originalText = approveBtn.innerHTML;

    try {
        approveBtn.disabled = true;
        approveBtn.classList.add('btn-loading');
        approveBtn.textContent = 'Waiting for confirmation...';

        const nftContract = new ethers.Contract(VEYB_NFT_ADDRESS, ERC721_ABI, signer);
        const tx = await nftContract.setApprovalForAll(MARKETPLACE_ADDRESS, true);

        approveBtn.textContent = 'Transaction pending...';
        showToast('Approval transaction submitted', 'success');

        await tx.wait();

        approveBtn.classList.remove('btn-loading');
        showToast('Marketplace approved successfully!', 'success');
        await checkApprovalStatus();

    } catch (error) {
        console.error('Error approving marketplace:', error);

        if (error.code === 4001) {
            showToast('Transaction rejected by user');
        } else if (error.code === 'ACTION_REJECTED') {
            showToast('Transaction rejected');
        } else {
            showToast('Error approving marketplace');
        }

        approveBtn.disabled = false;
        approveBtn.classList.remove('btn-loading');
        approveBtn.innerHTML = originalText;
    }
}

// Tab switching functionality
function switchTab(tabName) {
    // Update tab buttons
    const allTabs = document.querySelectorAll('.tab-btn');
    allTabs.forEach(tab => {
        if (tab.dataset.tab === tabName) {
            tab.classList.add('active');
            tab.style.background = 'linear-gradient(135deg, #f8fafc 0%, #cbd5e1 100%)';
        } else {
            tab.classList.remove('active');
            tab.style.background = 'transparent';
        }
    });

    // Hide all sections
    document.getElementById('sellerSection').style.display = 'none';
    document.getElementById('myListingSection').style.display = 'none';
    document.getElementById('marketplaceSection').style.display = 'none';

    // Show selected section
    if (tabName === 'marketplace') {
        document.getElementById('marketplaceSection').style.display = 'block';
        if (typeof showMarketplace === 'function') {
            showMarketplace();
        }
    } else if (tabName === 'mylistings') {
        document.getElementById('myListingSection').style.display = 'block';
        if (typeof showSellerDashboard === 'function') {
            // Check if marketplace is loading or events are cached
            const eventsNotLoaded = typeof cachedBlockchainEvents === 'undefined' || cachedBlockchainEvents === null;
            const marketplaceLoading = typeof isLoadingMarketplace !== 'undefined' && isLoadingMarketplace;

            if (eventsNotLoaded && !marketplaceLoading) {
                // Events not loaded and marketplace not loading - load marketplace first
                console.log('Loading marketplace data first to populate events cache...');
                if (typeof showMarketplace === 'function') {
                    showMarketplace().then(() => {
                        showSellerDashboard();
                    });
                }
            } else if (marketplaceLoading) {
                // Marketplace is loading - wait for it and show loading state
                console.log('Marketplace is loading, waiting for completion...');
                const container = document.getElementById('myListingContainer');
                container.innerHTML = `
                    <div class="empty-state">
                        <div class="spinner" style="width: 48px; height: 48px; border-width: 4px; margin: 0 auto 20px;"></div>
                        <h3>Loading marketplace data...</h3>
                        <p>Please wait while marketplace data is being loaded</p>
                    </div>
                `;
                // Wait for marketplace to finish loading
                const checkInterval = setInterval(() => {
                    if (!isLoadingMarketplace && cachedBlockchainEvents !== null) {
                        clearInterval(checkInterval);
                        showSellerDashboard();
                    }
                }, 500);
            } else {
                // Events are cached - use them
                showSellerDashboard();
            }
        }
    } else if (tabName === 'create') {
        document.getElementById('sellerSection').style.display = 'block';
        if (typeof checkApprovalStatus === 'function') {
            checkApprovalStatus();
        }
    }
}

// Get user's last vote timestamp by checking recent VoteForGauge events
async function getLastVoteTimestamp(userAddr) {
    try {
        const gaugeController = new ethers.Contract(GAUGE_CONTROLLER_ADDRESS, GAUGE_CONTROLLER_ABI, ethersProvider);

        // Since event parameters are not indexed, we need to get all events and filter manually
        // Scan from contract deployment (or reasonable starting block)
        const currentBlock = await ethersProvider.getBlockNumber();
        // GaugeController was deployed around block 18000000, but let's scan last 6 months to be safe
        const blocksIn6Months = Math.floor((180 * 24 * 60 * 60) / 12); // ~6 months
        const fromBlock = Math.max(18000000, currentBlock - blocksIn6Months);

        console.log(`Checking VoteForGauge events for ${userAddr} from block ${fromBlock} to ${currentBlock}`);

        // Get all VoteForGauge events (no filter since params aren't indexed)
        const filter = gaugeController.filters.VoteForGauge();
        const allEvents = await gaugeController.queryFilter(filter, fromBlock, currentBlock);

        console.log(`Found ${allEvents.length} total VoteForGauge events`);

        // Filter events for this specific user
        const userEvents = allEvents.filter(event =>
            event.args.user.toLowerCase() === userAddr.toLowerCase()
        );

        console.log(`Found ${userEvents.length} VoteForGauge events for user ${userAddr}`);

        if (userEvents.length === 0) {
            console.log('No votes found for this user, returning 0');
            return 0; // No votes found
        }

        // Get the most recent vote timestamp
        const lastEvent = userEvents[userEvents.length - 1];
        const lastVoteTime = lastEvent.args.time.toNumber();
        const lastVoteDate = new Date(lastVoteTime * 1000);

        console.log(`Last vote was at timestamp ${lastVoteTime} (${lastVoteDate.toLocaleString()})`);

        return lastVoteTime;
    } catch (error) {
        console.error('Error getting last vote timestamp:', error);
        return 0;
    }
}

// Format time remaining as string
function formatTimeRemaining(seconds) {
    if (seconds <= 0) return 'Available now';

    const days = Math.floor(seconds / (24 * 60 * 60));
    const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((seconds % (60 * 60)) / 60);

    if (days > 0) {
        return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
        return `${hours}h ${minutes}m`;
    } else {
        return `${minutes}m`;
    }
}

// Reset all votes (set all gauge weights to zero)
async function resetAllVotes(buttonElement) {
    if (!ethersProvider || !signer || !userAddress) {
        showToast('Please connect your wallet first');
        return;
    }

    // Try to find button - either passed as parameter or look for known IDs
    const resetBtn = buttonElement ||
                     document.getElementById('resetVotesBtn') ||
                     document.getElementById('resetVotesFromListingsBtn');

    if (!resetBtn) {
        console.error('Reset button not found');
        return;
    }

    const originalText = resetBtn.innerHTML;

    try {
        resetBtn.disabled = true;
        resetBtn.classList.add('btn-loading');
        resetBtn.textContent = 'Checking votes...';

        // Create GaugeController contract instance
        const gaugeController = new ethers.Contract(GAUGE_CONTROLLER_ADDRESS, GAUGE_CONTROLLER_ABI, ethersProvider);

        // Check if transfer is allowed (no voting power)
        const transferAllowed = await gaugeController.ve_transfer_allowed(userAddress);

        if (transferAllowed) {
            showToast('You have no active votes to reset', 'success');
            resetBtn.classList.remove('btn-loading');
            resetBtn.disabled = false;
            resetBtn.innerHTML = originalText;
            // Refresh approval status
            if (typeof checkApprovalStatus === 'function') {
                await checkApprovalStatus();
            }
            return;
        }

        // Proceed with reset
        resetBtn.textContent = 'Preparing transaction...';

        const gaugeControllerWithSigner = gaugeController.connect(signer);

        // Send the transaction
        resetBtn.textContent = 'Waiting for wallet confirmation...';
        const tx = await gaugeControllerWithSigner.vote_for_gauge_weights([], []);

        resetBtn.textContent = 'Transaction pending...';
        showToast('Reset transaction submitted', 'success');

        await tx.wait();

        resetBtn.classList.remove('btn-loading');
        showToast('All votes reset successfully!', 'success');

        // Refresh approval status and reload listings if needed
        if (typeof checkApprovalStatus === 'function') {
            await checkApprovalStatus();
        }

        // Reload My Listings if we're on that tab
        if (typeof showSellerDashboard === 'function') {
            cachedSellerListings = null; // Clear cache to force reload
            await showSellerDashboard(true);
        }

    } catch (error) {
        console.error('Error resetting votes:', error);

        if (resetBtn) {
            resetBtn.classList.remove('btn-loading');
            resetBtn.disabled = false;
            resetBtn.innerHTML = originalText;
        }

        if (error.code === 4001 || error.code === 'ACTION_REJECTED') {
            showToast('Transaction rejected by user');
        } else if (error.message && error.message.includes('10 days')) {
            showToast('You need to wait 10 days since your last vote before resetting', 'error');
        } else {
            const errorMsg = error.reason || error.message || 'Unknown error';
            showToast(`Error resetting votes: ${errorMsg}`, 'error');
        }
    }
}
