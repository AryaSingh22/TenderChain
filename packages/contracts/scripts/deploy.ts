import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with:", deployer.address);
    console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)));

    // 1. Deploy AuditLog
    console.log("\n1. Deploying AuditLog...");
    const AuditLog = await ethers.getContractFactory("AuditLog");
    const auditLog = await AuditLog.deploy(deployer.address);
    await auditLog.waitForDeployment();
    const auditLogAddr = await auditLog.getAddress();
    console.log("   AuditLog deployed to:", auditLogAddr);

    // 2. Deploy TenderRegistry
    console.log("\n2. Deploying TenderRegistry...");
    const TenderRegistry = await ethers.getContractFactory("TenderRegistry");
    const tenderRegistry = await TenderRegistry.deploy(deployer.address);
    await tenderRegistry.waitForDeployment();
    const tenderRegistryAddr = await tenderRegistry.getAddress();
    console.log("   TenderRegistry deployed to:", tenderRegistryAddr);

    // 3. Deploy BidManager
    console.log("\n3. Deploying BidManager...");
    const BidManager = await ethers.getContractFactory("BidManager");
    const bidManager = await BidManager.deploy(tenderRegistryAddr, deployer.address);
    await bidManager.waitForDeployment();
    const bidManagerAddr = await bidManager.getAddress();
    console.log("   BidManager deployed to:", bidManagerAddr);

    // 4. Deploy GovernanceController (3 governors = deployer + 2 generated)
    console.log("\n4. Deploying GovernanceController...");
    const wallet2 = ethers.Wallet.createRandom();
    const wallet3 = ethers.Wallet.createRandom();
    const GovernanceController = await ethers.getContractFactory("GovernanceController");
    const governance = await GovernanceController.deploy([
        deployer.address,
        wallet2.address,
        wallet3.address,
    ]);
    await governance.waitForDeployment();
    const governanceAddr = await governance.getAddress();
    console.log("   GovernanceController deployed to:", governanceAddr);

    // 5. Deploy DisputeResolution
    console.log("\n5. Deploying DisputeResolution...");
    const DisputeResolution = await ethers.getContractFactory("DisputeResolution");
    const disputeResolution = await DisputeResolution.deploy(deployer.address, deployer.address);
    await disputeResolution.waitForDeployment();
    const disputeAddr = await disputeResolution.getAddress();
    console.log("   DisputeResolution deployed to:", disputeAddr);

    // 6. Deploy PerformanceRegistry
    console.log("\n6. Deploying PerformanceRegistry...");
    const PerformanceRegistry = await ethers.getContractFactory("PerformanceRegistry");
    const performanceRegistry = await PerformanceRegistry.deploy(deployer.address);
    await performanceRegistry.waitForDeployment();
    const perfAddr = await performanceRegistry.getAddress();
    console.log("   PerformanceRegistry deployed to:", perfAddr);

    // 7. Link governance to TenderRegistry
    console.log("\n7. Linking GovernanceController...");
    await tenderRegistry.setGovernanceContract(governanceAddr);
    console.log("   GovernanceController linked to TenderRegistry");

    // Summary
    console.log("\n════════════════════════════════════════════════");
    console.log("  TenderChain Deployment Complete");
    console.log("════════════════════════════════════════════════");
    console.log("  TenderRegistry:       ", tenderRegistryAddr);
    console.log("  BidManager:           ", bidManagerAddr);
    console.log("  AuditLog:             ", auditLogAddr);
    console.log("  GovernanceController: ", governanceAddr);
    console.log("  DisputeResolution:    ", disputeAddr);
    console.log("  PerformanceRegistry:  ", perfAddr);
    console.log("════════════════════════════════════════════════");

    return {
        tenderRegistry: tenderRegistryAddr,
        bidManager: bidManagerAddr,
        auditLog: auditLogAddr,
        governance: governanceAddr,
        disputeResolution: disputeAddr,
        performanceRegistry: perfAddr,
    };
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
