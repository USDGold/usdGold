pragma solidity 0.4.24;

import "../Orchestrator.sol";


contract UsdGoldCallerContract {

    function callRebase(address orchestrator) public returns (bool) {
        // Take out a flash loan.
        // Do something funky...
        Orchestrator(orchestrator).rebase();  // should fail
        // pay back flash loan.
        return true;
    }
}
