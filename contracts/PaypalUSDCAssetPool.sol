// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./AssetPool.sol";

interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) external returns (bool);
}

contract PaypalUSDCAssetPool is AssetPool {
    IERC20 public usdcToken;

    struct sellerInfo {
        string paypalAccount;
        uint balance;
    }

    mapping(address => sellerInfo) public sellers;
    address[] public activeSellers;
    uint32 currentSellerIndex = 0;

    event SellerDeposit(address indexed sellerAddress, string paypalAccount, uint256 amount);
    event SellerPayouts(string indexed paypalAccount, uint256 amount);

    constructor(
        ICommitmentVerifier _commitmentVerifier,
        IWithdrawalVerifier _withdrawalVerifier,
        IHasher _hasher,
        uint32 _merkleTreeHeight,
        IERC20 _USDCToken
    ) AssetPool(_commitmentVerifier, 
                _withdrawalVerifier, 
                _hasher, 
                _merkleTreeHeight) {
        usdcToken = _USDCToken;
    }

    function getUSDCTokenAddress() external view returns (address) {
        return address(usdcToken);
    }

    function _processCommitmentInsertion() internal override {
    }

    function _processWithdrawal(
                                address payable _recipient,
                                address payable _relayer,
                                uint256 _amount,
                                uint256 _fee) 
                                internal override {                                    
        require(usdcToken.balanceOf(address(this)) >= _amount, 
                    "Not enough asset in this pool");
                    
        uint256 transferAmount = _amount - _fee;
        usdcToken.transfer(_recipient, transferAmount);

        uint256 paypalFee = _getPaypalFee(_amount);
        uint256 relayerFee = 0;
        if (_fee > paypalFee ) {
            relayerFee = _fee - paypalFee;
            usdcToken.transfer(_relayer, relayerFee);
        }

        _paySeller(transferAmount);
    }

/**
    @dev Make payouts instructions to paypal to sellers.
         Making it public for testing purpose.
**/
    function paySeller(uint256 _amount) external onlyOwner {
        _paySeller(_amount);
    }

    function _paySeller(uint256 _amount) private {
        uint32 savedIndex = currentSellerIndex;
        uint256 accumulated = 0;

        do {
            address sellerAddress = activeSellers[currentSellerIndex];
            if (sellerAddress != address(0)){
                uint256 remaining = _amount - accumulated;
                uint256 deduct;

                if (sellers[sellerAddress].balance >= remaining) {
                    deduct = remaining;
                } else {
                    deduct = sellers[sellerAddress].balance;
                    activeSellers[currentSellerIndex] = address(0); //remove this address since its balance is 0
                }
                sellers[sellerAddress].balance -= deduct;
                emit SellerPayouts(sellers[sellerAddress].paypalAccount, deduct);

                accumulated += deduct;
            }

            currentSellerIndex++;
            if (currentSellerIndex == activeSellers.length) currentSellerIndex = 0;
        } while (accumulated < _amount && currentSellerIndex != savedIndex);

        require (accumulated == _amount, "Not enough fund in seller's balance");
    }

/**
    @dev Calculate paypal fee: USD_Amount * 0.349% + 0.49
**/
    function _getPaypalFee(uint256 _amount) pure private returns (uint256) {
        return (_amount * 349) / 10000 + 49 * (10 ** 4);
    }

/** 
    @dev Calculate fee: 4%
**/
    function _getFee(uint256 _amount) pure internal override returns (uint256) {
        return (_amount * 4) / 100;
    }

/**
    @dev Deposit funds from seller
**/
    function sellerDeposit(string memory _paypalAccount, uint256 _amount) external {            
        require(bytes(_paypalAccount).length > 8, "Bad paypal account");
        require(_amount > 0, "The amount should greater than zero");

        sellers[msg.sender].paypalAccount = _paypalAccount;
        usdcToken.transferFrom(msg.sender, address(this), _amount);
        sellers[msg.sender].balance += _amount;

        // Insert seller to the available spot in activeSellers
        uint i = 0;
        for (; i < activeSellers.length; i++) {
            if (activeSellers[i] == address(0)) {
                activeSellers[i] = msg.sender;
                break;
            }
        }
        if (i == activeSellers.length) {
            activeSellers.push(msg.sender);
        }

        emit SellerDeposit(msg.sender, _paypalAccount, _amount);
    }

    function getSellerInfo() external view returns (sellerInfo memory) {
        return sellers[msg.sender];
    }

    function getBalance(address _address) view external override returns (uint256) {
        return usdcToken.balanceOf(_address);
    }
}