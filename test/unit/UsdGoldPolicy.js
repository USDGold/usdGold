const UsdGoldPolicy = artifacts.require('UsdGoldPolicy.sol');
const MockUsdGold = artifacts.require('MockUsdGold.sol');
const MockOracle = artifacts.require('MockOracle.sol');
const truffleAssert = require('truffle-assertions');
const encodeCall = require('zos-lib/lib/helpers/encodeCall').default;
const BigNumber = web3.utils.BN;
const _require = require('app-root-path').require;
const BlockchainCaller = _require('/util/blockchain_caller');
const chain = new BlockchainCaller(web3);

require('chai')
  .use(require('chai-bn')(BigNumber))
  .should();

let usdGoldIPolicy, mockUsdGold, mockMarketOracle, mockCpiOracle;
let r, prevEpoch, prevTime;
let deployer, user, orchestrator;

// const MAX_RATE = (new BigNumber('1')).mul(new BigNumber(10 ** 6 * 10 ** 18));
const MAX_RATE = (new BigNumber('1')).mul(new BigNumber(10 ** 6).mul(new BigNumber(10**6).pow(new BigNumber(3))));
const MAX_SUPPLY = (new BigNumber(2).pow(new BigNumber(255)).sub(new BigNumber(1))).div(MAX_RATE);
const BASE_CPI = new BigNumber(100).mul(new BigNumber(10).pow(new BigNumber(18)));
const INITIAL_CPI = new BigNumber(251712).mul(new BigNumber(10).pow(new BigNumber(15)));
const INITIAL_CPI_25P_MORE = INITIAL_CPI.mul(new BigNumber(125)).div(new BigNumber(100));
const INITIAL_CPI_25P_LESS = INITIAL_CPI.mul(new BigNumber(77)).div(new BigNumber(100));
const INITIAL_RATE = INITIAL_CPI.mul(new BigNumber(1).mul(new BigNumber(10).pow(new BigNumber(18)))).div(BASE_CPI);
const INITIAL_RATE_30P_MORE = INITIAL_RATE.mul(new BigNumber(130)).div(new BigNumber(100));
const INITIAL_RATE_30P_LESS = INITIAL_RATE.mul(new BigNumber(70)).div(new BigNumber(100));
const INITIAL_RATE_5P_MORE = INITIAL_RATE.mul(new BigNumber(105)).div(new BigNumber(100));
const INITIAL_RATE_5P_LESS = INITIAL_RATE.mul(new BigNumber(95)).div(new BigNumber(100));
const INITIAL_RATE_60P_MORE = INITIAL_RATE.mul(new BigNumber(160)).div(new BigNumber(100));
const INITIAL_RATE_2X = INITIAL_RATE.mul(new BigNumber(2));

async function setupContracts () {
  await chain.waitForSomeTime(86400);
  const accounts = await chain.getUserAccounts();
  deployer = accounts[0];
  user = accounts[1];
  orchestrator = accounts[2];
  mockUsdGold = await MockUsdGold.new();
  mockMarketOracle = await MockOracle.new('MarketOracle');
  mockCpiOracle = await MockOracle.new('CpiOracle');
  usdGoldIPolicy = await UsdGoldPolicy.new();
  await usdGoldIPolicy.sendTransaction({
    data: encodeCall('initialize', ['address', 'address', 'uint256'], [deployer, mockUsdGold.address, BASE_CPI.toString()]),
    from: deployer
  });
  await usdGoldIPolicy.setMarketOracle(mockMarketOracle.address);
  await usdGoldIPolicy.setCpiOracle(mockCpiOracle.address);
  await usdGoldIPolicy.setOrchestrator(orchestrator);
}

async function setupContractsWithOpenRebaseWindow () {
  await setupContracts();
  await usdGoldIPolicy.setRebaseTimingParameters(60, 0, 60);
}

