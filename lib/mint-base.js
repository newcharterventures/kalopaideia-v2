// lib/mint-base.js — mint a soulbound diploma NFT on Base mainnet (or Base
// Sepolia for staging). Talks to the deployed Kalopaideia Diploma contract.
//
// The contract is a small ERC-721 with two modifications:
//   1. transfers reverted (soulbound)
//   2. tokenURI returns an IPFS link to a signed JSON document
//
// Network selection by env:
//   PAIDEIA_CHAIN = base | base-sepolia   (default: base-sepolia)
//   PAIDEIA_CONTRACT_ADDRESS = 0x...
//   PAIDEIA_MINT_PRIVATE_KEY = 0x...  (held by the proprietor)
//   PAIDEIA_BASE_RPC_URL = https://...
//   PAIDEIA_IPFS_PIN_URL = https://api.pinata.cloud/pinning/pinJSONToIPFS
//   PAIDEIA_IPFS_PIN_JWT = pinata bearer
//
// Until the contract is deployed and these env vars are set, this module
// runs in DRY_RUN mode: it composes the metadata, pins to local disk under
// data/curriculum/certs/, computes a deterministic mock token ID, and
// returns a stub transaction hash. The verify page reads from the same
// store, so the entire flow can be tested end-to-end before the chain is
// wired up.

import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CERT_DIR = path.resolve(__dirname, "..", "data", "curriculum", "certs");

const CHAIN = process.env.PAIDEIA_CHAIN || "base-sepolia";
const CONTRACT = process.env.PAIDEIA_CONTRACT_ADDRESS || null;
const IS_DRY = !CONTRACT || !process.env.PAIDEIA_MINT_PRIVATE_KEY;

export function isLive() { return !IS_DRY; }
export function chainName() { return CHAIN; }

async function ensureDir(dir) {
  try { await fs.mkdir(dir, { recursive: true }); } catch {}
}

function buildMetadata({ publicName, lang, displayName, trackId, trackName, honors, capstoneDate, scriptHash, scorePct }) {
  return {
    name: `Kalopaideia Diploma in ${displayName}${honors ? " (with Honors)" : ""}`,
    description: `Issued by Kalopaideia to ${publicName} on ${capstoneDate} on completion of the ${displayName} capstone examination${trackName ? ` (${trackName} track)` : ""}.`,
    image: `https://newcharterventures.com/paideia/img/diploma/${lang}.png`,
    external_url: `https://newcharterventures.com/paideia/verify/{TOKEN_ID}`,
    attributes: [
      { trait_type: "Language", value: displayName },
      { trait_type: "Track", value: trackName || "—" },
      { trait_type: "Result", value: honors ? "Pass with Honors" : "Pass" },
      { trait_type: "Score", value: `${(scorePct * 100).toFixed(1)}%` },
      { trait_type: "Date", value: capstoneDate },
      { trait_type: "Chain", value: CHAIN },
      { trait_type: "Soulbound", value: "true" },
    ],
    properties: {
      issuer: "Kalopaideia",
      issuer_url: "https://newcharterventures.com/paideia/",
      credential_type: "diploma_of_completion",
      script_hash: scriptHash,
    },
  };
}

// SHA-256 of the metadata payload is the deterministic mock token ID in dry mode.
function mockTokenId(metadata) {
  return BigInt("0x" + crypto.createHash("sha256").update(JSON.stringify(metadata)).digest("hex").slice(0, 16)).toString();
}

export async function mintDiploma({ publicName, userEmail, lang, displayName, trackId, trackName, honors, scriptHash, scorePct }) {
  const capstoneDate = new Date().toISOString().slice(0, 10);
  const metadata = buildMetadata({ publicName, lang, displayName, trackId, trackName, honors, capstoneDate, scriptHash, scorePct });

  if (IS_DRY) {
    await ensureDir(CERT_DIR);
    const tokenId = mockTokenId(metadata);
    const recordPath = path.join(CERT_DIR, `${tokenId}.json`);
    const record = {
      tokenId,
      chain: CHAIN,
      contract: CONTRACT || "(dry-run)",
      txHash: "0xDRYRUN" + crypto.randomBytes(28).toString("hex"),
      mintedAt: Date.now(),
      userEmail,
      publicName,
      lang,
      displayName,
      trackId, trackName,
      honors,
      scriptHash,
      scorePct,
      metadata,
    };
    await fs.writeFile(recordPath, JSON.stringify(record, null, 2));
    return { tokenId, txHash: record.txHash, dryRun: true, metadata };
  }

  // Live mode: pin metadata to IPFS, then call mint() on the contract.
  // viem-based path; the contract ABI is a minimal soulbound ERC-721.
  const { createWalletClient, http, encodeFunctionData } = await import("viem");
  const { privateKeyToAccount } = await import("viem/accounts");
  const { base, baseSepolia } = await import("viem/chains");

  // Pin to IPFS via Pinata.
  const pinUrl = process.env.PAIDEIA_IPFS_PIN_URL || "https://api.pinata.cloud/pinning/pinJSONToIPFS";
  const pinJwt = process.env.PAIDEIA_IPFS_PIN_JWT;
  if (!pinJwt) throw new Error("PAIDEIA_IPFS_PIN_JWT not set");
  const pinResp = await fetch(pinUrl, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${pinJwt}` },
    body: JSON.stringify({ pinataContent: metadata, pinataMetadata: { name: `kalopaideia-${lang}-${capstoneDate}` } }),
  });
  if (!pinResp.ok) throw new Error(`pin failed: ${pinResp.status}`);
  const pin = await pinResp.json();
  const ipfsUri = `ipfs://${pin.IpfsHash}`;

  const account = privateKeyToAccount(process.env.PAIDEIA_MINT_PRIVATE_KEY);
  const chain = CHAIN === "base" ? base : baseSepolia;
  const rpc = process.env.PAIDEIA_BASE_RPC_URL || chain.rpcUrls.default.http[0];
  const wallet = createWalletClient({ account, chain, transport: http(rpc) });

  // Pre-image: keccak256(abi.encodePacked(userEmail, lang, scriptHash)) → tokenId
  const { keccak256, toBytes } = await import("viem");
  const tokenIdHex = keccak256(toBytes(`${userEmail}|${lang}|${scriptHash}`));
  const tokenId = BigInt(tokenIdHex);

  const abi = [{
    name: "mint",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "tokenId", type: "uint256" },
      { name: "uri", type: "string" },
    ],
    outputs: [],
  }];

  // For pseudonymous credentials, mint to the issuer-controlled address;
  // we publish the metadata under the holder's public name without
  // requiring them to hold an Ethereum wallet. (Holder may later request
  // a transfer-to-self; transfer is blocked, so the on-chain attribution
  // stays with the issuer wallet.)
  const txHash = await wallet.writeContract({
    address: CONTRACT,
    abi,
    functionName: "mint",
    args: [account.address, tokenId, ipfsUri],
  });

  return { tokenId: tokenId.toString(), txHash, dryRun: false, metadata, ipfsUri };
}
