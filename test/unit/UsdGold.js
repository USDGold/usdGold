const UsdGold = artifacts.require('UsdGold.sol');
const _require = require('app-root-path').require;
const BlockchainCaller = _require('/util/blockchain_caller');
const chain = new BlockchainCaller(web3);
const BigNumber = web3.utils.BN;
const encodeCall = require('zos-lib/lib/helpers/encodeCall').default;

require('chai')
  .use(require('chai-bn')(BigNumber))
  .should();

function toUFrgDenomination (x) {
  return new BigNumber(x).mul(new BigNumber(10 ** 9));
}
const DECIMALS = new BigNumber(9);
const INTIAL_SUPPLY = toUFrgDenomination(3.025 * 10 ** 6);
const transferAmount = toUFrgDenomination(10);
const unitTokenAmount = toUFrgDenomination(1);
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

let usdGoldI, b, r, deployer, user, initialSupply;
async function setupContracts () {
  const accounts = await chain.getUserAccounts();
  deployer = accounts[0];
  user = accounts[1];
  usdGoldI = await UsdGold.new();
  r = await usdGoldI.sendTransaction({
    data: encodeCall('initialize', ['address'], [deployer]),
    from: deployer
  });
  initialSupply = await usdGoldI.totalSupply.call();
}

contract('UsdGold', function (accounts) {
  before('setup UsdGold contract', setupContracts);

  it('should reject any ether sent to it', async function () {
    expect(
      await chain.isEthException(usdGoldI.sendTransaction({ from: user, value: 1 }))
    ).to.be.true;
  });
});

contract('UsdGold:Initialization', function (accounts) {
  before('setup UsdGold contract', setupContracts);

  it('should transfer 50M usdGoldI to the deployer', async function () {
    (await usdGoldI.balanceOf.call(deployer)).should.be.bignumber.eq(INTIAL_SUPPLY);
    const log = r.logs[0];
    expect(log).to.exist;
    expect(log.event).to.eq('Transfer');
    expect(log.args.from).to.eq(ZERO_ADDRESS);
    expect(log.args.to.toLowerCase()).to.eq(deployer.toLowerCase());
    log.args.value.should.be.bignumber.eq(INTIAL_SUPPLY);
  });

  it('should set the totalSupply to 50M', async function () {
    initialSupply.should.be.bignumber.eq(INTIAL_SUPPLY);
  });

  it('should set the owner', async function () {
    expect((await usdGoldI.owner.call()).toLowerCase()).to.eq(deployer.toLowerCase());
  });

  it('should set detailed ERC20 parameters', async function () {
    expect(await usdGoldI.name.call()).to.eq('USDGOLD');
    expect(await usdGoldI.symbol.call()).to.eq('USDGOLD');
    (await usdGoldI.decimals.call()).should.be.bignumber.eq(DECIMALS);
  });

  it('should have 9 decimals', async function () {
    const decimals = await usdGoldI.decimals.call();
    decimals.should.be.bignumber.eq(DECIMALS);
  });

  it('should have USDGOLD symbol', async function () {
    const symbol = await usdGoldI.symbol.call();
    symbol.should.be.eq('USDGOLD');
  });
});

contract('UsdGold:setMonetaryPolicy', function (accounts) {
  const policy = accounts[1];

  before('setup UsdGold contract', setupContracts);

  it('should set reference to policy contract', async function () {
    await usdGoldI.setMonetaryPolicy(policy, { from: deployer });
    expect(await usdGoldI.monetaryPolicy.call()).to.eq(policy);
  });

  it('should emit policy updated event', async function () {
    const r = await usdGoldI.setMonetaryPolicy(policy, { from: deployer });
    const log = r.logs[0];
    expect(log).to.exist;
    expect(log.event).to.eq('LogMonetaryPolicyUpdated');
    expect(log.args.monetaryPolicy).to.eq(policy);
  });
});

contract('UsdGold:setMonetaryPolicy:accessControl', function (accounts) {
  const policy = accounts[1];

  before('setup UsdGold contract', setupContracts);

  it('should be callable by owner', async function () {
    expect(
      await chain.isEthException(usdGoldI.setMonetaryPolicy(policy, { from: deployer }))
    ).to.be.false;
  });
});