async function mockExternalData (rate, cpi, uFragSupply, rateValidity = true, cpiValidity = true) {
  await mockMarketOracle.storeData(rate);
  await mockMarketOracle.storeValidity(rateValidity);
  await mockCpiOracle.storeData(cpi);
  await mockCpiOracle.storeValidity(cpiValidity);
  await mockUsdGold.storeSupply(uFragSupply);
}

contract('UsdGoldPolicy', function (accounts) {
  before('setup UsdGoldPolicy contract', setupContracts);

  it('should reject any ether sent to it', async function () {
    expect(
      await chain.isEthException(usdGoldIPolicy.sendTransaction({ from: user, value: 1 }))
    ).to.be.true;
  });
});

contract('UsdGoldPolicy:initialize', async function (accounts) {
  describe('initial values set correctly', function () {
    before('setup UsdGoldPolicy contract', setupContracts);

    it('deviationThreshold', async function () {
      (await usdGoldIPolicy.deviationThreshold.call()).should.be.bignumber.eq(new BigNumber(5).mul(new BigNumber(10).pow(new BigNumber(16))));
    });
    it('rebaseLag', async function () {
      (await usdGoldIPolicy.rebaseLag.call()).should.be.bignumber.eq(new BigNumber(10));
    });
    it('minRebaseTimeIntervalSec', async function () {
      (await usdGoldIPolicy.minRebaseTimeIntervalSec.call()).should.be.bignumber.eq(new BigNumber(24 * 60 * 60));
    });
    it('epoch', async function () {
      (await usdGoldIPolicy.epoch.call()).should.be.bignumber.eq(new BigNumber(0));
    });
    it('rebaseWindowOffsetSec', async function () {
      (await usdGoldIPolicy.rebaseWindowOffsetSec.call()).should.be.bignumber.eq(new BigNumber (0));
    });
    it('rebaseWindowLengthSec', async function () {
      (await usdGoldIPolicy.rebaseWindowLengthSec.call()).should.be.bignumber.eq( new BigNumber( 86399));
    });
    it('should set owner', async function () {
      expect((await usdGoldIPolicy.owner.call()).toLowerCase()).to.eq(deployer.toLowerCase());
    });
    it('should set reference to reBase', async function () {
      expect((await usdGoldIPolicy.usdGoldC.call()).toLowerCase()).to.eq(mockUsdGold.address.toLowerCase());
    });
  });
});

contract('UsdGoldPolicy:setMarketOracle', async function (accounts) {
  before('setup UsdGoldPolicy contract', setupContracts);

  it('should set marketOracle', async function () {
    await usdGoldIPolicy.setMarketOracle(deployer);
    expect((await usdGoldIPolicy.marketOracle.call()).toLowerCase()).to.eq(deployer.toLowerCase());
  });
});

contract('UsdGold:setMarketOracle:accessControl', function (accounts) {
  before('setup UsdGoldPolicy contract', setupContracts);

  it('should be callable by owner', async function () {
    expect(
      await chain.isEthException(usdGoldIPolicy.setMarketOracle(deployer, { from: deployer }))
    ).to.be.false;
  });

  it('should NOT be callable by non-owner', async function () {
    expect(
      await chain.isEthException(usdGoldIPolicy.setMarketOracle(deployer, { from: user }))
    ).to.be.true;
  });
});

contract('UsdGoldPolicy:setCpiOracle', async function (accounts) {
  before('setup UsdGoldPolicy contract', setupContracts);

  it('should set cpiOracle', async function () {
    await usdGoldIPolicy.setCpiOracle(deployer);
    expect((await usdGoldIPolicy.cpiOracle.call()).toLowerCase()).to.eq(deployer.toLowerCase());
  });
});

contract('UsdGold:setCpiOracle:accessControl', function (accounts) {
  before('setup UsdGoldPolicy contract', setupContracts);

  it('should be callable by owner', async function () {
    expect(
      await chain.isEthException(usdGoldIPolicy.setCpiOracle(deployer, { from: deployer }))
    ).to.be.false;
  });

  it('should NOT be callable by non-owner', async function () {
    expect(
      await chain.isEthException(usdGoldIPolicy.setCpiOracle(deployer, { from: user }))
    ).to.be.true;
  });
});

