// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {MockUSDT} from "../src/MockUSDT.sol";

/// @notice 部署 MockUSDT 并制造第二类授权场景 (多 token 演示)
///   给"正常dApp"授权 1000 mUSDT (高), 给"钓鱼合约"授权 300 mUSDT (中)
contract DeployUSDT is Script {
    address constant SPENDER_NORMAL = 0x000000000000000000000000000000000000dEaD;
    address constant SPENDER_RISKY  = 0x1111111111111111111111111111111111111111;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);

        vm.startBroadcast(pk);
        MockUSDT usdt = new MockUSDT();
        usdt.mint(deployer, 10000e6);
        // 正常 dApp 授权 1000 (高), 钓鱼合约授权 300 (中) —— 制造不同风险等级
        usdt.approve(SPENDER_NORMAL, 1000e6);
        usdt.approve(SPENDER_RISKY, 300e6);
        vm.stopBroadcast();

        console.log("MockUSDT deployed at:", address(usdt));
        console.log("owner:", deployer);
    }
}
