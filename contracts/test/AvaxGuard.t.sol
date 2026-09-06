// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {AllowanceScanner} from "../src/AllowanceScanner.sol";

contract AvaxGuardTest is Test {
    MockUSDC usdc;
    AllowanceScanner scanner;

    address owner = address(0xA11CE);
    address spender1 = address(0xB0B);      // 模拟正常 dApp
    address spender2 = address(0xBAD);      // 模拟恶意/未知合约

    function setUp() public {
        usdc = new MockUSDC();
        scanner = new AllowanceScanner();
        usdc.mint(owner, 1000e6); // 1000 mUSDC
        vm.prank(owner);
        usdc.approve(spender1, 500e6); // 授权 500 给 dApp
        vm.prank(owner);
        usdc.approve(spender2, type(uint256).max); // 无限授权给"恶意"合约
    }

    function test_ScannerCatchesAllowances() public view {
        address[] memory tokens = new address[](1);
        tokens[0] = address(usdc);
        address[] memory spenders = new address[](2);
        spenders[0] = spender1;
        spenders[1] = spender2;

        uint256[] memory res = scanner.getAllowances(owner, tokens, spenders);
        assertEq(res.length, 2);
        assertEq(res[0], 500e6);        // spender1: 500
        assertEq(res[1], type(uint256).max); // spender2: infinite
    }

    function test_RevokeSetsAllowanceZero() public {
        vm.prank(owner);
        usdc.approve(spender2, 0); // revoke = approve(0)
        assertEq(usdc.allowance(owner, spender2), 0);
    }

    function test_TransferFromRespectsAllowance() public {
        vm.prank(spender1);
        bool ok = usdc.transferFrom(owner, address(this), 100e6);
        assertTrue(ok, "transferFrom should succeed");
        assertEq(usdc.balanceOf(address(this)), 100e6);
        assertEq(usdc.allowance(owner, spender1), 400e6); // 500 - 100
    }

    function test_InfiniteAllowanceNotDecremented() public {
        vm.prank(spender2);
        bool ok = usdc.transferFrom(owner, address(this), 50e6);
        assertTrue(ok, "transferFrom should succeed");
        // max 授权转账不减少授权额度 (标准 ERC-20 行为)
        assertEq(usdc.allowance(owner, spender2), type(uint256).max);
    }

    function test_ScannerToleratesEOAToken() public {
        // EOA 地址当作 token 传入, 不应 revert, 该项返回 0
        address eoa = address(0x1234);
        address[] memory tokens = new address[](2);
        tokens[0] = address(usdc);
        tokens[1] = eoa; // 非合约
        address[] memory spenders = new address[](1);
        spenders[0] = spender1;

        uint256[] memory res = scanner.getAllowances(owner, tokens, spenders);
        assertEq(res.length, 2);
        assertEq(res[0], 500e6); // 正常 token 仍能查到
        assertEq(res[1], 0);     // EOA 容错为 0
    }
}