contract('UsdGoldPolicy:setOrchestrator', async function (accounts) {
  before('setup UsdGoldPolicy contract', setupContracts);

  it('should set orchestrator', async function () {
    await usdGoldIPolicy.setOrchestrator(user, {from: deployer});
    expect((await usdGoldIPolicy.orchestrator.call()).toLowerCase()).to.eq(user.toLowerCase());
  });
});

contract('UsdGold:setOrchestrator:accessControl', function (accounts) {
  before('setup UsdGoldPolicy contract', setupContracts);

  it('should be callable by owner', async function () {
    expect(
      await chain.isEthException(usdGoldIPolicy.setOrchestrator(deployer, { from: deployer }))
    ).to.be.false;
  });

  it('should NOT be callable by non-owner', async function () {
    expect(
      await chain.isEthException(usdGoldIPolicy.setOrchestrator(deployer, { from: user }))
    ).to.be.true;
  });
});

contract('UsdGoldPolicy:setDeviationThreshold', async function (accounts) {
  let prevThreshold, threshold;
  before('setup UsdGoldPolicy contract', async function () {
    await setupContracts();
    prevThreshold = await usdGoldIPolicy.deviationThreshold.call();
    threshold = prevThreshold.add( new BigNumber(0.01).mul(new BigNumber(10).pow(new BigNumber(18))));
    await usdGoldIPolicy.setDeviationThreshold(threshold);
  });

  it('should set deviationThreshold', async function () {
    (await usdGoldIPolicy.deviationThreshold.call()).should.be.bignumber.eq(threshold);
  });
});

contract('UsdGold:setDeviationThreshold:accessControl', function (accounts) {
  before('setup UsdGoldPolicy contract', setupContracts);

  it('should be callable by owner', async function () {
    expect(
      await chain.isEthException(usdGoldIPolicy.setDeviationThreshold(0, { from: deployer }))
    ).to.be.false;
  });

  it('should NOT be callable by non-owner', async function () {
    expect(
      await chain.isEthException(usdGoldIPolicy.setDeviationThreshold(0, { from: user }))
    ).to.be.true;
  });
});

contract('UsdGoldPolicy:setRebaseLag', async function (accounts) {
  let prevLag;
  before('setup UsdGoldPolicy contract', async function () {
    await setupContracts();
    prevLag = await usdGoldIPolicy.rebaseLag.call();
  });

  describe('when rebaseLag is more than 0', async function () {
    it('should setRebaseLag', async function () {
      const lag = prevLag.add(new BigNumber(1));
      await usdGoldIPolicy.setRebaseLag(lag);
      (await usdGoldIPolicy.rebaseLag.call()).should.be.bignumber.eq(lag);
    });
  });

  describe('when rebaseLag is 0', async function () {
    it('should fail', async function () {
      expect(
        await chain.isEthException(usdGoldIPolicy.setRebaseLag(0))
      ).to.be.true;
    });
  });
});

contract('UsdGold:setRebaseLag:accessControl', function (accounts) {
  before('setup UsdGoldPolicy contract', setupContracts);

  it('should be callable by owner', async function () {
    expect(
      await chain.isEthException(usdGoldIPolicy.setRebaseLag(1, { from: deployer }))
    ).to.be.false;
  });

  it('should NOT be callable by non-owner', async function () {
    expect(
      await chain.isEthException(usdGoldIPolicy.setRebaseLag(1, { from: user }))
    ).to.be.true;
  });
});

