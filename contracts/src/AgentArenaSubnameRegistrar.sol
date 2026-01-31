// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Ownable } from "./utils/Ownable.sol";
import { IENSRegistry } from "./ens/IENSRegistry.sol";
import { ITextResolver } from "./ens/ITextResolver.sol";

contract AgentArenaSubnameRegistrar is Ownable {
    error InvalidLabel();
    error InvalidOwner();
    error LengthMismatch();

    IENSRegistry public immutable ens;
    ITextResolver public immutable resolver;
    bytes32 public immutable parentNode;

    event SubnameRegistered(bytes32 indexed node, string label, address indexed owner);

    constructor(address initialOwner, address ensRegistry, address defaultResolver, bytes32 parentNamehash)
        Ownable(initialOwner)
    {
        ens = IENSRegistry(ensRegistry);
        resolver = ITextResolver(defaultResolver);
        parentNode = parentNamehash;
    }

    /// @notice Register `label.parent` for `owner`, set resolver + optional text records, then transfer ownership.
    /// @dev Assumes this contract is the owner of `parentNode`.
    function register(
        string calldata label,
        address owner_,
        string[] calldata keys,
        string[] calldata values
    ) external returns (bytes32 node) {
        if (owner_ == address(0)) revert InvalidOwner();
        if (bytes(label).length == 0) revert InvalidLabel();
        if (keys.length != values.length) revert LengthMismatch();

        bytes32 labelhash = keccak256(bytes(label));
        node = keccak256(abi.encodePacked(parentNode, labelhash));

        // Own subnode temporarily to set records.
        ens.setSubnodeOwner(parentNode, labelhash, address(this));
        ens.setResolver(node, address(resolver));
        resolver.setAddr(node, owner_);
        for (uint256 i = 0; i < keys.length; i++) {
            resolver.setText(node, keys[i], values[i]);
        }

        // Transfer subname ownership to user.
        ens.setOwner(node, owner_);

        emit SubnameRegistered(node, label, owner_);
    }
}

