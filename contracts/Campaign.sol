// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";

contract Campaign is Ownable {
    string public name;
    event Received(address, uint);

    constructor (string memory _name) {
        name = _name;    
    }

    function give() external payable{
        emit Received(msg.sender, msg.value);
    }

    fallback() external payable { 
        emit Received(msg.sender, msg.value);
    }

    receive() external payable {
        emit Received(msg.sender, msg.value);
    }

    function withdraw  () external payable onlyOwner {
        payable(msg.sender).transfer(address(this).balance);
    }
}