contract('UsdGoldPolicy:setRebaseTimingParameters', async function (accounts) {
  before('setup UsdGoldPolicy contract', async function () {
    await setupContracts();
  });

  describe('when interval=0', function () {
    it('should fail', async function () {
      expect(
        await chain.isEthException(usdGoldIPolicy.setRebaseTimingParameters(0, 0, 0))
      ).to.be.true;
    });
  });

  describe('when offset > interval', function () {
    it('should fail', async function () {
      expect(
        await chain.isEthException(usdGoldIPolicy.setRebaseTimingParameters(300, 3600, 300))
      ).to.be.true;
    });
  });

  describe('when params are valid', function () {
    it('should setRebaseTimingParameters', async function () {
      await usdGoldIPolicy.setRebaseTimingParameters(600, 60, 300);
      (await usdGoldIPolicy.minRebaseTimeIntervalSec.call()).should.be.bignumber.eq( new BigNumber( 600));
      (await usdGoldIPolicy.rebaseWindowOffsetSec.call()).should.be.bignumber.eq(new BigNumber(60));
      (await usdGoldIPolicy.rebaseWindowLengthSec.call()).should.be.bignumber.eq( new BigNumber(300));
    });
  });
});

contract('UsdGold:setRebaseTimingParameters:accessControl', function (accounts) {
  before('setup UsdGoldPolicy contract', setupContracts);

  it('should be callable by owner', async function () {
    expect(
      await chain.isEthException(usdGoldIPolicy.setRebaseTimingParameters(600, 60, 300, { from: deployer }))
    ).to.be.false;
  });

  it('should NOT be callable by non-owner', async function () {
    expect(
      await chain.isEthException(usdGoldIPolicy.setRebaseTimingParameters(600, 60, 300, { from: user }))
    ).to.be.true;
  });
});

contract('UsdGoldPolicy:UsdGold:accessControl', async function (accounts) {
  beforeEach('setup UsdGoldPolicy contract', async function () {
    await setupContractsWithOpenRebaseWindow();
    await mockExternalData(INITIAL_RATE_30P_MORE, INITIAL_CPI, 1000, true);
    await chain.waitForSomeTime(60);
  });

  describe('when rebase called by orchestrator', function () {
    it('should succeed', async function () {
      expect(
        await chain.isEthException(usdGoldIPolicy.rebase({from: orchestrator}))
      ).to.be.false;
    });
  });

  describe('when rebase called by non-orchestrator', function () {
    it('should fail', async function () {
      expect(
        await chain.isEthException(usdGoldIPolicy.rebase({from: user}))
      ).to.be.true;
    });
  });
});

contract('UsdGoldPolicy:Rebase', async function (accounts) {
  before('setup UsdGoldPolicy contract', setupContractsWithOpenRebaseWindow);

  describe('when minRebaseTimeIntervalSec has NOT passed since the previous rebase', function () {
    before(async function () {
      await mockExternalData(INITIAL_RATE_30P_MORE, INITIAL_CPI, 1010);
      await chain.waitForSomeTime(60);
      await usdGoldIPolicy.rebase({from: orchestrator});
    });

    it('should fail', async function () {
      expect(
        await chain.isEthException(usdGoldIPolicy.rebase({from: orchestrator}))
      ).to.be.true;
    });
  });
});

contract('UsdGoldPolicy:Rebase', async function (accounts) {
  before('setup UsdGoldPolicy contract', setupContractsWithOpenRebaseWindow);

  describe('when rate is within deviationThreshold', function () {
    before(async function () {
      await usdGoldIPolicy.setRebaseTimingParameters(60, 0, 60);
    });

    // it('should return 0', async function () {
    //   await mockExternalData(INITIAL_RATE.sub(1), INITIAL_CPI, 1000);
    //   await chain.waitForSomeTime(60);
    //   r = await usdGoldIPolicy.rebase({from: orchestrator});
    //   r.logs[0].args.requestedSupplyAdjustment.should.be.bignumber.eq(new BigNumber(0));
    //   await chain.waitForSomeTime(60);
    //
    //   await mockExternalData(INITIAL_RATE.add(new BigNumber(1)), INITIAL_CPI, 1000);
    //   r = await usdGoldIPolicy.rebase({from: orchestrator});
    //   r.logs[0].args.requestedSupplyAdjustment.should.be.bignumber.eq(new BigNumber(0));
    //   await chain.waitForSomeTime(60);
    //
    //   await mockExternalData(INITIAL_RATE_5P_MORE.sub(new BigNumber(2)), INITIAL_CPI, 1000);
    //   r = await usdGoldIPolicy.rebase({from: orchestrator});
    //   r.logs[0].args.requestedSupplyAdjustment.should.be.bignumber.eq(new BigNumber(0));
    //   await chain.waitForSomeTime(60);
    //
    //   await mockExternalData(INITIAL_RATE_5P_LESS.add(new BigNumber(2)), INITIAL_CPI, 1000);
    //   r = await usdGoldIPolicy.rebase({from: orchestrator});
    //   r.logs[0].args.requestedSupplyAdjustment.should.be.bignumber.eq(new BigNumber(0));
    //   await chain.waitForSomeTime(60);
    // });
  });
});

