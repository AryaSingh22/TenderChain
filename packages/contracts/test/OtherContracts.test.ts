import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("AuditLog", function () {
    async function deployFixture() {
        const [admin, logger, other] = await ethers.getSigners();
        const AuditLog = await ethers.getContractFactory("AuditLog");
        const auditLog = await AuditLog.deploy(admin.address);
        const LOGGER_ROLE = await auditLog.LOGGER_ROLE();
        await auditLog.grantRole(LOGGER_ROLE, logger.address);
        return { auditLog, admin, logger, other, LOGGER_ROLE };
    }

    describe("recordLog", function () {
        it("Should record a log entry", async function () {
            const { auditLog, logger } = await loadFixture(deployFixture);
            await auditLog.connect(logger).recordLog(
                logger.address, 0, 1, ethers.keccak256(ethers.toUtf8Bytes("data"))
            );
            expect(await auditLog.logCount()).to.equal(1);
        });

        it("Should emit LogRecorded event", async function () {
            const { auditLog, logger } = await loadFixture(deployFixture);
            await expect(auditLog.connect(logger).recordLog(
                logger.address, 0, 1, ethers.keccak256(ethers.toUtf8Bytes("data"))
            )).to.emit(auditLog, "LogRecorded");
        });

        it("Should store correct data in log entry", async function () {
            const { auditLog, logger } = await loadFixture(deployFixture);
            const dataHash = ethers.keccak256(ethers.toUtf8Bytes("tender doc"));
            await auditLog.connect(logger).recordLog(logger.address, 1, 42, dataHash);
            const entry = await auditLog.getLog(1);
            expect(entry.actor).to.equal(logger.address);
            expect(entry.actionType).to.equal(1); // TENDER_PUBLISHED
            expect(entry.relatedEntityId).to.equal(42);
            expect(entry.dataHash).to.equal(dataHash);
        });

        it("Should revert for unauthorized caller", async function () {
            const { auditLog, other } = await loadFixture(deployFixture);
            await expect(auditLog.connect(other).recordLog(
                other.address, 0, 1, ethers.ZeroHash
            )).to.be.reverted;
        });

        it("Should revert on invalid log ID", async function () {
            const { auditLog } = await loadFixture(deployFixture);
            await expect(auditLog.getLog(999)).to.be.revertedWith("Invalid log ID");
        });
    });

    describe("getLogs (pagination)", function () {
        it("Should return paginated logs", async function () {
            const { auditLog, logger } = await loadFixture(deployFixture);
            for (let i = 0; i < 5; i++) {
                await auditLog.connect(logger).recordLog(logger.address, i % 3, i + 1, ethers.ZeroHash);
            }
            const page = await auditLog.getLogs(2, 4);
            expect(page.length).to.equal(3);
            expect(page[0].logId).to.equal(2);
            expect(page[2].logId).to.equal(4);
        });

        it("Should revert on invalid range", async function () {
            const { auditLog } = await loadFixture(deployFixture);
            await expect(auditLog.getLogs(1, 5)).to.be.revertedWith("Invalid range");
        });
    });

    describe("All ActionTypes", function () {
        it("Should accept all defined action types", async function () {
            const { auditLog, logger } = await loadFixture(deployFixture);
            for (let i = 0; i <= 14; i++) {
                await auditLog.connect(logger).recordLog(logger.address, i, 1, ethers.ZeroHash);
            }
            expect(await auditLog.logCount()).to.equal(15);
        });
    });
});

