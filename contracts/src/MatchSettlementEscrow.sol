// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Ownable } from "./utils/Ownable.sol";

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

contract MatchSettlementEscrow is Ownable {
    IERC20 public immutable token;

    struct MatchPot {
        uint256 amount;
        bool settled;
    }

    mapping(bytes32 => MatchPot) public pots;

    event MatchFunded(bytes32 indexed matchId, uint256 amount);
    event MatchSettled(
        bytes32 indexed matchId,
        address indexed winner,
        uint256 payout,
        uint256 rake,
        address rakeRecipient
    );
    event MatchCancelled(bytes32 indexed matchId, address recipient, uint256 amount);

    constructor(address tokenAddress) {
        require(tokenAddress != address(0), "token");
        token = IERC20(tokenAddress);
    }

    function depositMatchPot(bytes32 matchId, uint256 amount) external onlyOwner {
        require(amount > 0, "amount");
        MatchPot storage pot = pots[matchId];
        require(pot.amount == 0, "funded");
        require(!pot.settled, "settled");
        require(token.transferFrom(msg.sender, address(this), amount), "transferFrom");
        pot.amount = amount;
        emit MatchFunded(matchId, amount);
    }

    function settleMatch(
        bytes32 matchId,
        address winner,
        address rakeRecipient,
        uint16 rakeBps
    ) external onlyOwner {
        require(winner != address(0), "winner");
        require(rakeRecipient != address(0), "rakeRecipient");
        require(rakeBps <= 10_000, "rake");
        MatchPot storage pot = pots[matchId];
        require(pot.amount > 0, "unfunded");
        require(!pot.settled, "settled");
        pot.settled = true;

        uint256 rake = (pot.amount * rakeBps) / 10_000;
        uint256 payout = pot.amount - rake;
        require(token.transfer(winner, payout), "payout");
        if (rake > 0) {
            require(token.transfer(rakeRecipient, rake), "rake");
        }
        emit MatchSettled(matchId, winner, payout, rake, rakeRecipient);
    }

    function cancelMatch(bytes32 matchId, address recipient) external onlyOwner {
        require(recipient != address(0), "recipient");
        MatchPot storage pot = pots[matchId];
        require(pot.amount > 0, "unfunded");
        require(!pot.settled, "settled");
        uint256 amount = pot.amount;
        pot.amount = 0;
        pot.settled = true;
        require(token.transfer(recipient, amount), "refund");
        emit MatchCancelled(matchId, recipient, amount);
    }
}
