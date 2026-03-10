import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";

// ═══════════════════════════════════════════════════════════════
// Additional coverage tests for DisputeResolution
// ═══════════════════════════════════════════════════════════════
describe("DisputeResolution — Coverage Gaps", function () {
    async function deployFixture() {
        const [admin, panel1, panel2, panel3, appellant, appellant2, treasury, other] = await ethers.getSigners();
        const DisputeResolution = await ethers.getContractFactory("DisputeResolution");
        const dispute = await DisputeResolution.deploy(admin.address, treasury.address);
        const PANEL_ROLE = await dispute.PANEL_MEMBER_ROLE();
        await dispute.grantRole(PANEL_ROLE, panel1.address);
        await dispute.grantRole(PANEL_ROLE, panel2.address);
        await dispute.grantRole(PANEL_ROLE, panel3.address);
        return { dispute, admin, panel1, panel2, panel3, appellant, appellant2, treasury, other, PANEL_ROLE };
    }

    it("Should revert constructor with zero admin address", async function () {
        const [_, treasury] = await ethers.getSigners();
        const F = await ethers.getContractFactory("DisputeResolution");
        await expect(F.deploy(ethers.ZeroAddress, treasury.address)).to.be.revertedWith("Zero address");
    });

    it("Should revert constructor with zero treasury address", async function () {
        const [admin] = await ethers.getSigners();
        const F = await ethers.getContractFactory("DisputeResolution");
        await expect(F.deploy(admin.address, ethers.ZeroAddress)).to.be.revertedWith("Zero address");
    });

    it("Should emit AppealFiled with correct args", async function () {
        const { dispute, appellant } = await loadFixture(deployFixture);
        const bond = ethers.parseEther("0.01");
        await expect(dispute.connect(appellant).fileAppeal(1, "Unfair", { value: bond }))
            .to.emit(dispute, "AppealFiled")
            .withArgs(1, 1, appellant.address, bond);
    });

    it("Should revert voting by non-panel member", async function () {
        const { dispute, appellant, other } = await loadFixture(deployFixture);
        await dispute.connect(appellant).fileAppeal(1, "Unfair", { value: ethers.parseEther("0.01") });
        await expect(dispute.connect(other).voteOnAppeal(1, true)).to.be.reverted;
    });

    it("Should revert voting on non-existent appeal", async function () {
        const { dispute, panel1 } = await loadFixture(deployFixture);
        await expect(dispute.connect(panel1).voteOnAppeal(99, true)).to.be.revertedWith("Appeal not found");
    });

    it("Should revert voting on already-resolved appeal (APPROVED)", async function () {
        const { dispute, panel1, panel2, panel3, appellant } = await loadFixture(deployFixture);
        await dispute.connect(appellant).fileAppeal(1, "Test", { value: ethers.parseEther("0.01") });
        await dispute.connect(panel1).voteOnAppeal(1, true);
        await dispute.connect(panel2).voteOnAppeal(1, true); // resolves as APPROVED
        await expect(dispute.connect(panel3).voteOnAppeal(1, true))
            .to.be.revertedWithCustomError(dispute, "AppealNotActive");
    });

    it("Should revert voting on already-resolved appeal (REJECTED)", async function () {
        const { dispute, panel1, panel2, panel3, appellant } = await loadFixture(deployFixture);
        await dispute.connect(appellant).fileAppeal(1, "Test", { value: ethers.parseEther("0.01") });
        await dispute.connect(panel1).voteOnAppeal(1, false);
        await dispute.connect(panel2).voteOnAppeal(1, false); // resolves as REJECTED
        await expect(dispute.connect(panel3).voteOnAppeal(1, false))
            .to.be.revertedWithCustomError(dispute, "AppealNotActive");
    });

    it("Should handle tied vote (1 approve, 1 reject) then resolve on 3rd vote approve", async function () {
        const { dispute, panel1, panel2, panel3, appellant } = await loadFixture(deployFixture);
        await dispute.connect(appellant).fileAppeal(1, "Tied", { value: ethers.parseEther("0.01") });
        await dispute.connect(panel1).voteOnAppeal(1, true);
        await dispute.connect(panel2).voteOnAppeal(1, false);
        // At this point: 1 approve, 1 reject — not resolved
        let appeal = await dispute.getAppeal(1);
        expect(appeal.status).to.equal(1); // UNDER_REVIEW
        // Third vote decides
        await dispute.connect(panel3).voteOnAppeal(1, true);
        appeal = await dispute.getAppeal(1);
        expect(appeal.status).to.equal(2); // APPROVED
    });

    it("Should handle tied vote resolved by reject", async function () {
        const { dispute, panel1, panel2, panel3, appellant } = await loadFixture(deployFixture);
        await dispute.connect(appellant).fileAppeal(1, "Tied", { value: ethers.parseEther("0.01") });
        await dispute.connect(panel1).voteOnAppeal(1, false);
        await dispute.connect(panel2).voteOnAppeal(1, true);
        await dispute.connect(panel3).voteOnAppeal(1, false);
        const appeal = await dispute.getAppeal(1);
        expect(appeal.status).to.equal(3); // REJECTED
    });

    it("Should emit BondReturned on approved appeal", async function () {
        const { dispute, panel1, panel2, appellant } = await loadFixture(deployFixture);
        const bond = ethers.parseEther("0.01");
        await dispute.connect(appellant).fileAppeal(1, "Test", { value: bond });
        await dispute.connect(panel1).voteOnAppeal(1, true);
        await expect(dispute.connect(panel2).voteOnAppeal(1, true))
            .to.emit(dispute, "BondReturned")
            .withArgs(1, appellant.address, bond);
    });

    it("Should emit BondForfeited on rejected appeal", async function () {
        const { dispute, panel1, panel2, appellant } = await loadFixture(deployFixture);
        const bond = ethers.parseEther("0.01");
        await dispute.connect(appellant).fileAppeal(1, "Test", { value: bond });
        await dispute.connect(panel1).voteOnAppeal(1, false);
        await expect(dispute.connect(panel2).voteOnAppeal(1, false))
            .to.emit(dispute, "BondForfeited")
            .withArgs(1, bond);
    });

    it("Should emit AppealResolved on resolution", async function () {
        const { dispute, panel1, panel2, appellant } = await loadFixture(deployFixture);
        await dispute.connect(appellant).fileAppeal(1, "Test", { value: ethers.parseEther("0.01") });
        await dispute.connect(panel1).voteOnAppeal(1, true);
        await expect(dispute.connect(panel2).voteOnAppeal(1, true))
            .to.emit(dispute, "AppealResolved");
    });

    it("Should emit AppealVoted events", async function () {
        const { dispute, panel1, appellant } = await loadFixture(deployFixture);
        await dispute.connect(appellant).fileAppeal(1, "Test", { value: ethers.parseEther("0.01") });
        await expect(dispute.connect(panel1).voteOnAppeal(1, true))
            .to.emit(dispute, "AppealVoted")
            .withArgs(1, panel1.address, true);
    });

    it("Should revert getAppeal with invalid ID (0)", async function () {
        const { dispute } = await loadFixture(deployFixture);
        await expect(dispute.getAppeal(0)).to.be.revertedWith("Invalid appeal");
    });

    it("Should revert getAppeal with ID exceeding count", async function () {
        const { dispute } = await loadFixture(deployFixture);
        await expect(dispute.getAppeal(999)).to.be.revertedWith("Invalid appeal");
    });

    it("Should allow filing appeal on different tender after resolution", async function () {
        const { dispute, panel1, panel2, appellant } = await loadFixture(deployFixture);
        await dispute.connect(appellant).fileAppeal(1, "First", { value: ethers.parseEther("0.01") });
        await dispute.connect(panel1).voteOnAppeal(1, true);
        await dispute.connect(panel2).voteOnAppeal(1, true);
        // File on different tender
        await dispute.connect(appellant).fileAppeal(2, "Second", { value: ethers.parseEther("0.01") });
        expect(await dispute.appealCount()).to.equal(2);
    });

    it("Should allow filing on same tender after resolve clears active flag", async function () {
        const { dispute, panel1, panel2, appellant, appellant2 } = await loadFixture(deployFixture);
        await dispute.connect(appellant).fileAppeal(1, "First", { value: ethers.parseEther("0.01") });
        await dispute.connect(panel1).voteOnAppeal(1, true);
        await dispute.connect(panel2).voteOnAppeal(1, true);
        // Same tender, new appeal
        await dispute.connect(appellant2).fileAppeal(1, "Again", { value: ethers.parseEther("0.01") });
        expect(await dispute.appealCount()).to.equal(2);
    });
});

