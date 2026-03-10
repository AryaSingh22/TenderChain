// ============================================================
// TenderChain Crypto Utilities
// ECIES encryption/decryption for bid payloads
// Commitment hash generation for commit-reveal scheme
// ============================================================

import { encrypt, decrypt, PrivateKey } from "eciesjs";
import { ethers } from "ethers";

/**
 * Generate a new ECIES keypair for a tender
 * Each tender gets its own keypair to limit blast radius
 */
export function generateTenderKeyPair(): {
    publicKey: string;
    privateKey: string;
} {
    const key = new PrivateKey();
    return {
        publicKey: key.publicKey.toHex(),
        privateKey: key.toHex(),
    };
}

/**
 * Encrypt bid payload using authority's public key
 * @param payload - JSON-serializable bid payload
 * @param publicKeyHex - Authority's ECIES public key for this tender
 */
export function encryptBidPayload(
    payload: object,
    publicKeyHex: string
): string {
    const plaintext = Buffer.from(JSON.stringify(payload), "utf-8");
    const encrypted = encrypt(publicKeyHex, plaintext);
    return Buffer.from(encrypted).toString("hex");
}

/**
 * Decrypt bid payload using authority's private key
 * @param encryptedHex - Hex-encoded encrypted payload
 * @param privateKeyHex - Authority's ECIES private key
 */
export function decryptBidPayload(
    encryptedHex: string,
    privateKeyHex: string
): object {
    const encrypted = Buffer.from(encryptedHex, "hex");
    const decrypted = decrypt(privateKeyHex, encrypted);
    return JSON.parse(Buffer.from(decrypted).toString("utf-8"));
}

/**
 * Generate a cryptographically secure salt (32 bytes)
 */
export function generateSalt(): string {
    return ethers.hexlify(ethers.randomBytes(32));
}

/**
 * Compute commitment hash for the commit-reveal scheme
 * commitment = keccak256(abi.encodePacked(bidderAddress, tenderId, payloadHash, salt))
 */
export function computeCommitment(
    bidderAddress: string,
    tenderId: number,
    payloadHash: string,
    salt: string
): string {
    return ethers.keccak256(
        ethers.solidityPacked(
            ["address", "uint256", "bytes32", "bytes32"],
            [bidderAddress, tenderId, payloadHash, salt]
        )
    );
}

/**
 * Compute keccak256 hash of a bid payload object
 */
export function hashPayload(payload: object): string {
    return ethers.keccak256(
        ethers.toUtf8Bytes(JSON.stringify(payload))
    );
}

export { PrivateKey };
