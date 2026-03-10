import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("BidManager", function () {
    async function deployFixture() {
        const [admin, authority, bidder1, bidder2, evaluator, other] = await ethers.getSigners();

        // Deploy TenderRegistry
        const TenderRegistry = await ethers.getContractFactory("TenderRegistry");
        const registry = await TenderRegistry.deploy(admin.address);
        const registryAddr = await registry.getAddress();

        // Deploy BidManager
        const BidManager = await ethers.getContractFactory("BidManager");
        const bidManager = await BidManager.deploy(registryAddr, admin.address);

        const AUTHORITY_ROLE = await registry.AUTHORITY_ROLE();
        await registry.grantRole(AUTHORITY_ROLE, authority.address);

        const EVALUATOR_ROLE = await bidManager.EVALUATOR_ROLE();
        await bidManager.grantRole(EVALUATOR_ROLE, evaluator.address);

        // Create and publish a tender
        const now = await time.latest();
        const submissionDeadline = now + 86400;
        const revealDeadline = now + 172800;

        await registry.connect(authority).createTender(
            "QmTestHash", submissionDeadline, revealDeadline, "QmEligibility", 1000, 100000
        );
        await registry.connect(authority).publishTender(1);

        // Helper to compute commitment
        function computeCommitment(bidderAddr: string, tenderId: number, payloadHash: string, salt: string) {
            return ethers.keccak256(
                ethers.solidityPacked(
                    ["address", "uint256", "bytes32", "bytes32"],
                    [bidderAddr, tenderId, payloadHash, salt]
                )
            );
        }

        const salt1 = ethers.hexlify(ethers.randomBytes(32));
        const payload1 = ethers.keccak256(ethers.toUtf8Bytes('{"amount":5000,"score":"A"}'));
        const commitment1 = computeCommitment(bidder1.address, 1, payload1, salt1);

        const salt2 = ethers.hexlify(ethers.randomBytes(32));
        const payload2 = ethers.keccak256(ethers.toUtf8Bytes('{"amount":7000,"score":"B"}'));
        const commitment2 = computeCommitment(bidder2.address, 1, payload2, salt2);

        return {
            registry, bidManager, admin, authority, bidder1, bidder2, evaluator, other,
            submissionDeadline, revealDeadline,
            salt1, payload1, commitment1,
            salt2, payload2, commitment2,
            computeCommitment
        };
    }

    describe("submitCommitment", function () {
        it("Should accept a valid commitment", async function () {
            const { bidManager, bidder1, commitment1 } = await loadFixture(deployFixture);
            await bidManager.connect(bidder1).submitCommitment(1, commitment1);
            expect(await bidManager.getCommitment(1, bidder1.address)).to.equal(commitment1);
        });

        it("Should emit CommitmentSubmitted event", async function () {
            const { bidManager, bidder1, commitment1 } = await loadFixture(deployFixture);
            await expect(bidManager.connect(bidder1).submitCommitment(1, commitment1))
                .to.emit(bidManager, "CommitmentSubmitted");
        });

        it("Should revert on duplicate commitment", async function () {
            const { bidManager, bidder1, commitment1 } = await loadFixture(deployFixture);
            await bidManager.connect(bidder1).submitCommitment(1, commitment1);
            await expect(bidManager.connect(bidder1).submitCommitment(1, commitment1))
                .to.be.revertedWithCustomError(bidManager, "CommitmentAlreadyExists");
        });

        it("Should revert on zero commitment", async function () {
            const { bidManager, bidder1 } = await loadFixture(deployFixture);
            await expect(bidManager.connect(bidder1).submitCommitment(1, ethers.ZeroHash))
                .to.be.revertedWithCustomError(bidManager, "ZeroCommitment");
        });

        it("Should revert after submission deadline", async function () {
            const { bidManager, bidder1, commitment1, submissionDeadline } = await loadFixture(deployFixture);
            await time.increaseTo(submissionDeadline + 1);
            await expect(bidManager.connect(bidder1).submitCommitment(1, commitment1))
                .to.be.revertedWithCustomError(bidManager, "SubmissionDeadlinePassed");
        });

        it("Should allow multiple bidders on same tender", async function () {
            const { bidManager, bidder1, bidder2, commitment1, commitment2 } = await loadFixture(deployFixture);
            await bidManager.connect(bidder1).submitCommitment(1, commitment1);
            await bidManager.connect(bidder2).submitCommitment(1, commitment2);
            expect(await bidManager.getCommitment(1, bidder1.address)).to.equal(commitment1);
            expect(await bidManager.getCommitment(1, bidder2.address)).to.equal(commitment2);
        });
    });

    describe("revealBid", function () {
        it("Should reveal a valid bid", async function () {
            const { bidManager, bidder1, commitment1, salt1, payload1, submissionDeadline, evaluator } = await loadFixture(deployFixture);
            await bidManager.connect(bidder1).submitCommitment(1, commitment1);
            await time.increaseTo(submissionDeadline + 1);
            await bidManager.connect(bidder1).revealBid(1, 5000, payload1, salt1);

            const bid = await bidManager.connect(evaluator).getBid(1, bidder1.address);
            expect(bid.revealed).to.be.true;
            expect(bid.amount).to.equal(5000);
        });

        it("Should emit BidRevealed event", async function () {
            const { bidManager, bidder1, commitment1, salt1, payload1, submissionDeadline } = await loadFixture(deployFixture);
            await bidManager.connect(bidder1).submitCommitment(1, commitment1);
            await time.increaseTo(submissionDeadline + 1);
            await expect(bidManager.connect(bidder1).revealBid(1, 5000, payload1, salt1))
                .to.emit(bidManager, "BidRevealed");
        });

        it("Should revert reveal before submission deadline", async function () {
            const { bidManager, bidder1, commitment1, salt1, payload1 } = await loadFixture(deployFixture);
            await bidManager.connect(bidder1).submitCommitment(1, commitment1);
            await expect(bidManager.connect(bidder1).revealBid(1, 5000, payload1, salt1))
                .to.be.revertedWithCustomError(bidManager, "SubmissionDeadlineNotPassed");
        });

        it("Should revert reveal after reveal deadline", async function () {
            const { bidManager, bidder1, commitment1, salt1, payload1, revealDeadline } = await loadFixture(deployFixture);
            await bidManager.connect(bidder1).submitCommitment(1, commitment1);
            await time.increaseTo(revealDeadline + 1);
            await expect(bidManager.connect(bidder1).revealBid(1, 5000, payload1, salt1))
                .to.be.revertedWithCustomError(bidManager, "RevealDeadlinePassed");
        });

        it("Should revert on tampered payloadHash", async function () {
            const { bidManager, bidder1, commitment1, salt1, submissionDeadline } = await loadFixture(deployFixture);
            await bidManager.connect(bidder1).submitCommitment(1, commitment1);
            await time.increaseTo(submissionDeadline + 1);
            const fakePayload = ethers.keccak256(ethers.toUtf8Bytes('{"amount":9999,"score":"FAKE"}'));
            await expect(bidManager.connect(bidder1).revealBid(1, 5000, fakePayload, salt1))
                .to.be.revertedWithCustomError(bidManager, "CommitmentMismatch");
        });

        it("Should revert on tampered salt", async function () {
            const { bidManager, bidder1, commitment1, payload1, submissionDeadline } = await loadFixture(deployFixture);
            await bidManager.connect(bidder1).submitCommitment(1, commitment1);
            await time.increaseTo(submissionDeadline + 1);
            const fakeSalt = ethers.hexlify(ethers.randomBytes(32));
            await expect(bidManager.connect(bidder1).revealBid(1, 5000, payload1, fakeSalt))
                .to.be.revertedWithCustomError(bidManager, "CommitmentMismatch");
        });

        it("Should revert on double reveal", async function () {
            const { bidManager, bidder1, commitment1, salt1, payload1, submissionDeadline } = await loadFixture(deployFixture);
            await bidManager.connect(bidder1).submitCommitment(1, commitment1);
            await time.increaseTo(submissionDeadline + 1);
            await bidManager.connect(bidder1).revealBid(1, 5000, payload1, salt1);
            await expect(bidManager.connect(bidder1).revealBid(1, 5000, payload1, salt1))
                .to.be.revertedWithCustomError(bidManager, "AlreadyRevealed");
        });

        it("Should revert if no commitment exists", async function () {
            const { bidManager, other, salt1, payload1, submissionDeadline } = await loadFixture(deployFixture);
            await time.increaseTo(submissionDeadline + 1);
            await expect(bidManager.connect(other).revealBid(1, 5000, payload1, salt1))
                .to.be.revertedWithCustomError(bidManager, "NoCommitmentFound");
        });

        it("Should revert if bid below minimum", async function () {
            const { bidManager, bidder1, submissionDeadline, computeCommitment } = await loadFixture(deployFixture);
            const salt = ethers.hexlify(ethers.randomBytes(32));
            const payload = ethers.keccak256(ethers.toUtf8Bytes('{"amount":500}'));
            const commitment = computeCommitment(bidder1.address, 1, payload, salt);
            await bidManager.connect(bidder1).submitCommitment(1, commitment);
            await time.increaseTo(submissionDeadline + 1);
            await expect(bidManager.connect(bidder1).revealBid(1, 500, payload, salt))
                .to.be.revertedWithCustomError(bidManager, "BidBelowMinimum");
        });
    });

    describe("Access control", function () {
        it("Should restrict getBid to EVALUATOR_ROLE", async function () {
            const { bidManager, other } = await loadFixture(deployFixture);
            await expect(bidManager.connect(other).getBid(1, other.address))
                .to.be.reverted;
        });

        it("Should restrict getBidderList to EVALUATOR_ROLE", async function () {
            const { bidManager, other } = await loadFixture(deployFixture);
            await expect(bidManager.connect(other).getBidderList(1))
                .to.be.reverted;
        });

        it("Should allow anyone to read commitments (audit)", async function () {
            const { bidManager, bidder1, commitment1, other } = await loadFixture(deployFixture);
            await bidManager.connect(bidder1).submitCommitment(1, commitment1);
            expect(await bidManager.connect(other).getCommitment(1, bidder1.address)).to.equal(commitment1);
        });
    });

    describe("Bidder list & forfeit", function () {
        it("Should track bidder list correctly", async function () {
            const { bidManager, bidder1, bidder2, commitment1, commitment2, evaluator } = await loadFixture(deployFixture);
            await bidManager.connect(bidder1).submitCommitment(1, commitment1);
            await bidManager.connect(bidder2).submitCommitment(1, commitment2);
            const bidders = await bidManager.connect(evaluator).getBidderList(1);
            expect(bidders).to.include(bidder1.address);
            expect(bidders).to.include(bidder2.address);
        });

        it("Should emit BidForfeited for unrevealed bids after deadline", async function () {
            const { bidManager, bidder1, commitment1, revealDeadline, evaluator } = await loadFixture(deployFixture);
            await bidManager.connect(bidder1).submitCommitment(1, commitment1);
            await time.increaseTo(revealDeadline + 1);
            await expect(bidManager.connect(evaluator).forfeitBid(1, bidder1.address))
                .to.emit(bidManager, "BidForfeited").withArgs(1, bidder1.address);
        });
    });

    describe("Gas profiling", function () {
        it("Should record gas for submitCommitment", async function () {
            const { bidManager, bidder1, commitment1 } = await loadFixture(deployFixture);
            const tx = await bidManager.connect(bidder1).submitCommitment(1, commitment1);
            const receipt = await tx.wait();
            console.log(`    ⛽ submitCommitment gas used: ${receipt?.gasUsed.toString()}`);
        });

        it("Should record gas for revealBid", async function () {
            const { bidManager, bidder1, commitment1, salt1, payload1, submissionDeadline } = await loadFixture(deployFixture);
            await bidManager.connect(bidder1).submitCommitment(1, commitment1);
            await time.increaseTo(submissionDeadline + 1);
            const tx = await bidManager.connect(bidder1).revealBid(1, 5000, payload1, salt1);
            const receipt = await tx.wait();
            console.log(`    ⛽ revealBid gas used: ${receipt?.gasUsed.toString()}`);
        });
    });
});