// contract('UsdGoldPolicy:Rebase', async function (accounts) {
//   before('setup UsdGoldPolicy contract', setupContractsWithOpenRebaseWindow);
//
//   describe('when rate is more than MAX_RATE', function () {
//     it('should return same supply delta as delta for MAX_RATE', async function () {
//       // Any exchangeRate >= (MAX_RATE=100x) would result in the same supply increase
//       await mockExternalData(MAX_RATE, INITIAL_CPI, 1000);
//       await chain.waitForSomeTime(60);
//       r = await usdGoldIPolicy.rebase({from: orchestrator});
//       const supplyChange = r.logs[0].args.requestedSupplyAdjustment;
//
//       await chain.waitForSomeTime(60);
//
//       await mockExternalData(MAX_RATE.add(new BigNumber(10).pow(new BigNumber(17)) ), INITIAL_CPI, 1000);
//       r = await usdGoldIPolicy.rebase({from: orchestrator});
//       r.logs[0].args.requestedSupplyAdjustment.should.be.bignumber.eq(supplyChange);
//
//       await chain.waitForSomeTime(60);
//
//       await mockExternalData(MAX_RATE.mul(2), INITIAL_CPI, 1000);
//       r = await usdGoldIPolicy.rebase({from: orchestrator});
//       r.logs[0].args.requestedSupplyAdjustment.should.be.bignumber.eq(supplyChange);
//     });
//   });
// });

contract('UsdGoldPolicy:Rebase', async function (accounts) {
  before('setup UsdGoldPolicy contract', setupContractsWithOpenRebaseWindow);

  describe('when reBase grows beyond MAX_SUPPLY', function () {
    before(async function () {
      await mockExternalData(INITIAL_RATE_2X, INITIAL_CPI, MAX_SUPPLY.sub(new BigNumber(1)));
      await chain.waitForSomeTime(60);
    });

    it('should apply SupplyAdjustment {MAX_SUPPLY - totalSupply}', async function () {
      // Supply is MAX_SUPPLY-1, exchangeRate is 2x; resulting in a new supply more than MAX_SUPPLY
      // However, supply is ONLY increased by 1 to MAX_SUPPLY
      r = await usdGoldIPolicy.rebase({from: orchestrator});
      r.logs[0].args.requestedSupplyAdjustment.should.be.bignumber.eq(new BigNumber(1));
    });
  });
});

contract('UsdGoldPolicy:Rebase', async function (accounts) {
  before('setup UsdGoldPolicy contract', setupContractsWithOpenRebaseWindow);

  describe('when reBase supply equals MAX_SUPPLY and rebase attempts to grow', function () {
    before(async function () {
      await mockExternalData(INITIAL_RATE_2X, INITIAL_CPI, MAX_SUPPLY);
      await chain.waitForSomeTime(60);
    });

    it('should not grow', async function () {
      r = await usdGoldIPolicy.rebase({from: orchestrator});
      r.logs[0].args.requestedSupplyAdjustment.should.be.bignumber.eq(new BigNumber(0));
    });
  });
});