contract('UsdGold:setMonetaryPolicy:accessControl', function (accounts) {
  const policy = accounts[1];
  const user = accounts[2];

  before('setup UsdGold contract', setupContracts);

  it('should NOT be callable by non-owner', async function () {
    expect(
      await chain.isEthException(usdGoldI.setMonetaryPolicy(policy, { from: user }))
    ).to.be.true;
  });
});

contract('UsdGold:setRewardAddress:accessControl', function (accounts) {
  const rewardAddress = accounts[5];

  before('setup UsdGold contract', setupContracts);

  it('should be callable by owner', async function () {
    expect(
      await chain.isEthException(usdGoldI.setRewardParams(rewardAddress, 10, 10, { from: deployer }))
    ).to.be.false;
  });
});

contract('UsdGold:setRewardAddress:accessControl', function (accounts) {
  const rewardAddress = accounts[5];
  const user = accounts[2];

  before('setup UsdGold contract', setupContracts);

  it('should NOT be callable by non-owner', async function () {
    expect(
      await chain.isEthException(usdGoldI.setRewardParams(rewardAddress, 10, 10, { from: user }))
    ).to.be.true;
  });
});

// contract('UsdGold:setBlockHashWinners:accessControl', function (accounts) {
//   before('setup UsdGold contract', setupContracts);
//
//   it('should be callable by owner', async function () {
//     expect(
//       await chain.isEthException(usdGoldI.setBlockHashWinners({ from: deployer }))
//     ).to.be.false;
//   });
// });

// contract('UsdGold:setBlockHashWinners:accessControl', function (accounts) {
//   const user = accounts[2];
//
//   before('setup UsdGold contract', setupContracts);
//
//   it('should NOT be callable by non-owner', async function () {
//     expect(
//       await chain.isEthException(usdGoldI.setBlockHashWinners({ from: user }))
//     ).to.be.true;
//   });
// });

// contract('UsdGold:isRewardWinner', function (accounts) {
//   const user = accounts[2];
//
//   before('setup UsdGold contract', setupContracts);
//
//   it('should NOT be winner', async function () {
//     await usdGoldI.setBlockHashWinners({ from: deployer});
//     const winner = await usdGoldI.isRewardWinner(user, { from: deployer });
//     expect(winner.logs[0].args.winner).to.be.false;
//   });
//
//   it('should be winner', async function () {
//     await usdGoldI.setBlockHashWinners({ from: deployer});
//     const blockHash = await usdGoldI.currentBlockWinner.call();
//     const winnerUser = (user + '').slice(0, -2) + (blockHash + '').slice(-2);
//     const winner = await usdGoldI.isRewardWinner(winnerUser, { from: deployer });
//     expect(winner.logs[0].args.winner).to.be.true;
//   });
// });

// contract('UsdGold:claimReward', function (accounts) {
//
//   const policy = accounts[1];
//   const rewardAddress = accounts[5];
//   const A = accounts[2];
//   const B = accounts[3];
//
//   before('setup UsdGold contract', async function () {
//     await setupContracts();
//     await usdGoldI.setMonetaryPolicy(policy, {from: deployer});
//     await usdGoldI.setRewardParams(rewardAddress,10,10, {from: deployer});
//     await usdGoldI.transfer(A, toUFrgDenomination(10), { from: deployer });
//     await usdGoldI.transfer(B, toUFrgDenomination(20), { from: deployer });
//
//   });
//
//     it('should claim ok', async function () {
//       await usdGoldI.claimReward( A ,{ from: policy });
//     });
//
//     it('should claim', async function () {
//      let x = await usdGoldI.claimReward( deployer ,{ from: policy });
//       console.log(x.logs[1].args)
//     });
//
// });