// ═══════════════════════════════════════════════════════════════
// Additional coverage tests for GovernanceController
// ═══════════════════════════════════════════════════════════════
describe("GovernanceController — Coverage Gaps", function () {
    async function deployFixture() {
        const [gov1, gov2, gov3, validator1, validator2, other] = await ethers.getSigners();
        const GovernanceController = await ethers.getContractFactory("GovernanceController");
        const governance = await GovernanceController.deploy([gov1.address, gov2.address, gov3.address]);
        return { governance, gov1, gov2, gov3, validator1, validator2, other };
    }

    it("Should revert constructor with zero address governor", async function () {
        const [gov1, gov2] = await ethers.getSigners();
        const F = await ethers.getContractFactory("GovernanceController");
        await expect(F.deploy([gov1.address, gov2.address, ethers.ZeroAddress])).to.be.revertedWith("Zero address");
    });

    it("Should revert createProposal with zero target address", async function () {
        const { governance, gov1 } = await loadFixture(deployFixture);
        await expect(governance.connect(gov1).createProposal(0, ethers.ZeroAddress)).to.be.revertedWith("Zero address");
    });

    it("Should revert ADD_VALIDATOR for already-validator", async function () {
        const { governance, gov1, gov2, validator1 } = await loadFixture(deployFixture);
        await governance.connect(gov1).createProposal(0, validator1.address);
        await governance.connect(gov1).vote(1, true);
        await governance.connect(gov2).vote(1, true);
        await expect(governance.connect(gov1).createProposal(0, validator1.address))
            .to.be.revertedWithCustomError(governance, "AlreadyValidator");
    });

    it("Should revert REMOVE_VALIDATOR for non-validator", async function () {
        const { governance, gov1, validator1 } = await loadFixture(deployFixture);
        await expect(governance.connect(gov1).createProposal(1, validator1.address))
            .to.be.revertedWithCustomError(governance, "NotValidator");
    });

    it("Should revert vote on invalid proposal ID (0)", async function () {
        const { governance, gov1 } = await loadFixture(deployFixture);
        await expect(governance.connect(gov1).vote(0, true))
            .to.be.revertedWithCustomError(governance, "InvalidProposal");
    });

    it("Should revert vote on invalid proposal ID (exceeding count)", async function () {
        const { governance, gov1 } = await loadFixture(deployFixture);
        await expect(governance.connect(gov1).vote(999, true))
            .to.be.revertedWithCustomError(governance, "InvalidProposal");
    });

    it("Should revert vote on non-PENDING proposal (EXECUTED)", async function () {
        const { governance, gov1, gov2, gov3, validator1 } = await loadFixture(deployFixture);
        await governance.connect(gov1).createProposal(0, validator1.address);
        await governance.connect(gov1).vote(1, true);
        await governance.connect(gov2).vote(1, true);
        await expect(governance.connect(gov3).vote(1, true))
            .to.be.revertedWithCustomError(governance, "ProposalNotPending");
    });

    it("Should emit ProposalCreated event", async function () {
        const { governance, gov1, validator1 } = await loadFixture(deployFixture);
        await expect(governance.connect(gov1).createProposal(0, validator1.address))
            .to.emit(governance, "ProposalCreated")
            .withArgs(1, 0, validator1.address, gov1.address);
    });

    it("Should emit ProposalVoted event", async function () {
        const { governance, gov1, validator1 } = await loadFixture(deployFixture);
        await governance.connect(gov1).createProposal(0, validator1.address);
        await expect(governance.connect(gov1).vote(1, true))
            .to.emit(governance, "ProposalVoted")
            .withArgs(1, gov1.address, true);
    });

    it("Should emit ProposalExecuted event", async function () {
        const { governance, gov1, gov2, validator1 } = await loadFixture(deployFixture);
        await governance.connect(gov1).createProposal(0, validator1.address);
        await governance.connect(gov1).vote(1, true);
        await expect(governance.connect(gov2).vote(1, true))
            .to.emit(governance, "ProposalExecuted")
            .withArgs(1);
    });

    it("Should emit ValidatorRemoved event", async function () {
        const { governance, gov1, gov2, validator1 } = await loadFixture(deployFixture);
        await governance.connect(gov1).createProposal(0, validator1.address);
        await governance.connect(gov1).vote(1, true);
        await governance.connect(gov2).vote(1, true);
        await governance.connect(gov1).createProposal(1, validator1.address);
        await governance.connect(gov1).vote(2, true);
        await expect(governance.connect(gov2).vote(2, true))
            .to.emit(governance, "ValidatorRemoved")
            .withArgs(validator1.address);
    });

    it("Should return validators list via getValidators()", async function () {
        const { governance, gov1, gov2, validator1, validator2 } = await loadFixture(deployFixture);
        await governance.connect(gov1).createProposal(0, validator1.address);
        await governance.connect(gov1).vote(1, true);
        await governance.connect(gov2).vote(1, true);
        await governance.connect(gov1).createProposal(0, validator2.address);
        await governance.connect(gov1).vote(2, true);
        await governance.connect(gov2).vote(2, true);
        const vals = await governance.getValidators();
        expect(vals).to.include(validator1.address);
        expect(vals).to.include(validator2.address);
        expect(vals.length).to.equal(2);
    });

    it("Should revert getProposal with invalid ID", async function () {
        const { governance } = await loadFixture(deployFixture);
        await expect(governance.getProposal(0)).to.be.revertedWith("Invalid proposal");
        await expect(governance.getProposal(999)).to.be.revertedWith("Invalid proposal");
    });

    it("Should handle rejection vote count correctly (auto-reject threshold)", async function () {
        const { governance, gov1, gov2, validator1 } = await loadFixture(deployFixture);
        await governance.connect(gov1).createProposal(0, validator1.address);
        await governance.connect(gov1).vote(1, false);
        await governance.connect(gov2).vote(1, false);
        const proposal = await governance.getProposal(1);
        expect(proposal.status).to.equal(2); // REJECTED
        expect(proposal.rejectionCount).to.equal(2);
    });

    it("Should not auto-reject with only 1 rejection (need >1)", async function () {
        const { governance, gov1, validator1 } = await loadFixture(deployFixture);
        await governance.connect(gov1).createProposal(0, validator1.address);
        await governance.connect(gov1).vote(1, false);
        const proposal = await governance.getProposal(1);
        expect(proposal.status).to.equal(0); // still PENDING
    });

    it("Should handle remove from middle of validators array", async function () {
        const { governance, gov1, gov2, validator1, validator2 } = await loadFixture(deployFixture);
        // Add v1 then v2
        await governance.connect(gov1).createProposal(0, validator1.address);
        await governance.connect(gov1).vote(1, true);
        await governance.connect(gov2).vote(1, true);
        await governance.connect(gov1).createProposal(0, validator2.address);
        await governance.connect(gov1).vote(2, true);
        await governance.connect(gov2).vote(2, true);
        // Remove v1 (first in array)
        await governance.connect(gov1).createProposal(1, validator1.address);
        await governance.connect(gov1).vote(3, true);
        await governance.connect(gov2).vote(3, true);
        const vals = await governance.getValidators();
        expect(vals.length).to.equal(1);
        expect(vals[0]).to.equal(validator2.address);
    });
});