contract('UsdGoldPolicy:Rebase', async function (accounts) {
  before('setup UsdGoldPolicy contract', setupContractsWithOpenRebaseWindow);

  describe('when the market oracle returns invalid data', function () {
    it('should fail', async function () {
      await mockExternalData(INITIAL_RATE_30P_MORE, INITIAL_CPI, 1000, false);
      await chain.waitForSomeTime(60);
      expect(
        await chain.isEthException(usdGoldIPolicy.rebase({from: orchestrator}))
      ).to.be.true;
    });
  });

  describe('when the market oracle returns valid data', function () {
    it('should NOT fail', async function () {
      await mockExternalData(INITIAL_RATE_30P_MORE, INITIAL_CPI, 1000, true);
      await chain.waitForSomeTime(60);
      expect(
        await chain.isEthException(usdGoldIPolicy.rebase({from: orchestrator}))
      ).to.be.false;
    });
  });
});

contract('UsdGoldPolicy:Rebase', async function (accounts) {
  before('setup UsdGoldPolicy contract', setupContractsWithOpenRebaseWindow);

  describe('when the cpi oracle returns invalid data', function () {
    it('should fail', async function () {
      await mockExternalData(INITIAL_RATE_30P_MORE, INITIAL_CPI, 1000, true, false);
      await chain.waitForSomeTime(60);
      expect(
        await chain.isEthException(usdGoldIPolicy.rebase({from: orchestrator}))
      ).to.be.true;
    });
  });

  describe('when the cpi oracle returns valid data', function () {
    it('should NOT fail', async function () {
      await mockExternalData(INITIAL_RATE_30P_MORE, INITIAL_CPI, 1000, true, true);
      await chain.waitForSomeTime(60);
      expect(
        await chain.isEthException(usdGoldIPolicy.rebase({from: orchestrator}))
      ).to.be.false;
    });
  });
});

contract('UsdGoldPolicy:Rebase', async function (accounts) {
  before('setup UsdGoldPolicy contract', setupContractsWithOpenRebaseWindow);

  describe('positive rate and no change CPI', function () {
    before(async function () {
      await mockExternalData(INITIAL_RATE_30P_MORE, INITIAL_CPI, 1000);
      await usdGoldIPolicy.setRebaseTimingParameters(60, 0, 60);
      await chain.waitForSomeTime(60);
      await usdGoldIPolicy.rebase({from: orchestrator});
      await chain.waitForSomeTime(59);
      prevEpoch = await usdGoldIPolicy.epoch.call();
      prevTime = await usdGoldIPolicy.lastRebaseTimestampSec.call();
      await mockExternalData(INITIAL_RATE_60P_MORE, INITIAL_CPI, 1010);
      r = await usdGoldIPolicy.rebase({from: orchestrator});
    });

    it('should increment epoch', async function () {
      const epoch = await usdGoldIPolicy.epoch.call();
      expect(prevEpoch.add(new BigNumber(1)).eq(epoch));
    });

    // it('should update lastRebaseTimestamp', async function () {
    //   const time = await usdGoldIPolicy.lastRebaseTimestampSec.call();
    //   expect(time.sub(prevTime).eq(60)).to.be.true;
    // });

    it('should emit Rebase with positive requestedSupplyAdjustment', async function () {
      const log = r.logs[0];
      expect(log.event).to.eq('LogRebase');
      expect(log.args.epoch.eq(prevEpoch.add(new BigNumber(1)))).to.be.true;
      log.args.exchangeRate.should.be.bignumber.eq(INITIAL_RATE_60P_MORE);
      log.args.cpi.should.be.bignumber.eq(INITIAL_CPI);
      log.args.requestedSupplyAdjustment.should.be.bignumber.eq( new BigNumber(60));
    });

    it('should call getData from the market oracle', async function () {
        let newTx = await truffleAssert.createTransactionResult(mockMarketOracle, r.tx);
        truffleAssert.eventEmitted(newTx, 'FunctionCalled', {
            instanceName: 'MarketOracle',
            functionName: 'getData',
            caller: usdGoldIPolicy.address
        });
    });

    it('should call getData from the cpi oracle', async function () {

        let newTx = await truffleAssert.createTransactionResult(mockCpiOracle, r.tx);
        truffleAssert.eventEmitted(newTx, 'FunctionCalled', {
            instanceName: 'CpiOracle',
            functionName: 'getData',
            caller: usdGoldIPolicy.address
        });
    });

    // it('should call uFrag Rebase', async function () {
    //   prevEpoch = await usdGoldIPolicy.epoch.call();
    //
    //     let newTx = await truffleAssert.createTransactionResult(mockUsdGold, r.tx);
    //     truffleAssert.eventEmitted(newTx, 'FunctionCalled', {
    //         instanceName: 'UsdGold',
    //         functionName: 'getData',
    //         caller: usdGoldIPolicy.address
    //     });
    // });
  });
});

