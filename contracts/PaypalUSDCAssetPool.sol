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
    mapping(address => string) public sellersPaypalAccount;
    IERC20 public usdcToken;
    
    mapping(address => uint256) public sellerBalance;

    constructor(
        ICommitmentVerifier _commitmentVerifier,
        IWithdrawalVerifier _withdrawalVerifier,
        IHasher _hasher,
        uint32 _merkleTreeHeight,
        address _USDCTokenAddress
    ) AssetPool(_commitmentVerifier, 
                _withdrawalVerifier, 
                _hasher, 
                _merkleTreeHeight) {
        usdcToken = IERC20(_USDCTokenAddress);
    }

    function configSeller(
                            string memory _paypalEmailAddress
                          ) external {
        sellersPaypalAccount[msg.sender] = _paypalEmailAddress;
    }

    function _processCommitmentInsertion() internal override {
    }

    function _processWithdrawal(    
                                address payable _recipient,
                                address payable _relayer,
                                uint256 _amount,
                                uint256 _fee) 
                                internal override {
        (bool success, ) = _recipient.call{ value: _amount - _fee }("");

        require(success, "Payment to recipient failed");

        if (_fee > 0) {
            (success, ) = _relayer.call{ value: _fee }("");
            require(success, "Payment to relayer failed");
        }                                    
    }

    function getUSDCTokenAddress() external view returns (address) {
        return address(usdcToken);
    }

/**
    @dev Deposit funds from seller
**/
    function sellerDeposit(uint256 _amount) external {
        usdcToken.transferFrom(msg.sender, address(this), _amount);
        sellerBalance[msg.sender] += _amount;

        emit SellerDeposit(msg.sender, _amount);
    }

    function getSellerBalance() external view returns (uint256) {
        return sellerBalance[msg.sender];
    }
}
