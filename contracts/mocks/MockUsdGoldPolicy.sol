pragma solidity 0.4.24;

import "./Mock.sol";


contract MockUsdGoldPolicy is Mock {

    function rebase() external {
        emit FunctionCalled("UsdGoldPolicy", "rebase", msg.sender);
    }
}
