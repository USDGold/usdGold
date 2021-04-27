const MockDownstream = artifacts.require('MockDownstream.sol');
const mockUsdGoldPolicy = artifacts.require('MockUsdGoldPolicy.sol');
const Orchestrator = artifacts.require('Orchestrator.sol');
const usdGoldCallerContract = artifacts.require('UsdGoldCallerContract.sol');
const constructorUsdGoldCallerContract = artifacts.require('ConstructorUsdGoldCallerContract.sol');
const truffleAssert = require('truffle-assertions');
const BigNumber = web3.utils.BN;
const _require = require('app-root-path').require;
const BlockchainCaller = _require('/util/blockchain_caller');
const chain = new BlockchainCaller(web3);
const {expectRevert} = require('@openzeppelin/test-helpers');
const encodeCall = require('zos-lib/lib/helpers/encodeCall').default;

require('chai')
  .use(require('chai-bn')(BigNumber))
  .should();

let orchestrator, mockPolicy, mockDownstream;
let r;
let deployer, user;
const updateOneArgEncoded = web3.utils.sha3("updateOneArg(uint256)").substring(0,10)
    + web3.utils.padLeft(web3.utils.toHex(12345), 65).substring(3,67);
const updateTwoArgsEncoded = web3.utils.sha3("updateTwoArgs(uint256,int256)").substring(0,10)
    + web3.utils.padLeft(web3.utils.toHex(12345), 65).substring(3,67);
+ web3.utils.padLeft(web3.utils.toHex(12345), 65).substring(3,67);

const updateNoArgEncoded  = web3.utils.sha3("updateNoArg()").substring(0,10)

async function setupContracts () {
  await chain.waitForSomeTime(86440);
  const accounts = await chain.getUserAccounts();
  deployer = accounts[0];
  user = accounts[1];
  mockPolicy = await mockUsdGoldPolicy.new();
  orchestrator = await Orchestrator.new();
  mockDownstream = await MockDownstream.new();


  await orchestrator.sendTransaction({
    data: encodeCall('initialize', ['address', 'address'], [deployer, mockPolicy.address]),
    from: deployer
  });
}

