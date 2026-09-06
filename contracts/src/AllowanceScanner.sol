// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title AllowanceScanner
/// @notice 批量查询 ERC-20 授权的只读工具合约。
///         前端/后端一次 RPC 调用即可拿到 owner 对多个 token x spender 的授权额度。
///         纯 view, 无状态, 不保存任何数据。
///         容错: 单个 token 不是 ERC-20 合约时该项返回 0, 不影响其他项。
interface IERC20Min {
    function allowance(address owner, address spender) external view returns (uint256);
}

contract AllowanceScanner {
    /// @notice 批量查询授权
    /// @param owner 资产持有者地址
    /// @param tokens ERC-20 代币地址列表
    /// @param spenders 被授权方地址列表 (dApp/合约)
    /// @return 扁平化结果, 长度 = tokens.length * spenders.length, 顺序按 [token0][spender0..n], [token1][...]
    function getAllowances(
        address owner,
        address[] calldata tokens,
        address[] calldata spenders
    ) external view returns (uint256[] memory) {
        uint256[] memory result = new uint256[](tokens.length * spenders.length);
        uint256 idx;
        for (uint256 i; i < tokens.length; ++i) {
            // 无 code = EOA 或空合约: 直接记 0 (对无代码地址调用会成功但解码失败,
            // try/catch 捕获不到, 必须先查 code 长度)
            bool hasCode = tokens[i].code.length > 0;
            for (uint256 j; j < spenders.length; ++j) {
                if (!hasCode) {
                    result[idx++] = 0;
                    continue;
                }
                // try/catch: 有 code 但不兼容 ERC20 (如 allowance 签名不同/revert),
                // 该项记 0, 不影响其余查询
                try IERC20Min(tokens[i]).allowance(owner, spenders[j]) returns (uint256 val) {
                    result[idx++] = val;
                } catch {
                    result[idx++] = 0;
                }
            }
        }
        return result;
    }
}