// ═══════════════════════════════════════════════════════════════
// Additional coverage tests for PerformanceRegistry
// ═══════════════════════════════════════════════════════════════
describe("PerformanceRegistry — Coverage Gaps", function () {
    async function deployFixture() {
        const [admin, recorder, contractor1, contractor2, other] = await ethers.getSigners();
        const PerformanceRegistry = await ethers.getContractFactory("PerformanceRegistry");
        const perf = await PerformanceRegistry.deploy(admin.address);
        const RECORDER_ROLE = await perf.RECORDER_ROLE();
        await perf.grantRole(RECORDER_ROLE, recorder.address);
        return { perf, admin, recorder, contractor1, contractor2, other };
    }

    it("Should revert constructor with zero address", async function () {
        const F = await ethers.getContractFactory("PerformanceRegistry");
        await expect(F.deploy(ethers.ZeroAddress)).to.be.revertedWith("Zero address");
    });

    it("Should emit PerformanceRecorded with correct args", async function () {
        const { perf, recorder, contractor1 } = await loadFixture(deployFixture);
        await expect(perf.connect(recorder).recordPerformance(1, contractor1.address, 85, "Good"))
            .to.emit(perf, "PerformanceRecorded")
            .withArgs(1, 1, contractor1.address, 85, recorder.address);
    });

    it("Should return correct contractor record IDs", async function () {
        const { perf, recorder, contractor1 } = await loadFixture(deployFixture);
        await perf.connect(recorder).recordPerformance(1, contractor1.address, 80, "Ok");
        await perf.connect(recorder).recordPerformance(2, contractor1.address, 90, "Great");
        const ids = await perf.getContractorRecords(contractor1.address);
        expect(ids.length).to.equal(2);
        expect(ids[0]).to.equal(1);
        expect(ids[1]).to.equal(2);
    });

    it("Should return empty array for contractor with no records", async function () {
        const { perf, other } = await loadFixture(deployFixture);
        const ids = await perf.getContractorRecords(other.address);
        expect(ids.length).to.equal(0);
    });

    it("Should revert getRecord with invalid ID (0)", async function () {
        const { perf } = await loadFixture(deployFixture);
        await expect(perf.getRecord(0)).to.be.revertedWith("Invalid record");
    });

    it("Should revert getRecord with ID exceeding count", async function () {
        const { perf } = await loadFixture(deployFixture);
        await expect(perf.getRecord(999)).to.be.revertedWith("Invalid record");
    });

    it("Should record performance for multiple contractors on same tender", async function () {
        const { perf, recorder, contractor1, contractor2 } = await loadFixture(deployFixture);
        await perf.connect(recorder).recordPerformance(1, contractor1.address, 80, "Ok");
        await perf.connect(recorder).recordPerformance(1, contractor2.address, 90, "Great");
        expect(await perf.recordCount()).to.equal(2);
    });

    it("Should return recordId from recordPerformance", async function () {
        const { perf, recorder, contractor1 } = await loadFixture(deployFixture);
        // Check that recordCount increments
        await perf.connect(recorder).recordPerformance(1, contractor1.address, 85, "Good");
        expect(await perf.recordCount()).to.equal(1);
    });

    it("Should handle score boundary (1)", async function () {
        const { perf, recorder, contractor1 } = await loadFixture(deployFixture);
        await perf.connect(recorder).recordPerformance(1, contractor1.address, 1, "Min score");
        const record = await perf.getRecord(1);
        expect(record.score).to.equal(1);
    });

    it("Should handle score boundary (100)", async function () {
        const { perf, recorder, contractor1 } = await loadFixture(deployFixture);
        await perf.connect(recorder).recordPerformance(1, contractor1.address, 100, "Max score");
        const record = await perf.getRecord(1);
        expect(record.score).to.equal(100);
    });
});