contract('UsdGold:PauseRebase', function (accounts) {
  const policy = accounts[1];
  const rewardAddress = accounts[4];
  const A = accounts[2];
  const B = accounts[3];

  before('setup UsdGold contract', async function () {
    await setupContracts();
    await usdGoldI.setMonetaryPolicy(policy, {from: deployer});
    await usdGoldI.setRewardParams(rewardAddress, 10, 10, {from: deployer});
    r = await usdGoldI.setRebasePaused(true);
  });

  it('should emit pause event', async function () {
    const log = r.logs[0];
    expect(log).to.exist;
    expect(log.event).to.eq('LogRebasePaused');
    expect(log.args.paused).to.be.true;
  });

  it('should not allow calling rebase', async function () {
    expect(
      await chain.isEthException(usdGoldI.rebase(1, toUFrgDenomination(500), { from: policy }))
    ).to.be.true;
  });

  it('should allow calling transfer', async function () {
    await usdGoldI.transfer(A, transferAmount, { from: deployer });
  });

  it('should allow calling approve', async function () {
    await usdGoldI.approve(A, transferAmount, { from: deployer });
  });

  it('should allow calling allowance', async function () {
    await usdGoldI.allowance.call(deployer, A);
  });

  it('should allow calling transferFrom', async function () {
    await usdGoldI.transferFrom(deployer, B, transferAmount, {from: A});
  });

  it('should allow calling increaseAllowance', async function () {
    await usdGoldI.increaseAllowance(A, transferAmount, {from: deployer});
  });

  it('should allow calling decreaseAllowance', async function () {
    await usdGoldI.decreaseAllowance(A, 10, {from: deployer});
  });

  it('should allow calling balanceOf', async function () {
    await usdGoldI.balanceOf.call(deployer);
  });

  it('should allow calling totalSupply', async function () {
    await usdGoldI.totalSupply.call();
  });
});

contract('UsdGold:PauseRebase:accessControl', function (accounts) {
  before('setup UsdGold contract', setupContracts);

  it('should be callable by owner', async function () {
    expect(
      await chain.isEthException(usdGoldI.setRebasePaused(true, { from: deployer }))
    ).to.be.false;
  });

  it('should NOT be callable by non-owner', async function () {
    expect(
      await chain.isEthException(usdGoldI.setRebasePaused(true, { from: user }))
    ).to.be.true;
  });
});

contract('UsdGold:PauseToken', function (accounts) {
  const policy = accounts[1];
  const rewardAddress = accounts[5];
  const A = accounts[2];
  const B = accounts[3];

  before('setup UsdGold contract', async function () {
    await setupContracts();
    await usdGoldI.setMonetaryPolicy(policy, {from: deployer});
    await usdGoldI.setRewardParams(rewardAddress, 10, 10, {from: deployer});
    r = await usdGoldI.setTokenPaused(true);
  });

  it('should emit pause event', async function () {
    const log = r.logs[0];
    expect(log).to.exist;
    expect(log.event).to.eq('LogTokenPaused');
    expect(log.args.paused).to.be.true;
  });

  it('should allow calling rebase', async function () {
    await usdGoldI.rebase(1, toUFrgDenomination(500), { from: policy });
  });

  it('should not allow calling transfer', async function () {
    expect(
      await chain.isEthException(usdGoldI.transfer(A, transferAmount, { from: deployer }))
    ).to.be.true;
  });

  it('should not allow calling approve', async function () {
    expect(
      await chain.isEthException(usdGoldI.approve(A, transferAmount, { from: deployer }))
    ).to.be.true;
  });

  it('should allow calling allowance', async function () {
    await usdGoldI.allowance.call(deployer, A);
  });

  it('should not allow calling transferFrom', async function () {
    expect(
      await chain.isEthException(usdGoldI.transferFrom(deployer, B, transferAmount, {from: A}))
    ).to.be.true;
  });

  it('should not allow calling increaseAllowance', async function () {
    expect(
      await chain.isEthException(usdGoldI.increaseAllowance(A, transferAmount, {from: deployer}))
    ).to.be.true;
  });

  it('should not allow calling decreaseAllowance', async function () {
    expect(
      await chain.isEthException(usdGoldI.decreaseAllowance(A, transferAmount, {from: deployer}))
    ).to.be.true;
  });

  it('should allow calling balanceOf', async function () {
    await usdGoldI.balanceOf.call(deployer);
  });

  it('should allow calling totalSupply', async function () {
    await usdGoldI.totalSupply.call();
  });
});

