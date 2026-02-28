/**
 * Tron-specific signer interface.
 *
 * Extends the base ISigner contract with TRON signing capabilities.
 * No signTypedData — TRON has no EIP-712 equivalent.
 *
 * @interface
 */
export class ISignerTron {
    /** @type {boolean} */
    get isActive(): boolean;
    /** @type {boolean} */
    get isRoot(): boolean;
    /** @type {number|undefined} */
    get index(): number | undefined;
    /** @type {string|undefined} */
    get path(): string | undefined;
    /** @type {string|undefined} */
    get address(): string | undefined;
    /**
     * @type {{ privateKey: Uint8Array|null, publicKey: Uint8Array|null }}
     */
    get keyPair(): {
        privateKey: Uint8Array | null;
        publicKey: Uint8Array | null;
    };
    /**
     * Derive a child signer from a relative BIP-44 path (e.g. "0'/0/0").
     * @param {string} relPath
     * @returns {ISignerTron}
     */
    derive(relPath: string): ISignerTron;
    /** @returns {Promise<string>} */
    getAddress(): Promise<string>;
    /**
     * Sign a plain text message using the TRON personal sign prefix.
     * @param {string} message
     * @returns {Promise<string>} hex signature with 0x prefix
     */
    sign(message: string): Promise<string>;
    /**
     * Sign a raw TRON transaction by its txID (hex string).
     * @param {string} txID - The transaction ID hex string (32 bytes).
     * @returns {Promise<string>} compact hex signature (r+s+v, no 0x prefix)
     */
    signTransaction(txID: string): Promise<string>;
    /** Clear secret material from memory. */
    dispose(): void;
}
