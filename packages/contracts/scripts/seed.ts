// ═══════════════════════════════════════════════════════════════
// TenderChain Seed Script — Full End-to-End Lifecycle
// ═══════════════════════════════════════════════════════════════

import { ethers } from "hardhat";

async function main() {
    const steps: { step: number; name: string; status: string }[] = [];
    function pass(step: number, name: string) {
        steps.push({ step, name, status: "✅ PASS" });
        console.log(`  Step ${step}: ✅ ${name}`);
    }
    function fail(step: number, name: string, err: string) {
        steps.push({ step, name, status: "❌ FAIL" });
        console.log(`  Step ${step}: ❌ ${name} — ${err}`);
    }

    console.log("\n═══ TenderChain Seed Script ═══\n");

    const [admin, authority, contractor1, contractor2, panel1, panel2, recorder, treasury] = await ethers.getSigners();

    // Step 1: Deploy all contracts
    try {
        console.log("  Deploying contracts...");
        var registry = await (await ethers.getContractFactory("TenderRegistry")).deploy(admin.address);
        var bidManager = await (await ethers.getContractFactory("BidManager")).deploy(await registry.getAddress(), admin.address);
        var auditLog = await (await ethers.getContractFactory("AuditLog")).deploy(admin.address);
        var dispute = await (await ethers.getContractFactory("DisputeResolution")).deploy(admin.address, treasury.address);
        var governance = await (await ethers.getContractFactory("GovernanceController")).deploy([admin.address, authority.address, panel1.address]);
        var perf = await (await ethers.getContractFactory("PerformanceRegistry")).deploy(admin.address);
        pass(1, "Deploy all 6 contracts");
    } catch (e: any) {
        fail(1, "Deploy contracts", e.message);
        process.exit(1);
    }

    // Step 2: Grant roles
    try {
        await registry.grantRole(await registry.AUTHORITY_ROLE(), authority.address);
        await bidManager.grantRole(await bidManager.EVALUATOR_ROLE(), authority.address);
        await auditLog.grantRole(await auditLog.LOGGER_ROLE(), admin.address);
        await dispute.grantRole(await dispute.PANEL_MEMBER_ROLE(), panel1.address);
        await dispute.grantRole(await dispute.PANEL_MEMBER_ROLE(), panel2.address);
        await perf.grantRole(await perf.RECORDER_ROLE(), recorder.address);
        pass(2, "Register contractors and grant roles");
    } catch (e: any) {
        fail(2, "Grant roles", e.message);
    }

    // Step 3: Create tender
    const now = (await ethers.provider.getBlock("latest"))!.timestamp;
    const subDeadline = now + 60;
    const revDeadline = now + 120;
    try {
        await registry.connect(authority).createTender(
            "QmTenderDoc123", subDeadline, revDeadline, "QmEligibility456", 1000, 500000
        );
        await auditLog.recordLog(authority.address, 0, 1, ethers.ZeroHash); // TENDER_CREATED
        pass(3, "Create tender #1");
    } catch (e: any) {
        fail(3, "Create tender", e.message);
    }

    // Step 4: Publish tender
    try {
        await registry.connect(authority).publishTender(1);
        await auditLog.recordLog(authority.address, 1, 1, ethers.ZeroHash); // TENDER_PUBLISHED
        pass(4, "Publish tender #1");
    } catch (e: any) {
        fail(4, "Publish tender", e.message);
    }

    // Step 5: Submit bids from contractor1 and contractor2
    const salt1 = ethers.hexlify(ethers.randomBytes(32));
    const payload1 = ethers.keccak256(ethers.toUtf8Bytes('{"amount":50000}'));
    const commit1 = ethers.keccak256(
        ethers.solidityPacked(["address", "uint256", "bytes32", "bytes32"], [contractor1.address, 1, payload1, salt1])
    );

    const salt2 = ethers.hexlify(ethers.randomBytes(32));
    const payload2 = ethers.keccak256(ethers.toUtf8Bytes('{"amount":45000}'));
    const commit2 = ethers.keccak256(
        ethers.solidityPacked(["address", "uint256", "bytes32", "bytes32"], [contractor2.address, 1, payload2, salt2])
    );

    try {
        await bidManager.connect(contractor1).submitCommitment(1, commit1);
        await auditLog.recordLog(contractor1.address, 3, 1, ethers.ZeroHash); // BID_COMMITTED
        await bidManager.connect(contractor2).submitCommitment(1, commit2);
        await auditLog.recordLog(contractor2.address, 3, 1, ethers.ZeroHash); // BID_COMMITTED
        pass(5, "Submit sealed bids (2 contractors)");
    } catch (e: any) {
        fail(5, "Submit bids", e.message);
    }

    // Step 6: Advance time past submission deadline
    try {
        await ethers.provider.send("evm_increaseTime", [70]);
        await ethers.provider.send("evm_mine", []);
        pass(6, "Advance time past submission deadline");
    } catch (e: any) {
        fail(6, "Advance time", e.message);
    }

    // Step 7: Reveal bids
    try {
        await bidManager.connect(contractor1).revealBid(1, 50000, payload1, salt1);
        await auditLog.recordLog(contractor1.address, 4, 1, ethers.ZeroHash); // BID_REVEALED
        await bidManager.connect(contractor2).revealBid(1, 45000, payload2, salt2);
        await auditLog.recordLog(contractor2.address, 4, 1, ethers.ZeroHash); // BID_REVEALED
        pass(7, "Reveal bids (2 contractors)");
    } catch (e: any) {
        fail(7, "Reveal bids", e.message);
    }

    // Step 8: Advance past reveal deadline and close tender
    try {
        await ethers.provider.send("evm_increaseTime", [120]);
        await ethers.provider.send("evm_mine", []);
        await registry.connect(authority).closeTender(1);
        pass(8, "Close tender after reveal deadline");
    } catch (e: any) {
        fail(8, "Close tender", e.message);
    }

    // Step 9: Evaluate and award
    try {
        await registry.connect(authority).startEvaluation(1);
        await auditLog.recordLog(authority.address, 6, 1, ethers.ZeroHash); // EVALUATION_STARTED
        await registry.connect(authority).awardTender(1, contractor2.address);
        await auditLog.recordLog(authority.address, 8, 1, ethers.ZeroHash); // TENDER_AWARDED
        const tender = await registry.getTender(1);
        if (tender.awardedTo !== contractor2.address) throw new Error("Wrong winner");
        pass(9, "Award tender to contractor2 (lowest bid)");
    } catch (e: any) {
        fail(9, "Award tender", e.message);
    }

    // Step 10: Record performance
    try {
        await perf.connect(recorder).recordPerformance(1, contractor2.address, 92, "Excellent work on highway project");
        await auditLog.recordLog(recorder.address, 12, 1, ethers.ZeroHash); // PERFORMANCE_RECORDED
        const avg = await perf.getAverageScore(contractor2.address);
        if (Number(avg) !== 92) throw new Error(`Expected avg=92, got ${avg}`);
        pass(10, "Record performance score (92/100)");
    } catch (e: any) {
        fail(10, "Record performance", e.message);
    }

    // Step 11: Verify audit log
    try {
        const count = await auditLog.getLogCount();
        if (Number(count) < 8) throw new Error(`Only ${count} log entries`);
        pass(11, `Verify audit log (${count} entries)`);
    } catch (e: any) {
        fail(11, "Verify audit log", e.message);
    }

    // Step 12: Governance — add validator
    try {
        await governance.connect(admin).createProposal(0, contractor1.address); // ADD_VALIDATOR
        await governance.connect(admin).vote(1, true);
        await governance.connect(authority).vote(1, true);
        const validators = await governance.getValidators();
        if (!validators.includes(contractor1.address)) throw new Error("Not added");
        pass(12, "Add validator via governance");
    } catch (e: any) {
        fail(12, "Governance", e.message);
    }

    // Summary
    const passed = steps.filter(s => s.status.includes("PASS")).length;
    console.log(`\n${"═".repeat(50)}`);
    console.log(`  SEED RESULT: ${passed} / ${steps.length} steps passed`);
    console.log(`${"═".repeat(50)}\n`);

    if (passed < steps.length) process.exit(1);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