contract('UsdGold:PauseToken:accessControl', function (accounts) {
  before('setup UsdGold contract', setupContracts);

  it('should be callable by owner', async function () {
    expect(
      await chain.isEthException(usdGoldI.setTokenPaused(true, { from: deployer }))
    ).to.be.false;
  });

  it('should NOT be callable by non-owner', async function () {
    expect(
      await chain.isEthException(usdGoldI.setTokenPaused(true, { from: user }))
    ).to.be.true;
  });
});

contract('UsdGold:UsdGold:accessControl', function (accounts) {
  before('setup UsdGold contract', async function () {
    await setupContracts();
    await usdGoldI.setMonetaryPolicy(user, {from: deployer});
  });

  it('should be callable by monetary policy', async function () {
    expect(
      await chain.isEthException(usdGoldI.rebase(1, transferAmount, { from: user }))
    ).to.be.false;
  });

  it('should not be callable by others', async function () {
    expect(
      await chain.isEthException(usdGoldI.rebase(1, transferAmount, { from: deployer }))
    ).to.be.true;
  });
});

contract('UsdGold:UsdGold:Expansion', function (accounts) {
  // UsdGold +302,500 (10%), with starting balances A:10 and B:20.
  const A = accounts[2];
  const B = accounts[3];
  const policy = accounts[1];
  const rewardAddress = accounts[5];
  const usdGoldAmt = INTIAL_SUPPLY.div( new BigNumber(10));

  before('setup UsdGold contract', async function () {
    await setupContracts();
    await usdGoldI.setMonetaryPolicy(policy, {from: deployer});
    await usdGoldI.setRewardParams(rewardAddress, 10, 10, {from: deployer});
    await usdGoldI.transfer(A, toUFrgDenomination(10), { from: deployer });
    await usdGoldI.transfer(B, toUFrgDenomination(20), { from: deployer });
    r = await usdGoldI.rebase(1, usdGoldAmt, {from: policy});
  });

  it('should increase the totalSupply', async function () {
    b = await usdGoldI.totalSupply.call();
    b.should.be.bignumber.eq(initialSupply.add(usdGoldAmt));
  });

  it('should increase individual balances', async function () {
    b = await usdGoldI.balanceOf.call(A);
    const fee = parseInt(await usdGoldI._txFee.call());
    b.should.be.bignumber.gt(toUFrgDenomination(10 - 10/fee ));

    b = await usdGoldI.balanceOf.call(B);
    b.should.be.bignumber.gt(toUFrgDenomination(20 - 20 / fee));
  });

  it('should emit UsdGold', async function () {
    const log = r.logs[0];
    expect(log).to.exist;
    expect(log.event).to.eq('LogRebase');
    log.args.epoch.should.be.bignumber.eq(new BigNumber(1));
    log.args.totalSupply.should.be.bignumber.eq(initialSupply.add(usdGoldAmt));
  });

  it('should return the new supply', async function () {
    const returnVal = await usdGoldI.rebase.call(2, usdGoldAmt, {from: policy});
    await usdGoldI.rebase(2, usdGoldAmt, {from: policy});
    const supply = await usdGoldI.totalSupply.call();
    returnVal.should.be.bignumber.eq(supply);
  });
});

contract('UsdGold:UsdGold:Expansion', function (accounts) {
  const policy = accounts[1];
  const rewardAddress = accounts[5];
  const MAX_SUPPLY = new BigNumber(2).pow(new BigNumber(128)).sub(new BigNumber(1));

  describe('when totalSupply is less than MAX_SUPPLY and expands beyond', function () {
    before('setup UsdGold contract', async function () {
      await setupContracts();
      await usdGoldI.setMonetaryPolicy(policy, {from: deployer});
      await usdGoldI.setRewardParams(rewardAddress, 10, 10, {from: deployer});
      const totalSupply = await usdGoldI.totalSupply.call();
      await usdGoldI.rebase(1, MAX_SUPPLY.sub(totalSupply).sub(toUFrgDenomination(1)), {from: policy});
      r = await usdGoldI.rebase(2, toUFrgDenomination(2), {from: policy});
    });

    it('should increase the totalSupply to MAX_SUPPLY', async function () {
      b = await usdGoldI.totalSupply.call();
      b.should.be.bignumber.eq(MAX_SUPPLY);
    });

    it('should emit UsdGold', async function () {
      const log = r.logs[0];
      expect(log).to.exist;
      expect(log.event).to.eq('LogRebase');
      expect(log.args.epoch.toNumber()).to.eq(2);
      log.args.totalSupply.should.be.bignumber.eq(MAX_SUPPLY);
    });
  });

  describe('when totalSupply is MAX_SUPPLY and expands', function () {
    before(async function () {
      b = await usdGoldI.totalSupply.call();
      b.should.be.bignumber.eq(MAX_SUPPLY);
      r = await usdGoldI.rebase(3, toUFrgDenomination(2), {from: policy});
    });

    it('should NOT change the totalSupply', async function () {
      b = await usdGoldI.totalSupply.call();
      b.should.be.bignumber.eq(MAX_SUPPLY);
    });

    it('should emit UsdGold', async function () {
      const log = r.logs[0];
      expect(log).to.exist;
      expect(log.event).to.eq('LogRebase');
      expect(log.args.epoch.toNumber()).to.eq(3);
      log.args.totalSupply.should.be.bignumber.eq(MAX_SUPPLY);
    });
  });
});