// ═══════════════════════════════════════════════════════════════
// Additional coverage for TenderRegistry
// ═══════════════════════════════════════════════════════════════
describe("TenderRegistry — Coverage Gaps", function () {
    async function deployFixture() {
        const [admin, authority, contractor1, other] = await ethers.getSigners();
        const TenderRegistry = await ethers.getContractFactory("TenderRegistry");
        const registry = await TenderRegistry.deploy(admin.address);
        const AUTHORITY_ROLE = await registry.AUTHORITY_ROLE();
        const ADMIN_ROLE = await registry.ADMIN_ROLE();
        await registry.grantRole(AUTHORITY_ROLE, authority.address);
        const now = await time.latest();
        const submissionDeadline = now + 86400;
        const revealDeadline = now + 172800;
        return { registry, admin, authority, contractor1, other, AUTHORITY_ROLE, ADMIN_ROLE, submissionDeadline, revealDeadline };
    }

    it("Should set governance contract", async function () {
        const { registry, admin, other } = await loadFixture(deployFixture);
        await registry.connect(admin).setGovernanceContract(other.address);
        expect(await registry.governanceContract()).to.equal(other.address);
    });

    it("Should revert setGovernanceContract with zero address", async function () {
        const { registry, admin } = await loadFixture(deployFixture);
        await expect(registry.connect(admin).setGovernanceContract(ethers.ZeroAddress))
            .to.be.revertedWithCustomError(registry, "ZeroAddress");
    });

    it("Should revert setGovernanceContract from non-admin", async function () {
        const { registry, other } = await loadFixture(deployFixture);
        await expect(registry.connect(other).setGovernanceContract(other.address)).to.be.reverted;
    });

    it("Should emit TenderClosed event", async function () {
        const { registry, authority, submissionDeadline, revealDeadline } = await loadFixture(deployFixture);
        await registry.connect(authority).createTender("QmH", submissionDeadline, revealDeadline, "QmE", 1000, 100000);
        await registry.connect(authority).publishTender(1);
        await time.increaseTo(submissionDeadline + 1);
        await expect(registry.connect(authority).closeTender(1)).to.emit(registry, "TenderClosed").withArgs(1);
    });

    it("Should emit TenderMovedToEvaluation event", async function () {
        const { registry, authority, submissionDeadline, revealDeadline } = await loadFixture(deployFixture);
        await registry.connect(authority).createTender("QmH", submissionDeadline, revealDeadline, "QmE", 1000, 100000);
        await registry.connect(authority).publishTender(1);
        await time.increaseTo(submissionDeadline + 1);
        await registry.connect(authority).closeTender(1);
        await expect(registry.connect(authority).startEvaluation(1)).to.emit(registry, "TenderMovedToEvaluation").withArgs(1);
    });

    it("Should emit TenderCancelled event", async function () {
        const { registry, authority, submissionDeadline, revealDeadline } = await loadFixture(deployFixture);
        await registry.connect(authority).createTender("QmH", submissionDeadline, revealDeadline, "QmE", 1000, 100000);
        await expect(registry.connect(authority).cancelTender(1, "Budget cut"))
            .to.emit(registry, "TenderCancelled").withArgs(1, "Budget cut");
    });

    it("Should revert startEvaluation on non-CLOSED tender", async function () {
        const { registry, authority, submissionDeadline, revealDeadline } = await loadFixture(deployFixture);
        await registry.connect(authority).createTender("QmH", submissionDeadline, revealDeadline, "QmE", 1000, 100000);
        await registry.connect(authority).publishTender(1);
        await expect(registry.connect(authority).startEvaluation(1))
            .to.be.revertedWithCustomError(registry, "InvalidStatus");
    });

    it("Should revert awardTender on non-EVALUATION tender", async function () {
        const { registry, authority, contractor1, submissionDeadline, revealDeadline } = await loadFixture(deployFixture);
        await registry.connect(authority).createTender("QmH", submissionDeadline, revealDeadline, "QmE", 1000, 100000);
        await registry.connect(authority).publishTender(1);
        await expect(registry.connect(authority).awardTender(1, contractor1.address))
            .to.be.revertedWithCustomError(registry, "InvalidStatus");
    });

    it("Should cancel a CLOSED tender", async function () {
        const { registry, authority, submissionDeadline, revealDeadline } = await loadFixture(deployFixture);
        await registry.connect(authority).createTender("QmH", submissionDeadline, revealDeadline, "QmE", 1000, 100000);
        await registry.connect(authority).publishTender(1);
        await time.increaseTo(submissionDeadline + 1);
        await registry.connect(authority).closeTender(1);
        await registry.connect(authority).cancelTender(1, "Changed mind");
        expect((await registry.getTender(1)).status).to.equal(5);
    });

    it("Should cancel an EVALUATION tender", async function () {
        const { registry, authority, submissionDeadline, revealDeadline } = await loadFixture(deployFixture);
        await registry.connect(authority).createTender("QmH", submissionDeadline, revealDeadline, "QmE", 1000, 100000);
        await registry.connect(authority).publishTender(1);
        await time.increaseTo(submissionDeadline + 1);
        await registry.connect(authority).closeTender(1);
        await registry.connect(authority).startEvaluation(1);
        await registry.connect(authority).cancelTender(1, "Cancelled in eval");
        expect((await registry.getTender(1)).status).to.equal(5);
    });

    it("Should revert cancelling already-cancelled tender", async function () {
        const { registry, authority, submissionDeadline, revealDeadline } = await loadFixture(deployFixture);
        await registry.connect(authority).createTender("QmH", submissionDeadline, revealDeadline, "QmE", 1000, 100000);
        await registry.connect(authority).cancelTender(1, "First");
        await expect(registry.connect(authority).cancelTender(1, "Again"))
            .to.be.revertedWith("Cannot cancel awarded or already cancelled tender");
    });

    it("Should revert closeTender from non-authority", async function () {
        const { registry, authority, other, submissionDeadline, revealDeadline } = await loadFixture(deployFixture);
        await registry.connect(authority).createTender("QmH", submissionDeadline, revealDeadline, "QmE", 1000, 100000);
        await registry.connect(authority).publishTender(1);
        await time.increaseTo(submissionDeadline + 1);
        await expect(registry.connect(other).closeTender(1)).to.be.reverted;
    });

    it("Should revert closeTender on DRAFT tender (wrong status)", async function () {
        const { registry, authority, submissionDeadline, revealDeadline } = await loadFixture(deployFixture);
        await registry.connect(authority).createTender("QmH", submissionDeadline, revealDeadline, "QmE", 1000, 100000);
        await time.increaseTo(submissionDeadline + 1);
        // Tender is DRAFT, not PUBLISHED
        await expect(registry.connect(authority).closeTender(1))
            .to.be.revertedWithCustomError(registry, "InvalidStatus");
    });

    it("Should revert publishTender on non-existent tender", async function () {
        const { registry, authority } = await loadFixture(deployFixture);
        await expect(registry.connect(authority).publishTender(999))
            .to.be.revertedWithCustomError(registry, "TenderNotFound");
    });

    it("Should revert closeTender on non-existent tender", async function () {
        const { registry, authority } = await loadFixture(deployFixture);
        await expect(registry.connect(authority).closeTender(999))
            .to.be.revertedWithCustomError(registry, "TenderNotFound");
    });

    it("Should revert startEvaluation on non-existent tender", async function () {
        const { registry, authority } = await loadFixture(deployFixture);
        await expect(registry.connect(authority).startEvaluation(999))
            .to.be.revertedWithCustomError(registry, "TenderNotFound");
    });

    it("Should revert awardTender on non-existent tender", async function () {
        const { registry, authority, contractor1 } = await loadFixture(deployFixture);
        await expect(registry.connect(authority).awardTender(999, contractor1.address))
            .to.be.revertedWithCustomError(registry, "TenderNotFound");
    });

    it("Should revert cancelTender on non-existent tender", async function () {
        const { registry, authority } = await loadFixture(deployFixture);
        await expect(registry.connect(authority).cancelTender(999, "reason"))
            .to.be.revertedWithCustomError(registry, "TenderNotFound");
    });

    it("Should revert startEvaluation on DRAFT tender", async function () {
        const { registry, authority, submissionDeadline, revealDeadline } = await loadFixture(deployFixture);
        await registry.connect(authority).createTender("QmH", submissionDeadline, revealDeadline, "QmE", 1000, 100000);
        await expect(registry.connect(authority).startEvaluation(1))
            .to.be.revertedWithCustomError(registry, "InvalidStatus");
    });

    it("Should revert awardTender on DRAFT tender", async function () {
        const { registry, authority, contractor1, submissionDeadline, revealDeadline } = await loadFixture(deployFixture);
        await registry.connect(authority).createTender("QmH", submissionDeadline, revealDeadline, "QmE", 1000, 100000);
        await expect(registry.connect(authority).awardTender(1, contractor1.address))
            .to.be.revertedWithCustomError(registry, "InvalidStatus");
    });

    it("Should revert awardTender on CLOSED tender", async function () {
        const { registry, authority, contractor1, submissionDeadline, revealDeadline } = await loadFixture(deployFixture);
        await registry.connect(authority).createTender("QmH", submissionDeadline, revealDeadline, "QmE", 1000, 100000);
        await registry.connect(authority).publishTender(1);
        await time.increaseTo(submissionDeadline + 1);
        await registry.connect(authority).closeTender(1);
        await expect(registry.connect(authority).awardTender(1, contractor1.address))
            .to.be.revertedWithCustomError(registry, "InvalidStatus");
    });

    it("Should revert publishTender from non-authority", async function () {
        const { registry, authority, other, submissionDeadline, revealDeadline } = await loadFixture(deployFixture);
        await registry.connect(authority).createTender("QmH", submissionDeadline, revealDeadline, "QmE", 1000, 100000);
        await expect(registry.connect(other).publishTender(1)).to.be.reverted;
    });

    it("Should revert cancelTender from non-authority", async function () {
        const { registry, authority, other, submissionDeadline, revealDeadline } = await loadFixture(deployFixture);
        await registry.connect(authority).createTender("QmH", submissionDeadline, revealDeadline, "QmE", 1000, 100000);
        await expect(registry.connect(other).cancelTender(1, "reason")).to.be.reverted;
    });
});

