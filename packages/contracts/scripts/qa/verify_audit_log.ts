import { ethers } from "hardhat";

async function main() {
    console.log("═══ Verify Audit Log Script ═══\n");

    const [admin] = await ethers.getSigners();
    const AuditLog = await ethers.getContractFactory("AuditLog");
    const auditLog = await AuditLog.deploy(admin.address);
    const LOGGER_ROLE = await auditLog.LOGGER_ROLE();
    await auditLog.grantRole(LOGGER_ROLE, admin.address);

    const actionTypeNames = [
        "TENDER_CREATED", "TENDER_PUBLISHED", "TENDER_CANCELLED",
        "BID_COMMITTED", "BID_REVEALED", "BID_FORFEITED",
        "EVALUATION_STARTED", "EVALUATION_COMPLETED", "TENDER_AWARDED",
        "APPEAL_FILED", "APPEAL_RESOLVED", "AI_EVALUATION_GENERATED",
        "PERFORMANCE_RECORDED", "VALIDATOR_ADDED", "VALIDATOR_REMOVED"
    ];

    // Record sample entries for required action types
    const requiredTypes = [0, 1, 3, 4, 8]; // TENDER_CREATED, PUBLISHED, BID_COMMITTED, BID_REVEALED, TENDER_AWARDED
    for (const actionType of requiredTypes) {
        await auditLog.recordLog(admin.address, actionType, 1, ethers.ZeroHash);
    }

    const count = await auditLog.getLogCount();
    console.log(`  Total log entries: ${count}\n`);

    const typeCounts: Record<string, number> = {};
    for (const name of actionTypeNames) typeCounts[name] = 0;

    const logs = await auditLog.getLogs(1, Number(count));
    for (const entry of logs) {
        const name = actionTypeNames[Number(entry.actionType)] || `UNKNOWN(${entry.actionType})`;
        typeCounts[name] = (typeCounts[name] || 0) + 1;
    }

    console.log("  Action Type Counts:");
    for (const [name, c] of Object.entries(typeCounts)) {
        if (c > 0) console.log(`    ${name}: ${c}`);
    }

    // Verify required types
    const required = ["TENDER_CREATED", "TENDER_PUBLISHED", "BID_COMMITTED", "BID_REVEALED", "TENDER_AWARDED"];
    let allPresent = true;
    console.log("\n  Required Action Type Verification:");
    for (const name of required) {
        const present = typeCounts[name] > 0;
        console.log(`    ${name}: ${present ? "✅ PASS" : "❌ FAIL"}`);
        if (!present) allPresent = false;
    }

    console.log(`\n  Overall: ${allPresent ? "✅ ALL REQUIRED TYPES PRESENT" : "❌ MISSING REQUIRED TYPES"}`);
}

main().catch(console.error);