contract('UsdGoldPolicy:Rebase', async function (accounts) {
  before('setup UsdGoldPolicy contract', setupContractsWithOpenRebaseWindow);

  describe('negative rate', function () {
    before(async function () {
      await mockExternalData(INITIAL_RATE_30P_LESS, INITIAL_CPI, 1000);
      await chain.waitForSomeTime(60);
      r = await usdGoldIPolicy.rebase({from: orchestrator});
    });

    // it('should emit Rebase with negative requestedSupplyAdjustment', async function () {
    //   const log = r.logs[0];
    //   expect(log.event).to.eq('LogRebase');
    //   log.args.requestedSupplyAdjustment.should.be.bignumber.eq(new BigNumber( -10));
    // });
  });
});

contract('UsdGoldPolicy:Rebase', async function (accounts) {
  before('setup UsdGoldPolicy contract', setupContractsWithOpenRebaseWindow);

  describe('when cpi increases', function () {
    before(async function () {
      await mockExternalData(INITIAL_RATE, INITIAL_CPI_25P_MORE, 1000);
      await chain.waitForSomeTime(60);
      await usdGoldIPolicy.setDeviationThreshold(0);
      r = await usdGoldIPolicy.rebase({from: orchestrator});
    });

    // it('should emit Rebase with negative requestedSupplyAdjustment', async function () {
    //   const log = r.logs[0];
    //   expect(log.event).to.eq('LogRebase');
    //   log.args.requestedSupplyAdjustment.should.be.bignumber.eq(new BigNumber( -6));
    // });
  });
});

contract('UsdGoldPolicy:Rebase', async function (accounts) {
  before('setup UsdGoldPolicy contract', setupContractsWithOpenRebaseWindow);

  describe('when cpi decreases', function () {
    before(async function () {
      await mockExternalData(INITIAL_RATE, INITIAL_CPI_25P_LESS, 1000);
      await chain.waitForSomeTime(60);
      await usdGoldIPolicy.setDeviationThreshold(0);
      r = await usdGoldIPolicy.rebase({from: orchestrator});
    });

    // it('should emit Rebase with positive requestedSupplyAdjustment', async function () {
    //   const log = r.logs[0];
    //   expect(log.event).to.eq('LogRebase');
    //   log.args.requestedSupplyAdjustment.should.be.bignumber.eq(new BigNumber( 9));
    // });
  });
});

contract('UsdGoldPolicy:Rebase', async function (accounts) {
  before('setup UsdGoldPolicy contract', setupContractsWithOpenRebaseWindow);

  describe('rate=TARGET_RATE', function () {
    before(async function () {
      await mockExternalData(INITIAL_RATE, INITIAL_CPI, 1000);
      await usdGoldIPolicy.setDeviationThreshold(0);
      await chain.waitForSomeTime(60);
      r = await usdGoldIPolicy.rebase({from: orchestrator});
    });

    it('should emit Rebase with 0 requestedSupplyAdjustment', async function () {
      const log = r.logs[0];
      expect(log.event).to.eq('LogRebase');
      log.args.requestedSupplyAdjustment.should.be.bignumber.eq(new BigNumber(0));
    });
  });
});

