// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * KalopaideiaDiploma
 *
 * A minimal soulbound ERC-721 used by Kalopaideia to issue diplomas for
 * completion of its classical-language curricula. Deployed on Base.
 *
 * Design choices:
 *   - Owner-only minting. Diplomas are issued by the Kalopaideia proprietor,
 *     not earned permissionlessly on-chain. The off-chain examination is
 *     the authority; this contract records the fact of issuance.
 *   - Soulbound: every transfer reverts. The diploma cannot be sold,
 *     traded, or gifted. It is an attestation, not an asset.
 *   - Per-token URI. The URI points to an IPFS-pinned JSON document with
 *     the diploma metadata (name, language, track, result, date, hash).
 *   - One token per (holder, language). Enforced by the off-chain pipeline
 *     using tokenId = keccak256(holder_email || lang || script_hash).
 *     Duplicate mints revert because tokenId already exists.
 *   - Revocation: original tokens are never burned. If a result is rescinded
 *     (e.g. proven cheating), a separate "revocation token" is minted that
 *     references the original tokenId in its metadata. The original stays
 *     on-chain forever as required by the "irreplaceable" promise.
 */

interface IERC721 {
    function ownerOf(uint256 tokenId) external view returns (address);
    function balanceOf(address owner) external view returns (uint256);
    function transferFrom(address from, address to, uint256 tokenId) external;
    function safeTransferFrom(address from, address to, uint256 tokenId) external;
    function safeTransferFrom(address from, address to, uint256 tokenId, bytes calldata data) external;
    function approve(address to, uint256 tokenId) external;
    function setApprovalForAll(address operator, bool approved) external;
    function getApproved(uint256 tokenId) external view returns (address);
    function isApprovedForAll(address owner, address operator) external view returns (bool);
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}

interface IERC721Metadata is IERC721 {
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function tokenURI(uint256 tokenId) external view returns (string memory);
}

contract KalopaideiaDiploma is IERC721Metadata {
    string public constant name = "Kalopaideia Diploma";
    string public constant symbol = "KALO";

    address public owner;
    address public pendingOwner;

    mapping(uint256 => address) private _ownerOf;
    mapping(address => uint256) private _balanceOf;
    mapping(uint256 => string)  private _tokenURI;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event DiplomaIssued(address indexed to, uint256 indexed tokenId, string uri);
    event DiplomaRevoked(uint256 indexed originalTokenId, uint256 indexed revocationTokenId, string reason);

    error NotOwner();
    error Soulbound();
    error AlreadyMinted();
    error NonexistentToken();

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    function transferOwnership(address newOwner) external onlyOwner { pendingOwner = newOwner; }
    function acceptOwnership() external {
        require(msg.sender == pendingOwner, "not pending");
        emit OwnershipTransferred(owner, pendingOwner);
        owner = pendingOwner;
        pendingOwner = address(0);
    }

    function mint(address to, uint256 tokenId, string calldata uri) external onlyOwner {
        if (_ownerOf[tokenId] != address(0)) revert AlreadyMinted();
        _ownerOf[tokenId] = to;
        _balanceOf[to] += 1;
        _tokenURI[tokenId] = uri;
        emit Transfer(address(0), to, tokenId);
        emit DiplomaIssued(to, tokenId, uri);
    }

    function revoke(uint256 originalTokenId, string calldata reason, string calldata revocationUri) external onlyOwner {
        if (_ownerOf[originalTokenId] == address(0)) revert NonexistentToken();
        uint256 revId = uint256(keccak256(abi.encodePacked("REVOKE", originalTokenId, block.timestamp)));
        _ownerOf[revId] = owner;
        _balanceOf[owner] += 1;
        _tokenURI[revId] = revocationUri;
        emit Transfer(address(0), owner, revId);
        emit DiplomaRevoked(originalTokenId, revId, reason);
    }

    // ===== ERC-721 =====

    function ownerOf(uint256 tokenId) public view returns (address) {
        address o = _ownerOf[tokenId];
        if (o == address(0)) revert NonexistentToken();
        return o;
    }

    function balanceOf(address who) external view returns (uint256) { return _balanceOf[who]; }

    function tokenURI(uint256 tokenId) external view returns (string memory) {
        if (_ownerOf[tokenId] == address(0)) revert NonexistentToken();
        return _tokenURI[tokenId];
    }

    // All transfer paths revert: soulbound.
    function transferFrom(address, address, uint256) external pure { revert Soulbound(); }
    function safeTransferFrom(address, address, uint256) external pure { revert Soulbound(); }
    function safeTransferFrom(address, address, uint256, bytes calldata) external pure { revert Soulbound(); }
    function approve(address, uint256) external pure { revert Soulbound(); }
    function setApprovalForAll(address, bool) external pure { revert Soulbound(); }
    function getApproved(uint256) external pure returns (address) { return address(0); }
    function isApprovedForAll(address, address) external pure returns (bool) { return false; }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return
            interfaceId == 0x01ffc9a7 || // ERC-165
            interfaceId == 0x80ac58cd || // ERC-721
            interfaceId == 0x5b5e139f;   // ERC-721 Metadata
    }
}