contract('UsdGold:UsdGold:NoChange', function (accounts) {
  // UsdGold (0%), with starting balances A:750 and B:250.
  const A = accounts[2];
  const B = accounts[3];
  const policy = accounts[1];
  const rewardAddress = accounts[5];

  before('setup UsdGold contract', async function () {
    await setupContracts();
    await usdGoldI.setMonetaryPolicy(policy, {from: deployer});
    await usdGoldI.setRewardParams(rewardAddress, 10, 10, {from: deployer});
    await usdGoldI.transfer(A, toUFrgDenomination(750), { from: deployer });
    await usdGoldI.transfer(B, toUFrgDenomination(250), { from: deployer });
    r = await usdGoldI.rebase(1, 0, {from: policy});
  });

  it('should NOT CHANGE the totalSupply', async function () {
    b = await usdGoldI.totalSupply.call();
    b.should.be.bignumber.eq(initialSupply);
  });

  it('should NOT CHANGE individual balances', async function () {
    b = await usdGoldI.balanceOf.call(A);
    const fee = parseInt(await usdGoldI._txFee.call());
    b.should.be.bignumber.eq(toUFrgDenomination(750 - 750 / fee));

    b = await usdGoldI.balanceOf.call(B);
    b.should.be.bignumber.eq(toUFrgDenomination(250 - 250 / fee));
  });

  it('should emit UsdGold', async function () {
    const log = r.logs[0];
    expect(log).to.exist;
    expect(log.event).to.eq('LogRebase');
    log.args.epoch.should.be.bignumber.eq( new BigNumber(1));
    log.args.totalSupply.should.be.bignumber.eq(initialSupply);
  });
});

contract('UsdGold:UsdGold:Contraction', function (accounts) {
  // UsdGold -302500 (-10%), with starting balances A:10 and B:20.
  const A = accounts[2];
  const B = accounts[3];
  const policy = accounts[1];
  const rewardAddress = accounts[5];
  const usdGoldAmt = INTIAL_SUPPLY.div( new BigNumber(10));

  before('setup UsdGold contract', async function () {
    await setupContracts();
    await usdGoldI.setMonetaryPolicy(policy, {from: deployer});
    await usdGoldI.setRewardParams(rewardAddress, 10, 10, {from: deployer});
    await usdGoldI.transfer(A, toUFrgDenomination(10), { from: deployer });
    await usdGoldI.transfer(B, toUFrgDenomination(20), { from: deployer });
    r = await usdGoldI.rebase(1, new BigNumber(-1).mul( usdGoldAmt), {from: policy});
  });

  it('should decrease the totalSupply', async function () {
    b = await usdGoldI.totalSupply.call();
    b.should.be.bignumber.eq(initialSupply.sub(usdGoldAmt));
  });

  it('should decrease individual balances', async function () {
    const fee = parseInt(await usdGoldI._txFee.call());
    b = await usdGoldI.balanceOf.call(A);
    b.should.be.bignumber.lt(toUFrgDenomination(10- 10 /fee ));

    b = await usdGoldI.balanceOf.call(B);
    b.should.be.bignumber.lt(toUFrgDenomination(20 - 20 / fee));
  });

  it('should emit UsdGold', async function () {
    const log = r.logs[0];
    expect(log).to.exist;
    expect(log.event).to.eq('LogRebase');
    log.args.epoch.should.be.bignumber.eq( new BigNumber(1));
    log.args.totalSupply.should.be.bignumber.eq(initialSupply.sub(usdGoldAmt));
  });
});

