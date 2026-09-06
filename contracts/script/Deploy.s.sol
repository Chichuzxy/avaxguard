// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {AllowanceScanner} from "../src/AllowanceScanner.sol";

/// @notice 现场部署脚本 (Fuji testnet):
///   forge script script/Deploy.s.sol --rpc-url $FUJI_RPC --private-key $PK --broadcast
///   - 部署 MockUSDC + AllowanceScanner
///   - mint 给部署者
///   - 制造 demo 风险场景: 部署者对两个 spender 授权 (一个正常额度, 一个无限授权)
///   spender 地址可在下方常量修改, 演示时用 MetaMask 演示钱包地址。
contract Deploy is Script {
    // demo 场景中被授权的 spender (现场可改为队友钱包地址)
    address constant SPENDER_NORMAL = 0x000000000000000000000000000000000000dEaD; // placeholder
    address constant SPENDER_RISKY  = 0x1111111111111111111111111111111111111111; // placeholder

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);

        vm.startBroadcast(pk);
        MockUSDC usdc = new MockUSDC();
        AllowanceScanner scanner = new AllowanceScanner();

        // 铸造 10000 mUSDC 给部署者 (MockUSDC mint 无返回值, 直接调用)
        usdc.mint(deployer, 10000e6);

        // 制造风险场景: 给"正常 dApp"授权 500, 给"未知合约"无限授权
        bool okA1 = usdc.approve(SPENDER_NORMAL, 500e6);
        bool okA2 = usdc.approve(SPENDER_RISKY, type(uint256).max);
        require(okA1 && okA2, "approve failed");
        vm.stopBroadcast();

        console.log("MockUSDC deployed at:", address(usdc));
        console.log("AllowanceScanner deployed at:", address(scanner));
        console.log("owner:", deployer);
        console.log("SPENDER_NORMAL:", SPENDER_NORMAL, "allowance 500e6");
        console.log("SPENDER_RISKY:", SPENDER_RISKY, "allowance max");
    }
}