// ═══════════════════════════════════════════════════════════════
// Additional coverage for BidManager
// ═══════════════════════════════════════════════════════════════
describe("BidManager — Coverage Gaps", function () {
    async function deployFixture() {
        const [admin, authority, bidder1, evaluator, other] = await ethers.getSigners();
        const TenderRegistry = await ethers.getContractFactory("TenderRegistry");
        const registry = await TenderRegistry.deploy(admin.address);
        const BidManager = await ethers.getContractFactory("BidManager");
        const bidManager = await BidManager.deploy(await registry.getAddress(), admin.address);
        const AUTHORITY_ROLE = await registry.AUTHORITY_ROLE();
        await registry.grantRole(AUTHORITY_ROLE, authority.address);
        const EVALUATOR_ROLE = await bidManager.EVALUATOR_ROLE();
        await bidManager.grantRole(EVALUATOR_ROLE, evaluator.address);
        const now = await time.latest();
        const submissionDeadline = now + 86400;
        const revealDeadline = now + 172800;
        return { registry, bidManager, admin, authority, bidder1, evaluator, other, submissionDeadline, revealDeadline };
    }

    it("Should revert constructor with zero tender registry address", async function () {
        const [admin] = await ethers.getSigners();
        const F = await ethers.getContractFactory("BidManager");
        await expect(F.deploy(ethers.ZeroAddress, admin.address)).to.be.revertedWith("Zero address");
    });

    it("Should revert constructor with zero admin address", async function () {
        const [admin] = await ethers.getSigners();
        const F = await ethers.getContractFactory("BidManager");
        await expect(F.deploy(admin.address, ethers.ZeroAddress)).to.be.revertedWith("Zero address");
    });

    it("Should revert submitCommitment on DRAFT tender (not published)", async function () {
        const { registry, bidManager, authority, bidder1, submissionDeadline, revealDeadline } = await loadFixture(deployFixture);
        await registry.connect(authority).createTender("QmH", submissionDeadline, revealDeadline, "QmE", 1000, 100000);
        // Don't publish — tender stays DRAFT
        const commitment = ethers.keccak256(ethers.toUtf8Bytes("test"));
        await expect(bidManager.connect(bidder1).submitCommitment(1, commitment))
            .to.be.revertedWithCustomError(bidManager, "TenderNotPublished");
    });

    it("Should revert forfeitBid before reveal deadline", async function () {
        const { registry, bidManager, authority, bidder1, evaluator, submissionDeadline, revealDeadline } = await loadFixture(deployFixture);
        await registry.connect(authority).createTender("QmH", submissionDeadline, revealDeadline, "QmE", 1000, 100000);
        await registry.connect(authority).publishTender(1);
        const commitment = ethers.keccak256(ethers.solidityPacked(["address", "uint256", "bytes32", "bytes32"], [bidder1.address, 1, ethers.ZeroHash, ethers.ZeroHash]));
        await bidManager.connect(bidder1).submitCommitment(1, commitment);
        await expect(bidManager.connect(evaluator).forfeitBid(1, bidder1.address))
            .to.be.revertedWith("Reveal deadline not passed");
    });

    it("Should revert forfeitBid for already-revealed bid", async function () {
        const { registry, bidManager, authority, bidder1, evaluator, submissionDeadline, revealDeadline } = await loadFixture(deployFixture);
        await registry.connect(authority).createTender("QmH", submissionDeadline, revealDeadline, "QmE", 1000, 100000);
        await registry.connect(authority).publishTender(1);
        const salt = ethers.hexlify(ethers.randomBytes(32));
        const payload = ethers.keccak256(ethers.toUtf8Bytes("bid"));
        const commitment = ethers.keccak256(ethers.solidityPacked(["address", "uint256", "bytes32", "bytes32"], [bidder1.address, 1, payload, salt]));
        await bidManager.connect(bidder1).submitCommitment(1, commitment);
        await time.increaseTo(submissionDeadline + 1);
        await bidManager.connect(bidder1).revealBid(1, 5000, payload, salt);
        await time.increaseTo(revealDeadline + 1);
        await expect(bidManager.connect(evaluator).forfeitBid(1, bidder1.address))
            .to.be.revertedWith("Already revealed");
    });

    it("Should revert forfeitBid for non-existent commitment", async function () {
        const { registry, bidManager, authority, other, evaluator, submissionDeadline, revealDeadline } = await loadFixture(deployFixture);
        await registry.connect(authority).createTender("QmH", submissionDeadline, revealDeadline, "QmE", 1000, 100000);
        await registry.connect(authority).publishTender(1);
        await time.increaseTo(revealDeadline + 1);
        await expect(bidManager.connect(evaluator).forfeitBid(1, other.address))
            .to.be.revertedWith("No commitment");
    });

    it("Should revert forfeitBid from non-evaluator", async function () {
        const { bidManager, other } = await loadFixture(deployFixture);
        await expect(bidManager.connect(other).forfeitBid(1, other.address)).to.be.reverted;
    });
});