describe("GovernanceController", function () {
    async function deployFixture() {
        const [gov1, gov2, gov3, validator1, other] = await ethers.getSigners();
        const GovernanceController = await ethers.getContractFactory("GovernanceController");
        const governance = await GovernanceController.deploy([gov1.address, gov2.address, gov3.address]);
        return { governance, gov1, gov2, gov3, validator1, other };
    }

    describe("Proposal creation", function () {
        it("Should create an ADD_VALIDATOR proposal", async function () {
            const { governance, gov1, validator1 } = await loadFixture(deployFixture);
            await governance.connect(gov1).createProposal(0, validator1.address); // ADD_VALIDATOR
            const proposal = await governance.getProposal(1);
            expect(proposal.targetValidator).to.equal(validator1.address);
            expect(proposal.status).to.equal(0); // PENDING
        });

        it("Should revert for non-governors", async function () {
            const { governance, other, validator1 } = await loadFixture(deployFixture);
            await expect(governance.connect(other).createProposal(0, validator1.address)).to.be.reverted;
        });
    });

    describe("Voting", function () {
        it("Should auto-execute on 2 approvals", async function () {
            const { governance, gov1, gov2, validator1 } = await loadFixture(deployFixture);
            await governance.connect(gov1).createProposal(0, validator1.address);
            await governance.connect(gov1).vote(1, true);
            await governance.connect(gov2).vote(1, true);
            expect(await governance.isValidator(validator1.address)).to.be.true;
            const proposal = await governance.getProposal(1);
            expect(proposal.status).to.equal(3); // EXECUTED
        });

        it("Should reject on 2 rejections", async function () {
            const { governance, gov1, gov2, validator1 } = await loadFixture(deployFixture);
            await governance.connect(gov1).createProposal(0, validator1.address);
            await governance.connect(gov1).vote(1, false);
            await governance.connect(gov2).vote(1, false);
            const proposal = await governance.getProposal(1);
            expect(proposal.status).to.equal(2); // REJECTED
        });

        it("Should revert on double vote", async function () {
            const { governance, gov1, validator1 } = await loadFixture(deployFixture);
            await governance.connect(gov1).createProposal(0, validator1.address);
            await governance.connect(gov1).vote(1, true);
            await expect(governance.connect(gov1).vote(1, true))
                .to.be.revertedWithCustomError(governance, "AlreadyVoted");
        });

        it("Should emit ValidatorAdded on approval", async function () {
            const { governance, gov1, gov2, validator1 } = await loadFixture(deployFixture);
            await governance.connect(gov1).createProposal(0, validator1.address);
            await governance.connect(gov1).vote(1, true);
            await expect(governance.connect(gov2).vote(1, true))
                .to.emit(governance, "ValidatorAdded").withArgs(validator1.address);
        });
    });

    describe("Validator removal", function () {
        it("Should remove a validator via proposal", async function () {
            const { governance, gov1, gov2, validator1 } = await loadFixture(deployFixture);
            // First add
            await governance.connect(gov1).createProposal(0, validator1.address);
            await governance.connect(gov1).vote(1, true);
            await governance.connect(gov2).vote(1, true);
            expect(await governance.isValidator(validator1.address)).to.be.true;

            // Then remove
            await governance.connect(gov1).createProposal(1, validator1.address); // REMOVE_VALIDATOR
            await governance.connect(gov1).vote(2, true);
            await governance.connect(gov2).vote(2, true);
            expect(await governance.isValidator(validator1.address)).to.be.false;
        });
    });
});

describe("DisputeResolution", function () {
    async function deployFixture() {
        const [admin, panel1, panel2, panel3, appellant, treasury] = await ethers.getSigners();
        const DisputeResolution = await ethers.getContractFactory("DisputeResolution");
        const dispute = await DisputeResolution.deploy(admin.address, treasury.address);
        const PANEL_ROLE = await dispute.PANEL_MEMBER_ROLE();
        await dispute.grantRole(PANEL_ROLE, panel1.address);
        await dispute.grantRole(PANEL_ROLE, panel2.address);
        await dispute.grantRole(PANEL_ROLE, panel3.address);
        return { dispute, admin, panel1, panel2, panel3, appellant, treasury };
    }

    describe("Filing appeals", function () {
        it("Should file an appeal with bond", async function () {
            const { dispute, appellant } = await loadFixture(deployFixture);
            await dispute.connect(appellant).fileAppeal(1, "Unfair award", { value: ethers.parseEther("0.01") });
            const appeal = await dispute.getAppeal(1);
            expect(appeal.appellant).to.equal(appellant.address);
            expect(appeal.status).to.equal(0); // FILED
        });

        it("Should revert on insufficient bond", async function () {
            const { dispute, appellant } = await loadFixture(deployFixture);
            await expect(dispute.connect(appellant).fileAppeal(1, "Test", { value: ethers.parseEther("0.001") }))
                .to.be.revertedWithCustomError(dispute, "InsufficientBond");
        });

        it("Should revert on duplicate appeal for same tender", async function () {
            const { dispute, appellant } = await loadFixture(deployFixture);
            await dispute.connect(appellant).fileAppeal(1, "First", { value: ethers.parseEther("0.01") });
            await expect(dispute.connect(appellant).fileAppeal(1, "Second", { value: ethers.parseEther("0.01") }))
                .to.be.revertedWithCustomError(dispute, "AppealAlreadyExists");
        });
    });

    describe("Voting on appeals", function () {
        it("Should approve appeal and return bond", async function () {
            const { dispute, panel1, panel2, appellant } = await loadFixture(deployFixture);
            await dispute.connect(appellant).fileAppeal(1, "Unfair", { value: ethers.parseEther("0.01") });
            const balBefore = await ethers.provider.getBalance(appellant.address);
            await dispute.connect(panel1).voteOnAppeal(1, true);
            await dispute.connect(panel2).voteOnAppeal(1, true);
            const balAfter = await ethers.provider.getBalance(appellant.address);
            expect(balAfter).to.be.gt(balBefore);
            expect((await dispute.getAppeal(1)).status).to.equal(2); // APPROVED
        });

        it("Should reject appeal and forfeit bond", async function () {
            const { dispute, panel1, panel2, appellant, treasury } = await loadFixture(deployFixture);
            await dispute.connect(appellant).fileAppeal(1, "Unfair", { value: ethers.parseEther("0.01") });
            const treasuryBefore = await ethers.provider.getBalance(treasury.address);
            await dispute.connect(panel1).voteOnAppeal(1, false);
            await dispute.connect(panel2).voteOnAppeal(1, false);
            const treasuryAfter = await ethers.provider.getBalance(treasury.address);
            expect(treasuryAfter).to.be.gt(treasuryBefore);
            expect((await dispute.getAppeal(1)).status).to.equal(3); // REJECTED
        });

        it("Should prevent double voting", async function () {
            const { dispute, panel1, appellant } = await loadFixture(deployFixture);
            await dispute.connect(appellant).fileAppeal(1, "Unfair", { value: ethers.parseEther("0.01") });
            await dispute.connect(panel1).voteOnAppeal(1, true);
            await expect(dispute.connect(panel1).voteOnAppeal(1, true))
                .to.be.revertedWithCustomError(dispute, "AlreadyVoted");
        });
    });
});

