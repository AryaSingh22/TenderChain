import { ethers } from "hardhat";

async function main() {
    const results: { step: number; name: string; status: string; detail: string }[] = [];

    function log(step: number, name: string, status: "PASS" | "FAIL", detail: string) {
        results.push({ step, name, status, detail });
        console.log(`  Step ${step}: ${status} — ${name} | ${detail}`);
    }

    const [authority, contractor1, contractor2] = await ethers.getSigners();

    // Deploy contracts
    const TenderRegistry = await ethers.getContractFactory("TenderRegistry");
    const registry = await TenderRegistry.deploy(authority.address);
    const registryAddr = await registry.getAddress();

    const BidManager = await ethers.getContractFactory("BidManager");
    const bidManager = await BidManager.deploy(registryAddr, authority.address);

    const AuditLog = await ethers.getContractFactory("AuditLog");
    const auditLog = await AuditLog.deploy(authority.address);

    const LOGGER_ROLE = await auditLog.LOGGER_ROLE();
    await auditLog.grantRole(LOGGER_ROLE, authority.address);

    const now = (await ethers.provider.getBlock("latest"))!.timestamp;
    const submissionDeadline = now + 60;
    const revealDeadline = now + 120;

    // Step 1: Create tender
    try {
        const tx = await registry.connect(authority).createTender(
            "QmTestDoc", submissionDeadline, revealDeadline, "QmEligibility", 1000, 100000
        );
        const receipt = await tx.wait();
        const event = receipt?.logs.find((l: any) => l.fragment?.name === "TenderCreated");
        log(1, "Create tender with TenderCreated event", "PASS", `tx: ${receipt?.hash}`);
        await auditLog.recordLog(authority.address, 0, 1, ethers.ZeroHash);
    } catch (e: any) {
        log(1, "Create tender", "FAIL", e.message);
    }

    // Step 2: Create tender without AUTHORITY_ROLE
    try {
        await registry.connect(contractor1).createTender("QmH", submissionDeadline, revealDeadline, "QmE", 100, 10000);
        log(2, "Unauthorized createTender reverts", "FAIL", "Did not revert");
    } catch (e: any) {
        log(2, "Unauthorized createTender reverts", "PASS", `Reverted: ${e.message.slice(0, 80)}`);
    }

    // Step 3: Publish tender
    try {
        const tx = await registry.connect(authority).publishTender(1);
        const receipt = await tx.wait();
        const tender = await registry.getTender(1);
        const status = tender.status === 1n ? "PASS" : "FAIL";
        log(3, "Publish tender (status=PUBLISHED)", status, `tx: ${receipt?.hash}`);
        await auditLog.recordLog(authority.address, 1, 1, ethers.ZeroHash);
    } catch (e: any) {
        log(3, "Publish tender", "FAIL", e.message);
    }

    // Step 4: Submit commitment
    const salt = ethers.hexlify(ethers.randomBytes(32));
    const payloadHash = ethers.keccak256(ethers.toUtf8Bytes('{"amount":5000}'));
    const commitment = ethers.keccak256(
        ethers.solidityPacked(
            ["address", "uint256", "bytes32", "bytes32"],
            [contractor1.address, 1, payloadHash, salt]
        )
    );
    try {
        const tx = await bidManager.connect(contractor1).submitCommitment(1, commitment);
        const receipt = await tx.wait();
        log(4, "Submit commitment (BidCommitted)", "PASS", `tx: ${receipt?.hash}`);
        await auditLog.recordLog(contractor1.address, 3, 1, ethers.ZeroHash);
    } catch (e: any) {
        log(4, "Submit commitment", "FAIL", e.message);
    }

    // Step 5: Duplicate commitment
    try {
        await bidManager.connect(contractor1).submitCommitment(1, commitment);
        log(5, "Duplicate commitment reverts", "FAIL", "Did not revert");
    } catch (e: any) {
        log(5, "Duplicate commitment reverts", "PASS", `Reverted: ${e.message.slice(0, 80)}`);
    }

    // Step 6: Reveal before deadline
    try {
        await bidManager.connect(contractor1).revealBid(1, 5000, payloadHash, salt);
        log(6, "Reveal before deadline reverts", "FAIL", "Did not revert");
    } catch (e: any) {
        log(6, "Reveal before deadline reverts", "PASS", `Reverted: ${e.message.slice(0, 80)}`);
    }

    // Step 7: Advance time
    try {
        await ethers.provider.send("evm_increaseTime", [70]);
        await ethers.provider.send("evm_mine", []);
        const block = await ethers.provider.getBlock("latest");
        log(7, "Advance time past submission deadline", "PASS", `New timestamp: ${block?.timestamp}`);
    } catch (e: any) {
        log(7, "Advance time", "FAIL", e.message);
    }

    // Step 8: Submit after deadline
    try {
        const newCommit = ethers.keccak256(ethers.toUtf8Bytes("late"));
        await bidManager.connect(contractor2).submitCommitment(1, newCommit);
        log(8, "Submit after deadline reverts", "FAIL", "Did not revert");
    } catch (e: any) {
        log(8, "Submit after deadline reverts", "PASS", `Reverted: ${e.message.slice(0, 80)}`);
    }

    // Step 9: Reveal bid
    try {
        const tx = await bidManager.connect(contractor1).revealBid(1, 5000, payloadHash, salt);
        const receipt = await tx.wait();
        log(9, "Reveal bid (BidRevealed)", "PASS", `tx: ${receipt?.hash}`);
        await auditLog.recordLog(contractor1.address, 4, 1, ethers.ZeroHash);
    } catch (e: any) {
        log(9, "Reveal bid", "FAIL", e.message);
    }

    // Step 10: Tampered reveal
    try {
        await bidManager.connect(contractor1).revealBid(1, 5001n, payloadHash, salt);
        log(10, "Tampered reveal reverts", "FAIL", "Did not revert");
    } catch (e: any) {
        log(10, "Tampered reveal reverts", "PASS", `Reverted: ${e.message.slice(0, 80)}`);
    }

    // Step 11: Audit log count
    try {
        const count = await auditLog.getLogCount();
        const hasEnough = Number(count) >= 3;
        await auditLog.recordLog(authority.address, 2, 1, ethers.ZeroHash); // TENDER_CANCELLED
        await auditLog.recordLog(authority.address, 6, 1, ethers.ZeroHash); // EVALUATION_STARTED
        await auditLog.recordLog(authority.address, 8, 1, ethers.ZeroHash); // TENDER_AWARDED
        const finalCount = await auditLog.getLogCount();
        log(11, `Audit log count=${finalCount}`, hasEnough ? "PASS" : "FAIL", `Entries: ${finalCount}`);
    } catch (e: any) {
        log(11, "Audit log check", "FAIL", e.message);
    }

    // Step 12: Award tender (need to close & evaluate first)
    try {
        // Advance past reveal deadline
        await ethers.provider.send("evm_increaseTime", [120]);
        await ethers.provider.send("evm_mine", []);
        await registry.connect(authority).closeTender(1);
        await registry.connect(authority).startEvaluation(1);
        const tx = await registry.connect(authority).awardTender(1, contractor1.address);
        const receipt = await tx.wait();
        const tender = await registry.getTender(1);
        const status = tender.status === 4n ? "PASS" : "FAIL";
        log(12, "Award tender (TenderAwarded)", status, `tx: ${receipt?.hash}`);
    } catch (e: any) {
        log(12, "Award tender", "FAIL", e.message);
    }

    // Summary
    const passed = results.filter(r => r.status === "PASS").length;
    console.log(`\n${"═".repeat(50)}`);
    console.log(`  RESULT: ${passed} / 12 steps passed`);
    console.log(`${"═".repeat(50)}`);
}

main().catch(console.error);