// ═══════════════════════════════════════════════════════════════
// Additional coverage for AuditLog
// ═══════════════════════════════════════════════════════════════
describe("AuditLog — Coverage Gaps", function () {
    async function deployFixture() {
        const [admin, logger, other] = await ethers.getSigners();
        const AuditLog = await ethers.getContractFactory("AuditLog");
        const auditLog = await AuditLog.deploy(admin.address);
        const LOGGER_ROLE = await auditLog.LOGGER_ROLE();
        await auditLog.grantRole(LOGGER_ROLE, logger.address);
        return { auditLog, admin, logger, other };
    }

    it("Should revert constructor with zero address", async function () {
        const F = await ethers.getContractFactory("AuditLog");
        await expect(F.deploy(ethers.ZeroAddress)).to.be.revertedWith("Zero address");
    });

    it("Should revert getLogs with from=0", async function () {
        const { auditLog, logger } = await loadFixture(deployFixture);
        await auditLog.connect(logger).recordLog(logger.address, 0, 1, ethers.ZeroHash);
        await expect(auditLog.getLogs(0, 1)).to.be.revertedWith("Invalid range");
    });

    it("Should revert getLogs with from > to", async function () {
        const { auditLog, logger } = await loadFixture(deployFixture);
        await auditLog.connect(logger).recordLog(logger.address, 0, 1, ethers.ZeroHash);
        await auditLog.connect(logger).recordLog(logger.address, 1, 2, ethers.ZeroHash);
        await expect(auditLog.getLogs(3, 2)).to.be.revertedWith("Invalid range");
    });

    it("Should return correct logId from recordLog", async function () {
        const { auditLog, logger } = await loadFixture(deployFixture);
        await auditLog.connect(logger).recordLog(logger.address, 0, 1, ethers.ZeroHash);
        expect(await auditLog.getLogCount()).to.equal(1);
        await auditLog.connect(logger).recordLog(logger.address, 1, 2, ethers.ZeroHash);
        expect(await auditLog.getLogCount()).to.equal(2);
    });

    it("Should getLog with valid boundary ID", async function () {
        const { auditLog, logger } = await loadFixture(deployFixture);
        await auditLog.connect(logger).recordLog(logger.address, 0, 1, ethers.ZeroHash);
        const entry = await auditLog.getLog(1);
        expect(entry.logId).to.equal(1);
    });

    it("Should revert getLog with 0", async function () {
        const { auditLog } = await loadFixture(deployFixture);
        await expect(auditLog.getLog(0)).to.be.revertedWith("Invalid log ID");
    });

    it("Should getLogs single range", async function () {
        const { auditLog, logger } = await loadFixture(deployFixture);
        await auditLog.connect(logger).recordLog(logger.address, 0, 1, ethers.ZeroHash);
        const logs = await auditLog.getLogs(1, 1);
        expect(logs.length).to.equal(1);
    });
});