contract('Orchestrator', function (accounts) {
  before('setup Orchestrator contract', setupContracts);

  describe('when sent ether', async function () {
    it('should reject', async function () {
      expect(
        await chain.isEthException(orchestrator.sendTransaction({ from: user, value: 1 }))
      ).to.be.true;
    });
  });

  describe('when rebase called by a contract', function () {
    it('should fail', async function () {
      const usdGoldICallerContract = await usdGoldCallerContract.new();
      expect(
        await chain.isEthException(usdGoldICallerContract.callRebase(orchestrator.address))
      ).to.be.true;
    });
  });

  describe('when rebase called by a contract which is being constructed', function () {
    it('should fail', async function () {
      expect(
        await chain.isEthException(constructorUsdGoldCallerContract.new(orchestrator.address))
      ).to.be.true;
    });
  });

  describe('when transaction list is empty', async function () {
    before('calling rebase', async function () {
      r = await orchestrator.rebase();
    });

    it('should have no transactions', async function () {
      (await orchestrator.transactionsSize.call()).should.be.bignumber.eq( new BigNumber(0));
    });

    it('should call rebase on policy', async function () {
      let newTx = await truffleAssert.createTransactionResult(mockPolicy, r.tx);
      truffleAssert.eventEmitted(newTx, 'FunctionCalled', {
        instanceName: 'UsdGoldPolicy',
        functionName: 'rebase',
        caller: orchestrator.address
      });
    });

    it('should not have any subsequent logs', async function () {
      expect(r.receipt.rawLogs.length).to.eq(1);
    });
  });

  describe('when there is a single transaction', async function () {
    before('adding a transaction', async function () {
      orchestrator.addTransaction(mockDownstream.address, updateOneArgEncoded, {from: deployer});
      r = await orchestrator.rebase();
    });

    it('should have 1 transaction', async function () {
      (await orchestrator.transactionsSize.call()).should.be.bignumber.eq(new BigNumber(1));
    });

    it('should call rebase on policy', async function () {
      let newTx = await truffleAssert.createTransactionResult(mockPolicy, r.tx);
      truffleAssert.eventEmitted(newTx, 'FunctionCalled', {
        instanceName: 'UsdGoldPolicy',
        functionName: 'rebase',
        caller: orchestrator.address
      });
    });

    it('should call the transaction', async function () {

      let newTx = await truffleAssert.createTransactionResult(mockDownstream, r.tx);
      truffleAssert.eventEmitted(newTx, 'FunctionCalled', {
        instanceName: 'MockDownstream',
        functionName: 'updateOneArg',
        caller: orchestrator.address
      });
    });

    it('should not have any subsequent logs', async function () {
      expect(r.receipt.rawLogs.length).to.eq(3);
    });
  });

  describe('when there are two transactions', async function () {
    before('adding a transaction', async function () {
      orchestrator.addTransaction(mockDownstream.address, updateTwoArgsEncoded, {from: deployer});
      r = await orchestrator.rebase();
    });

    it('should have 2 transactions', async function () {
      (await orchestrator.transactionsSize.call()).should.be.bignumber.eq(new BigNumber(2));
    });

    it('should call rebase on policy', async function () {
      let newTx = await truffleAssert.createTransactionResult(mockPolicy, r.tx);
      truffleAssert.eventEmitted(newTx, 'FunctionCalled', {
        instanceName: 'UsdGoldPolicy',
        functionName: 'rebase',
        caller: orchestrator.address
      });
    });

    it('should call first transaction', async function () {
      let newTx = await truffleAssert.createTransactionResult(mockDownstream, r.tx);
      truffleAssert.eventEmitted(newTx, 'FunctionCalled', {
        instanceName: 'MockDownstream',
        functionName: 'updateOneArg',
        caller: orchestrator.address
      });
    });

    it('should call second transaction', async function () {
      let newTx = await truffleAssert.createTransactionResult(mockDownstream, r.tx);
      truffleAssert.eventEmitted(newTx, 'FunctionCalled', {
        instanceName: 'MockDownstream',
        functionName: 'updateTwoArgs',
        caller: orchestrator.address
      });


    });

    it('should not have any subsequent logs', async function () {
      expect(r.receipt.rawLogs.length).to.eq(5);
    });
  });

  describe('when 1st transaction is disabled', async function () {
    before('disabling a transaction', async function () {
      orchestrator.setTransactionEnabled(0, false);
      r = await orchestrator.rebase();
    });

    it('should have 2 transactions', async function () {
      (await orchestrator.transactionsSize.call()).should.be.bignumber.eq(new BigNumber(2));
    });

    it('should call rebase on policy', async function () {
      let newTx = await truffleAssert.createTransactionResult(mockPolicy, r.tx);
      truffleAssert.eventEmitted(newTx, 'FunctionCalled', {
        instanceName: 'UsdGoldPolicy',
        functionName: 'rebase',
        caller: orchestrator.address
      });
    });

    it('should call second transaction', async function () {
      let newTx = await truffleAssert.createTransactionResult(mockDownstream, r.tx);
      truffleAssert.eventEmitted(newTx, 'FunctionCalled', {
        instanceName: 'MockDownstream',
        functionName: 'updateTwoArgs',
        caller: orchestrator.address
      });
    });

    it('should not have any subsequent logs', async function () {
      expect(r.receipt.rawLogs.length).to.eq(3);
    });
  });

  describe('when a transaction is removed', async function () {
    before('removing 1st transaction', async function () {
      orchestrator.removeTransaction(0);
      r = await orchestrator.rebase();
    });

    it('should have 1 transaction', async function () {
      (await orchestrator.transactionsSize.call()).should.be.bignumber.eq(new BigNumber(1));
    });

    it('should not have any subsequent logs', async function () {
      expect(r.receipt.rawLogs.length).to.eq(3);
    });
  });

  describe('when all transactions are removed', async function () {
    before('removing 1st transaction', async function () {
      orchestrator.removeTransaction(0);
      r = await orchestrator.rebase();
    });

    it('should have 0 transactions', async function () {
      (await orchestrator.transactionsSize.call()).should.be.bignumber.eq(new BigNumber(0));
    });



    it('should not have any subsequent logs', async function () {
      expect(r.receipt.rawLogs.length).to.eq(1);
    });
  });


  describe('Access Control', function () {
    describe('addTransaction', async function () {
      it('should be callable by owner', async function () {
        expect(
          await chain.isEthException(
            orchestrator.addTransaction(mockDownstream.address, updateNoArgEncoded, {from: deployer})
          )
        ).to.be.false;
      });

      it('should be not be callable by others', async function () {
        expect(
          await chain.isEthException(
            orchestrator.addTransaction(mockDownstream.address, updateNoArgEncoded, {from: user})
          )
        ).to.be.true;
      });
    });

    describe('setTransactionEnabled', async function () {
      it('should be callable by owner', async function () {
        (await orchestrator.transactionsSize.call()).should.be.bignumber.gt(new BigNumber(0));
        expect(
          await chain.isEthException(
            orchestrator.setTransactionEnabled(0, true, {from: deployer})
          )
        ).to.be.false;
      });

      it('should be not be callable by others', async function () {
        (await orchestrator.transactionsSize.call()).should.be.bignumber.gt(new BigNumber(0));
        expect(
          await chain.isEthException(
            orchestrator.setTransactionEnabled(0, true, {from: user})
          )
        ).to.be.true;
      });
    });

    describe('removeTransaction', async function () {
      it('should be not be callable by others', async function () {
        (await orchestrator.transactionsSize.call()).should.be.bignumber.gt(new BigNumber(0));
        expect(
          await chain.isEthException(
            orchestrator.removeTransaction(0, {from: user})
          )
        ).to.be.true;
      });

      it('should be callable by owner', async function () {
        (await orchestrator.transactionsSize.call()).should.be.bignumber.gt(new BigNumber(0));
        expect(
          await chain.isEthException(
            orchestrator.removeTransaction(0, {from: deployer})
          )
        ).to.be.false;
      });
    });

    describe('transferOwnership', async function () {
      it('should transfer ownership', async function () {
        (await orchestrator.owner.call()).toLowerCase().should.eq(deployer.toLowerCase());
        await orchestrator.transferOwnership(user.toLowerCase());
        (await orchestrator.owner.call()).toLowerCase().should.eq(user.toLowerCase());
      });
    });
  });
});
