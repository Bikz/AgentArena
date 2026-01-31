// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ITextResolver {
    function setAddr(bytes32 node, address a) external;
    function setText(bytes32 node, string calldata key, string calldata value) external;
}

