// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title MockUSDC
/// @notice 精简版 ERC-20, 模拟 USDC (6 decimals), 用于 demo 制造授权场景。
///         仅测试网使用, 非生产代币。
contract MockUSDC {
    string public name = "Mock USD Coin";
    string public symbol = "mUSDC";
    uint8 public decimals = 6;

    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    /// @notice 铸币 (demo 专用, 任何人可 mint, 仅 Fuji 测试网使用)
    function mint(address to, uint256 amount) external {
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        return _transfer(msg.sender, to, amount);
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= amount, "mUSDC: allowance too low");
        if (allowed != type(uint256).max) {
            uint256 newAllowance = allowed - amount;
            allowance[from][msg.sender] = newAllowance;
            // 对齐 OpenZeppelin: allowance 变化也发事件, 便于链上审计
            emit Approval(from, msg.sender, newAllowance);
        }
        return _transfer(from, to, amount);
    }

    function _transfer(address from, address to, uint256 amount) internal returns (bool) {
        require(balanceOf[from] >= amount, "mUSDC: balance too low");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }
}