contract('UsdGoldPolicy:Rebase', async function (accounts) {
  let rbTime, rbWindow, minRebaseTimeIntervalSec, now, prevRebaseTime, nextRebaseWindowOpenTime,
    timeToWait, lastRebaseTimestamp;

  beforeEach('setup UsdGoldPolicy contract', async function () {
    await setupContracts();
    await usdGoldIPolicy.setRebaseTimingParameters(86400, 72000, 900);
    rbTime = await usdGoldIPolicy.rebaseWindowOffsetSec.call();
    rbWindow = await usdGoldIPolicy.rebaseWindowLengthSec.call();
    minRebaseTimeIntervalSec = await usdGoldIPolicy.minRebaseTimeIntervalSec.call();
    now = new BigNumber(await chain.currentTime());
    prevRebaseTime = now.sub(now.mod(minRebaseTimeIntervalSec)).add(rbTime);
    nextRebaseWindowOpenTime = prevRebaseTime.add(minRebaseTimeIntervalSec);
  });

  // describe('when its 5s after the rebase window closes', function () {
  //   it('should fail', async function () {
  //     timeToWait = nextRebaseWindowOpenTime.sub(now).add(rbWindow).add(5);
  //     await chain.waitForSomeTime(timeToWait.toNumber());
  //     await mockExternalData(INITIAL_RATE, INITIAL_CPI, 1000);
  //     expect(await usdGoldIPolicy.inRebaseWindow.call()).to.be.false;
  //     expect(
  //       await chain.isEthException(usdGoldIPolicy.rebase({from: orchestrator}))
  //     ).to.be.true;
  //   });
  // });

  // describe('when its 5s before the rebase window opens', function () {
  //   it('should fail', async function () {
  //     timeToWait = nextRebaseWindowOpenTime.sub(now).sub(new BigNumber(5));
  //     await chain.waitForSomeTime(timeToWait.toNumber());
  //     await mockExternalData(INITIAL_RATE, INITIAL_CPI, 1000);
  //     expect(await usdGoldIPolicy.inRebaseWindow.call()).to.be.false;
  //     expect(
  //       await chain.isEthException(usdGoldIPolicy.rebase({from: orchestrator}))
  //     ).to.be.true;
  //   });
  // });

  // describe('when its 5s after the rebase window opens', function () {
  //   it('should NOT fail', async function () {
  //     timeToWait = nextRebaseWindowOpenTime.sub(now).add(new BigNumber(5));
  //     await chain.waitForSomeTime(timeToWait.toNumber());
  //     await mockExternalData(INITIAL_RATE, INITIAL_CPI, 1000);
  //     expect(await usdGoldIPolicy.inRebaseWindow.call()).to.be.true;
  //     expect(
  //       await chain.isEthException(usdGoldIPolicy.rebase({from: orchestrator}))
  //     ).to.be.false;
  //     lastRebaseTimestamp = await usdGoldIPolicy.lastRebaseTimestampSec.call();
  //     expect(lastRebaseTimestamp.eq(nextRebaseWindowOpenTime)).to.be.true;
  //   });
  // });
  //
  // describe('when its 5s before the rebase window closes', function () {
  //   it('should NOT fail', async function () {
  //     timeToWait = nextRebaseWindowOpenTime.sub(now).add(rbWindow).sub(new BigNumber(5));
  //     await chain.waitForSomeTime(timeToWait.toNumber());
  //     await mockExternalData(INITIAL_RATE, INITIAL_CPI, 1000);
  //     expect(await usdGoldIPolicy.inRebaseWindow.call()).to.be.true;
  //     expect(
  //       await chain.isEthException(usdGoldIPolicy.rebase({from: orchestrator}))
  //     ).to.be.false;
  //     lastRebaseTimestamp = await usdGoldIPolicy.lastRebaseTimestampSec.call();
  //     expect(lastRebaseTimestamp.eq(nextRebaseWindowOpenTime)).to.be.true;
  //   });
  // });
});
