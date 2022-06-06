/* eslint-disable no-unused-vars */
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MultiSigWallet contract", function () {
  let multiSigWallet;
  let owner;
  let account1;
  let account2;
  let account3;
  let accounts;

  before(async function () {
    const MultiSigWallet = await ethers.getContractFactory("MultiSigWallet");
    multiSigWallet = await MultiSigWallet.deploy();
    [owner, account1, account2, account3, ...accounts] =
      await ethers.getSigners();
    await multiSigWallet.deployed();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await multiSigWallet.owner()).to.equal(owner.address);
    });

    it("Should set pending transactions to an empty array", async function () {
      const pendingTransactions = await multiSigWallet.getPendingTransactions();
      expect(pendingTransactions).to.deep.equal([]);
    });

    it("Should set minimum signatures to 2", async function () {
      const minSignatures = await multiSigWallet.MIN_SIGNATURES();
      expect(minSignatures).to.equal(2);
    });
  });

  describe("Managing permissions", function () {
    it("Should add a new valid owner", async function () {
      await expect(
        multiSigWallet.addOwner(account1.address)
      ).to.not.be.revertedWith("You are not the owner");
    });

    it("Should fail if sender is not the owner", async function () {
      await expect(
        multiSigWallet.connect(account1).addOwner(owner.address)
      ).to.be.revertedWith("You are not the owner");
    });

    it("Should remove a valid owner", async function () {
      await expect(
        multiSigWallet.removeOwner(account1.address)
      ).to.not.be.revertedWith("You are not the owner");
    });

    it("Should add 2 new valid owners", async function () {
      await expect(
        multiSigWallet.addOwner(account1.address)
      ).to.not.be.revertedWith("You are not the owner");
      await expect(
        multiSigWallet.addOwner(account2.address)
      ).to.not.be.revertedWith("You are not the owner");
    });
  });

  describe("Transactions", function () {
    it("Should add funds", async function () {
      await expect(
        owner.sendTransaction({
          to: multiSigWallet.address,
          value: ethers.utils.parseEther("1"),
        })
      )
        .to.emit(multiSigWallet, "DepositFunds")
        .withArgs(owner.address, ethers.utils.parseEther("1"));
      expect(await ethers.provider.getBalance(multiSigWallet.address)).to.equal(
        ethers.utils.parseEther("1")
      );
    });

    it("Should fail to add transaction if it is not a valid owner", async function () {
      await expect(
        multiSigWallet
          .connect(accounts[0])
          .transferTo(owner.address, ethers.utils.parseEther("1"))
      ).to.be.revertedWith("You are not a valid owner");
    });

    it("Should fail to add transaction if amount exceeds contract balance", async function () {
      await expect(
        multiSigWallet.transferTo(
          account1.address,
          ethers.utils.parseEther("2")
        )
      ).to.be.revertedWith("Cannot withdraw that amount");
    });

    it("Should add a transaction", async function () {
      await expect(
        multiSigWallet.transferTo(
          account3.address,
          ethers.utils.parseEther("1")
        )
      )
        .to.emit(multiSigWallet, "TransactionCreated")
        .withArgs(
          owner.address,
          account3.address,
          ethers.utils.parseEther("1"),
          0
        );
    });

    it("Should be a new pending transaction", async function () {
      const pendingTransactions = await multiSigWallet.getPendingTransactions();
      expect(pendingTransactions.map((tx) => tx.toNumber())).to.deep.equal([0]);
    });

    it("Should add a second transaction", async function () {
      await expect(
        multiSigWallet.transferTo(
          account3.address,
          ethers.utils.parseEther("1")
        )
      )
        .to.emit(multiSigWallet, "TransactionCreated")
        .withArgs(
          owner.address,
          account3.address,
          ethers.utils.parseEther("1"),
          1
        );
    });

    it("Should be 2 pending transactions", async function () {
      const pendingTransactions = await multiSigWallet.getPendingTransactions();
      expect(pendingTransactions.map((tx) => tx.toNumber())).to.deep.equal([
        0, 1,
      ]);
    });

    it("Should delete the first transaction", async function () {
      await expect(multiSigWallet.deleteTransaction(0))
        .to.emit(multiSigWallet, "TransactionDeleted")
        .withArgs(owner.address, 0);
    });

    it("Should be only one pending transaction", async function () {
      const pendingTransactions = await multiSigWallet.getPendingTransactions();
      expect(pendingTransactions.map((tx) => tx.toNumber())).to.deep.equal([1]);
    });

    it("Should fail if the transaction does not exist", async function () {
      await expect(
        multiSigWallet.connect(account1).signTransaction(0)
      ).to.be.revertedWith("Transaction must exist");
    });

    it("Should fail because creator cannot sign the transaction", async function () {
      await expect(multiSigWallet.signTransaction(1)).to.be.revertedWith(
        "Creator cannot sign it"
      );
    });

    it("Should sign the transaction", async function () {
      await expect(multiSigWallet.connect(account1).signTransaction(1))
        .to.emit(multiSigWallet, "TransactionSigned")
        .withArgs(account1.address, 1);
    });

    it("Should fail because it is already signed by previous account", async function () {
      await expect(
        multiSigWallet.connect(account1).signTransaction(1)
      ).to.be.revertedWith("Transaction already signed");
    });

    it("Should add another transaction", async function () {
      await expect(
        multiSigWallet.transferTo(
          account3.address,
          ethers.utils.parseEther("1")
        )
      )
        .to.emit(multiSigWallet, "TransactionCreated")
        .withArgs(
          owner.address,
          account3.address,
          ethers.utils.parseEther("1"),
          2
        );
    });

    it("Should have same balance before transaction completed", async function () {
      expect(await ethers.provider.getBalance(account3.address)).to.equal(
        ethers.utils.parseEther("10000")
      );
    });

    it("Should sign the first transaction and be completed", async function () {
      await expect(multiSigWallet.connect(account2).signTransaction(1))
        .to.emit(multiSigWallet, "TransactionSigned")
        .withArgs(account1.address, 1)
        .to.emit(multiSigWallet, "TransactionCompleted")
        .withArgs(
          owner.address,
          account3.address,
          ethers.utils.parseEther("1"),
          1
        );
    });

    it("Should have 1 ether more (account)", async function () {
      expect(await ethers.provider.getBalance(account3.address)).to.equal(
        ethers.utils.parseEther("10001")
      );
    });

    it("Should have no ether (contract)", async function () {
      expect(await ethers.provider.getBalance(multiSigWallet.address)).to.equal(
        ethers.utils.parseEther("0")
      );
    });

    it("Should have only one pending transaction", async function () {
      const pendingTransactions = await multiSigWallet.getPendingTransactions();
      expect(pendingTransactions.map((tx) => tx.toNumber())).to.deep.equal([2]);
    });

    it("Should sign the last transaction", async function () {
      await expect(multiSigWallet.connect(account1).signTransaction(2))
        .to.emit(multiSigWallet, "TransactionSigned")
        .withArgs(account1.address, 2);
    });

    it("Should sign the last transaction and fail because there are not enough funds", async function () {
      await expect(
        multiSigWallet.connect(account2).signTransaction(2)
      ).to.be.revertedWith("Not enough funds");
    });
  });
});