contract('UsdGold:Transfer', async function (accounts) {
  const A = accounts[2];
  const B = accounts[3];
  const C = accounts[4];
  const rewardAddress = accounts[5];

  before('setup UsdGold contract', setupContracts);

  describe('deployer transfers 12 to A', function () {
    it('should have correct balances', async function () {
      await usdGoldI.setRewardParams(rewardAddress, 10, 10, {from: deployer});
      const fee = parseInt(await usdGoldI._txFee.call());

      const deployerBefore = await usdGoldI.balanceOf.call(deployer);
      await usdGoldI.transfer(A, toUFrgDenomination(12), { from: deployer });
      b = await usdGoldI.balanceOf.call(deployer);
      b.should.be.bignumber.eq(deployerBefore.sub(toUFrgDenomination(12)));
      b = await usdGoldI.balanceOf.call(A);
      b.should.be.bignumber.eq(toUFrgDenomination(((12 - 12/fee))*10).div(new BigNumber(10)));
    });
  });

  describe('deployer transfers 15 to B', async function () {
    it('should have balances [973,15]', async function () {
      await usdGoldI.setRewardParams(rewardAddress, 10, 10, {from: deployer});
      const fee = parseInt(await usdGoldI._txFee.call());
      const deployerBefore = await usdGoldI.balanceOf.call(deployer);
      await usdGoldI.transfer(B, toUFrgDenomination(15), { from: deployer });
      b = await usdGoldI.balanceOf.call(deployer);
      b.should.be.bignumber.eq(deployerBefore.sub(toUFrgDenomination(15)));
      b = await usdGoldI.balanceOf.call(B);
      b.should.be.bignumber.eq(toUFrgDenomination((15 - 15 / fee)*10).div(new BigNumber(10)));
    });
  });

  describe('deployer transfers the rest to C', async function () {
    it('should have balances [0,973]', async function () {
      await usdGoldI.setRewardParams(rewardAddress, 10, 10, {from: deployer});
      const fee = parseInt(await usdGoldI._txFee.call());
      const deployerBefore = await usdGoldI.balanceOf.call(deployer);
      await usdGoldI.transfer(C, deployerBefore, { from: deployer });
      b = await usdGoldI.balanceOf.call(deployer);
      b.should.be.bignumber.eq( new BigNumber(0));
      b = await usdGoldI.balanceOf.call(C);
      b.should.be.bignumber.eq( new BigNumber(deployerBefore - deployerBefore / fee));
    });
  });

  describe('when the recipient address is the contract address', async function () {
    const owner = A;

    it('reverts on transfer', async function () {
      expect(
        await chain.isEthException(usdGoldI.transfer(usdGoldI.address, unitTokenAmount, { from: owner }))
      ).to.be.true;
    });

    it('reverts on transferFrom', async function () {
      expect(
        await chain.isEthException(usdGoldI.transferFrom(owner, usdGoldI.address, unitTokenAmount, { from: owner }))
      ).to.be.true;
    });
  });

  describe('when the recipient is the zero address', function () {
    const owner = A;

    before(async function () {
      r = await usdGoldI.approve(ZERO_ADDRESS, transferAmount, { from: owner });
    });
    it('emits an approval event', async function () {
      expect(r.logs.length).to.eq(1);
      expect(r.logs[0].event).to.eq('Approval');
      expect(r.logs[0].args.owner).to.eq(owner);
      expect(r.logs[0].args.spender).to.eq(ZERO_ADDRESS);
      r.logs[0].args.value.should.be.bignumber.eq(transferAmount);
    });

    it('transferFrom should fail', async function () {
      expect(
        await chain.isEthException(usdGoldI.transferFrom(owner, ZERO_ADDRESS, transferAmount, { from: C }))
      ).to.be.true;
    });
  });
});
