import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("TenderRegistry", function () {
    async function deployFixture() {
        const [admin, authority, contractor1, contractor2, other] = await ethers.getSigners();

        const TenderRegistry = await ethers.getContractFactory("TenderRegistry");
        const registry = await TenderRegistry.deploy(admin.address);

        const AUTHORITY_ROLE = await registry.AUTHORITY_ROLE();
        await registry.grantRole(AUTHORITY_ROLE, authority.address);

        const now = await time.latest();
        const submissionDeadline = now + 86400; // 1 day
        const revealDeadline = now + 172800;    // 2 days

        return { registry, admin, authority, contractor1, contractor2, other, AUTHORITY_ROLE, submissionDeadline, revealDeadline };
    }

    describe("Deployment", function () {
        it("Should set the admin role", async function () {
            const { registry, admin } = await loadFixture(deployFixture);
            expect(await registry.hasRole(await registry.DEFAULT_ADMIN_ROLE(), admin.address)).to.be.true;
        });

        it("Should revert on zero address admin", async function () {
            const TenderRegistry = await ethers.getContractFactory("TenderRegistry");
            await expect(TenderRegistry.deploy(ethers.ZeroAddress)).to.be.revertedWithCustomError(TenderRegistry, "ZeroAddress");
        });
    });

    describe("createTender", function () {
        it("Should create a tender in DRAFT status", async function () {
            const { registry, authority, submissionDeadline, revealDeadline } = await loadFixture(deployFixture);
            await registry.connect(authority).createTender(
                "QmTestHash", submissionDeadline, revealDeadline, "QmEligibility", 1000, 100000
            );
            const tender = await registry.getTender(1);
            expect(tender.status).to.equal(0); // DRAFT
            expect(tender.procurementAuthority).to.equal(authority.address);
            expect(tender.ipfsDocumentHash).to.equal("QmTestHash");
        });

        it("Should emit TenderCreated event", async function () {
            const { registry, authority, submissionDeadline, revealDeadline } = await loadFixture(deployFixture);
            await expect(registry.connect(authority).createTender(
                "QmTestHash", submissionDeadline, revealDeadline, "QmEligibility", 1000, 100000
            )).to.emit(registry, "TenderCreated");
        });

        it("Should auto-increment tender IDs", async function () {
            const { registry, authority, submissionDeadline, revealDeadline } = await loadFixture(deployFixture);
            await registry.connect(authority).createTender("QmHash1", submissionDeadline, revealDeadline, "QmE1", 100, 10000);
            await registry.connect(authority).createTender("QmHash2", submissionDeadline, revealDeadline, "QmE2", 200, 20000);
            expect(await registry.tenderCount()).to.equal(2);
        });

        it("Should revert if caller lacks AUTHORITY_ROLE", async function () {
            const { registry, other, submissionDeadline, revealDeadline } = await loadFixture(deployFixture);
            await expect(registry.connect(other).createTender(
                "QmHash", submissionDeadline, revealDeadline, "QmE", 100, 10000
            )).to.be.reverted;
        });

        it("Should revert if submission deadline is in the past", async function () {
            const { registry, authority, revealDeadline } = await loadFixture(deployFixture);
            const pastDeadline = (await time.latest()) - 100;
            await expect(registry.connect(authority).createTender(
                "QmHash", pastDeadline, revealDeadline, "QmE", 100, 10000
            )).to.be.revertedWithCustomError(registry, "InvalidDeadlines");
        });

        it("Should revert if reveal deadline <= submission deadline", async function () {
            const { registry, authority, submissionDeadline } = await loadFixture(deployFixture);
            await expect(registry.connect(authority).createTender(
                "QmHash", submissionDeadline, submissionDeadline, "QmE", 100, 10000
            )).to.be.revertedWithCustomError(registry, "InvalidDeadlines");
        });
    });

    describe("Lifecycle transitions", function () {
        async function createTenderFixture() {
            const fixture = await loadFixture(deployFixture);
            const { registry, authority, submissionDeadline, revealDeadline } = fixture;
            await registry.connect(authority).createTender("QmHash", submissionDeadline, revealDeadline, "QmE", 1000, 100000);
            return fixture;
        }

        it("Should publish a DRAFT tender", async function () {
            const { registry, authority } = await createTenderFixture();
            await registry.connect(authority).publishTender(1);
            expect((await registry.getTender(1)).status).to.equal(1); // PUBLISHED
        });

        it("Should emit TenderPublished", async function () {
            const { registry, authority } = await createTenderFixture();
            await expect(registry.connect(authority).publishTender(1)).to.emit(registry, "TenderPublished");
        });

        it("Should revert publishing non-DRAFT tender", async function () {
            const { registry, authority } = await createTenderFixture();
            await registry.connect(authority).publishTender(1);
            await expect(registry.connect(authority).publishTender(1)).to.be.revertedWithCustomError(registry, "InvalidStatus");
        });

        it("Should close a PUBLISHED tender after deadline", async function () {
            const { registry, authority, submissionDeadline } = await createTenderFixture();
            await registry.connect(authority).publishTender(1);
            await time.increaseTo(submissionDeadline + 1);
            await registry.connect(authority).closeTender(1);
            expect((await registry.getTender(1)).status).to.equal(2); // CLOSED
        });

        it("Should revert closing before deadline", async function () {
            const { registry, authority } = await createTenderFixture();
            await registry.connect(authority).publishTender(1);
            await expect(registry.connect(authority).closeTender(1))
                .to.be.revertedWithCustomError(registry, "DeadlineNotPassed");
        });

        it("Should move to EVALUATION from CLOSED", async function () {
            const { registry, authority, submissionDeadline } = await createTenderFixture();
            await registry.connect(authority).publishTender(1);
            await time.increaseTo(submissionDeadline + 1);
            await registry.connect(authority).closeTender(1);
            await registry.connect(authority).startEvaluation(1);
            expect((await registry.getTender(1)).status).to.equal(3); // EVALUATION
        });

        it("Should award a tender from EVALUATION", async function () {
            const { registry, authority, contractor1, submissionDeadline } = await createTenderFixture();
            await registry.connect(authority).publishTender(1);
            await time.increaseTo(submissionDeadline + 1);
            await registry.connect(authority).closeTender(1);
            await registry.connect(authority).startEvaluation(1);
            await registry.connect(authority).awardTender(1, contractor1.address);
            const tender = await registry.getTender(1);
            expect(tender.status).to.equal(4); // AWARDED
            expect(tender.awardedTo).to.equal(contractor1.address);
        });

        it("Should emit TenderAwarded", async function () {
            const { registry, authority, contractor1, submissionDeadline } = await createTenderFixture();
            await registry.connect(authority).publishTender(1);
            await time.increaseTo(submissionDeadline + 1);
            await registry.connect(authority).closeTender(1);
            await registry.connect(authority).startEvaluation(1);
            await expect(registry.connect(authority).awardTender(1, contractor1.address))
                .to.emit(registry, "TenderAwarded").withArgs(1, contractor1.address);
        });

        it("Should revert awarding to zero address", async function () {
            const { registry, authority, submissionDeadline } = await createTenderFixture();
            await registry.connect(authority).publishTender(1);
            await time.increaseTo(submissionDeadline + 1);
            await registry.connect(authority).closeTender(1);
            await registry.connect(authority).startEvaluation(1);
            await expect(registry.connect(authority).awardTender(1, ethers.ZeroAddress))
                .to.be.revertedWithCustomError(registry, "ZeroAddress");
        });
    });

    describe("cancelTender", function () {
        it("Should cancel a DRAFT tender", async function () {
            const { registry, authority, submissionDeadline, revealDeadline } = await loadFixture(deployFixture);
            await registry.connect(authority).createTender("QmHash", submissionDeadline, revealDeadline, "QmE", 1000, 100000);
            await registry.connect(authority).cancelTender(1, "Budget cut");
            const tender = await registry.getTender(1);
            expect(tender.status).to.equal(5); // CANCELLED
            expect(tender.cancellationReason).to.equal("Budget cut");
        });

        it("Should cancel a PUBLISHED tender", async function () {
            const { registry, authority, submissionDeadline, revealDeadline } = await loadFixture(deployFixture);
            await registry.connect(authority).createTender("QmHash", submissionDeadline, revealDeadline, "QmE", 1000, 100000);
            await registry.connect(authority).publishTender(1);
            await registry.connect(authority).cancelTender(1, "Scope change");
            expect((await registry.getTender(1)).status).to.equal(5);
        });

        it("Should revert cancelling an AWARDED tender", async function () {
            const { registry, authority, contractor1, submissionDeadline, revealDeadline } = await loadFixture(deployFixture);
            await registry.connect(authority).createTender("QmHash", submissionDeadline, revealDeadline, "QmE", 1000, 100000);
            await registry.connect(authority).publishTender(1);
            await time.increaseTo(submissionDeadline + 1);
            await registry.connect(authority).closeTender(1);
            await registry.connect(authority).startEvaluation(1);
            await registry.connect(authority).awardTender(1, contractor1.address);
            await expect(registry.connect(authority).cancelTender(1, "Too late"))
                .to.be.revertedWith("Cannot cancel awarded or already cancelled tender");
        });
    });

    describe("Edge cases", function () {
        it("Should revert on non-existent tender ID", async function () {
            const { registry } = await loadFixture(deployFixture);
            await expect(registry.getTender(999))
                .to.be.revertedWithCustomError(registry, "TenderNotFound");
        });

        it("Should revert on tender ID 0", async function () {
            const { registry } = await loadFixture(deployFixture);
            await expect(registry.getTender(0))
                .to.be.revertedWithCustomError(registry, "TenderNotFound");
        });
    });
});
