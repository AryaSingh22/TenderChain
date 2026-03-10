import { ethers } from "hardhat";

async function main() {
    console.log("═══ Read Commitment Script ═══\n");

    const [authority, contractor] = await ethers.getSigners();

    const TenderRegistry = await ethers.getContractFactory("TenderRegistry");
    const registry = await TenderRegistry.deploy(authority.address);
    const BidManager = await ethers.getContractFactory("BidManager");
    const bidManager = await BidManager.deploy(await registry.getAddress(), authority.address);

    const now = (await ethers.provider.getBlock("latest"))!.timestamp;
    await registry.createTender("QmDoc", now + 3600, now + 7200, "QmE", 1000, 100000);
    await registry.publishTender(1);

    const salt = ethers.hexlify(ethers.randomBytes(32));
    const payloadHash = ethers.keccak256(ethers.toUtf8Bytes('{"amount":5000}'));
    const offChainCommitment = ethers.keccak256(
        ethers.solidityPacked(
            ["address", "uint256", "bytes32", "bytes32"],
            [contractor.address, 1, payloadHash, salt]
        )
    );

    await bidManager.connect(contractor).submitCommitment(1, offChainCommitment);

    const onChainCommitment = await bidManager.getCommitment(1, contractor.address);

    console.log(`  Tender ID:          1`);
    console.log(`  Bidder:             ${contractor.address}`);
    console.log(`  Off-chain computed: ${offChainCommitment}`);
    console.log(`  On-chain stored:    ${onChainCommitment}`);
    console.log(`  Match:              ${offChainCommitment === onChainCommitment ? "✅ YES" : "❌ NO"}`);
}

main().catch(console.error);
