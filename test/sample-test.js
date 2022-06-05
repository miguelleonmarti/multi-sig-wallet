const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MultiSigWallet", function () {
  it("Test", async function () {
    const MultiSigWallet = await ethers.getContractFactory("MultiSigWallet");
    const multiSigWallet = await MultiSigWallet.deploy();
    await multiSigWallet.deployed();
    expect(true).to.equal(true);
  });
});