describe("PerformanceRegistry", function () {
    async function deployFixture() {
        const [admin, recorder, contractor1, contractor2, other] = await ethers.getSigners();
        const PerformanceRegistry = await ethers.getContractFactory("PerformanceRegistry");
        const perf = await PerformanceRegistry.deploy(admin.address);
        const RECORDER_ROLE = await perf.RECORDER_ROLE();
        await perf.grantRole(RECORDER_ROLE, recorder.address);
        return { perf, admin, recorder, contractor1, contractor2, other };
    }

    describe("recordPerformance", function () {
        it("Should record a performance score", async function () {
            const { perf, recorder, contractor1 } = await loadFixture(deployFixture);
            await perf.connect(recorder).recordPerformance(1, contractor1.address, 85, "Good work");
            const record = await perf.getRecord(1);
            expect(record.score).to.equal(85);
            expect(record.contractor).to.equal(contractor1.address);
        });

        it("Should revert on invalid score (0)", async function () {
            const { perf, recorder, contractor1 } = await loadFixture(deployFixture);
            await expect(perf.connect(recorder).recordPerformance(1, contractor1.address, 0, "Bad"))
                .to.be.revertedWithCustomError(perf, "InvalidScore");
        });

        it("Should revert on score > 100", async function () {
            const { perf, recorder, contractor1 } = await loadFixture(deployFixture);
            await expect(perf.connect(recorder).recordPerformance(1, contractor1.address, 101, "Too high"))
                .to.be.revertedWithCustomError(perf, "InvalidScore");
        });

        it("Should revert on duplicate record for same tender+contractor", async function () {
            const { perf, recorder, contractor1 } = await loadFixture(deployFixture);
            await perf.connect(recorder).recordPerformance(1, contractor1.address, 85, "Good");
            await expect(perf.connect(recorder).recordPerformance(1, contractor1.address, 90, "Better"))
                .to.be.revertedWithCustomError(perf, "RecordAlreadyExists");
        });

        it("Should revert for zero address contractor", async function () {
            const { perf, recorder } = await loadFixture(deployFixture);
            await expect(perf.connect(recorder).recordPerformance(1, ethers.ZeroAddress, 85, "No one"))
                .to.be.revertedWithCustomError(perf, "ZeroAddress");
        });

        it("Should reject unauthorized callers", async function () {
            const { perf, other, contractor1 } = await loadFixture(deployFixture);
            await expect(perf.connect(other).recordPerformance(1, contractor1.address, 85, "Nope"))
                .to.be.reverted;
        });
    });

    describe("Average score", function () {
        it("Should calculate average score across multiple tenders", async function () {
            const { perf, recorder, contractor1 } = await loadFixture(deployFixture);
            await perf.connect(recorder).recordPerformance(1, contractor1.address, 80, "Good");
            await perf.connect(recorder).recordPerformance(2, contractor1.address, 90, "Great");
            await perf.connect(recorder).recordPerformance(3, contractor1.address, 70, "OK");
            expect(await perf.getAverageScore(contractor1.address)).to.equal(80);
        });

        it("Should return 0 for contractor with no records", async function () {
            const { perf, contractor1 } = await loadFixture(deployFixture);
            expect(await perf.getAverageScore(contractor1.address)).to.equal(0);
        });
    });
});
