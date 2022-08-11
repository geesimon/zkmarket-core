// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;

import './Campaign.sol';

interface IHongbao {
    function deposit(bytes32 _commitment) external payable;
    function withdraw(
        uint256[8] calldata _proofData,
        uint256[6] calldata _publicInputs
    ) external payable;
    function transferOwnership(address newOwner) external;
}

contract CampaignManager {
    IHongbao[] public hongbaos;

    struct CampaignStruct {
        address campaignContract;
        string name;
        string description;
    }

    uint256 public currentCampaignIndex = 0;

    mapping(address => uint256[]) public campaignIDs;
    mapping(uint256 => CampaignStruct) campaigns;

    constructor(
        IHongbao[] memory _hongbaos
    ) {
        hongbaos = _hongbaos;
    }

    function createCampaign (string memory _name, 
                            string memory _description) external returns (address) {
        Campaign campaign = new Campaign(_name);
        campaign.transferOwnership(msg.sender);
        
        campaigns[currentCampaignIndex] = CampaignStruct({
                                                campaignContract: address(campaign),
                                                name: _name,
                                                description: _description
                                            });
        campaignIDs[msg.sender].push(currentCampaignIndex);
        
        currentCampaignIndex++;
       
        return address(campaign);
    }

    function getMyCampaignIDs() external view returns (uint256[] memory) {
        return campaignIDs[msg.sender];
    }

    function getCampaignInfo(uint256 campaignID) 
                external view returns (CampaignStruct memory){

        return campaigns[campaignID];
    }
}