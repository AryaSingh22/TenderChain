import { ethers } from "hardhat";

async function main() {
    console.log("═══ Gas Benchmark Script ═══\n");

    const [admin, contractor] = await ethers.getSigners();

    // Deploy
    const TenderRegistry = await ethers.getContractFactory("TenderRegistry");
    const registry = await TenderRegistry.deploy(admin.address);
    const BidManager = await ethers.getContractFactory("BidManager");
    const bidManager = await BidManager.deploy(await registry.getAddress(), admin.address);

    const now = (await ethers.provider.getBlock("latest"))!.timestamp;
    const submissionDeadline = now + 3600;
    const revealDeadline = now + 7200;

    // Benchmark createTender
    const tx1 = await registry.createTender("QmDoc", submissionDeadline, revealDeadline, "QmE", 1000, 100000);
    const receipt1 = await tx1.wait();
    const createGas = Number(receipt1!.gasUsed);

    // Publish tender
    await registry.publishTender(1);

    // Benchmark submitCommitment
    const salt = ethers.hexlify(ethers.randomBytes(32));
    const payloadHash = ethers.keccak256(ethers.toUtf8Bytes('{"amount":5000}'));
    const commitment = ethers.keccak256(
        ethers.solidityPacked(
            ["address", "uint256", "bytes32", "bytes32"],
            [contractor.address, 1, payloadHash, salt]
        )
    );

    const tx2 = await bidManager.connect(contractor).submitCommitment(1, commitment);
    const receipt2 = await tx2.wait();
    const submitGas = Number(receipt2!.gasUsed);

    // Advance time for reveal
    await ethers.provider.send("evm_increaseTime", [3601]);
    await ethers.provider.send("evm_mine", []);

    // Benchmark revealBid
    const tx3 = await bidManager.connect(contractor).revealBid(1, 5000, payloadHash, salt);
    const receipt3 = await tx3.wait();
    const revealGas = Number(receipt3!.gasUsed);

    // Thresholds
    const thresholds = {
        createTender: 200000,
        submitCommitment: 100000,
        revealBid: 150000,
    };

    console.log("  Gas Usage Results:");
    console.log(`    createTender:     ${createGas} gas ${createGas < thresholds.createTender ? "✅ PASS" : "❌ FAIL"} (limit: ${thresholds.createTender})`);
    console.log(`    submitCommitment: ${submitGas} gas ${submitGas < thresholds.submitCommitment ? "✅ PASS" : "❌ FAIL"} (limit: ${thresholds.submitCommitment})`);
    console.log(`    revealBid:        ${revealGas} gas ${revealGas < thresholds.revealBid ? "✅ PASS" : "❌ FAIL"} (limit: ${thresholds.revealBid})`);

    const allPass = createGas < thresholds.createTender && submitGas < thresholds.submitCommitment && revealGas < thresholds.revealBid;
    console.log(`\n  Overall: ${allPass ? "✅ ALL GAS BENCHMARKS PASS" : "❌ SOME BENCHMARKS EXCEEDED"}`);
}

main().catch(console.error);
