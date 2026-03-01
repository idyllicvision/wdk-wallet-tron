import { describe, test, expect, beforeEach, jest } from '@jest/globals'

// Mock tronweb before importing the module under test.
// Must export both `default` (constructable, for WalletAccountReadOnlyTron) and
// named `TronWeb` (for SeedSignerTron's address derivation).
const mockSendTrx = jest.fn()
const mockTriggerSmartContract = jest.fn()
const mockTriggerConstantContract = jest.fn()
const mockSendRawTransaction = jest.fn()
const mockGetAccountResources = jest.fn()
const mockGetChainParameters = jest.fn()
const mockToHex = jest.fn(addr => '41' + addr.slice(2))

jest.unstable_mockModule('tronweb', () => {
  const MockTronWeb = jest.fn().mockImplementation(() => ({
    transactionBuilder: {
      sendTrx: mockSendTrx,
      triggerSmartContract: mockTriggerSmartContract,
      triggerConstantContract: mockTriggerConstantContract
    },
    trx: {
      sendRawTransaction: mockSendRawTransaction,
      getAccountResources: mockGetAccountResources,
      getChainParameters: mockGetChainParameters
    },
    address: { toHex: mockToHex },
    toBigNumber: jest.fn(v => ({ toFixed: () => v }))
  }))
  MockTronWeb.address = {
    fromHex: jest.fn(h => 'T' + h.slice(2, 10)),
    toHex: mockToHex,
    verifyMessageV2: jest.fn()
  }
  MockTronWeb.Trx = { verifyMessageV2: jest.fn() }
  const MockTrx = { verifyMessageV2: jest.fn() }
  return { default: MockTronWeb, TronWeb: MockTronWeb, Trx: MockTrx }
})

const { default: WalletAccountTron } = await import('../src/wallet-account-tron.js')
const { default: WalletAccountReadOnlyTron } = await import('../src/wallet-account-read-only-tron.js')
const { default: SeedSignerTron } = await import('../src/signers/seed-signer-tron.js')

const MNEMONIC = 'cook voyage document eight skate token alien guide drink uncle term abuse'

function makeChildSigner (index = 0) {
  const root = new SeedSignerTron(MNEMONIC)
  return root.derive(`0'/0/${index}`)
}

describe('WalletAccountTron', () => {
  describe('constructor', () => {
    test('accepts a child signer', () => {
      const child = makeChildSigner()
      const account = new WalletAccountTron(child, {})
      expect(account).toBeInstanceOf(WalletAccountTron)
    })

    test('throws if signer is root', () => {
      const root = new SeedSignerTron(MNEMONIC)
      expect(() => new WalletAccountTron(root, {})).toThrow('root signer')
    })

    test('throws if no signer provided', () => {
      expect(() => new WalletAccountTron(null, {})).toThrow()
    })
  })

  describe('fromSeed() static factory', () => {
    test('creates an account with correct path', () => {
      const account = WalletAccountTron.fromSeed(MNEMONIC, "0'/0/0", {})
      expect(account.path).toBe("m/44'/195'/0'/0/0")
    })

    test('account from factory has same address as direct construction', () => {
      const child = makeChildSigner(0)
      const fromFactory = WalletAccountTron.fromSeed(MNEMONIC, "0'/0/0", {})
      expect(fromFactory.path).toBe(child.path)
    })
  })

  describe('getAddress()', () => {
    test('returns the signer address', async () => {
      const child = makeChildSigner()
      const account = new WalletAccountTron(child, {})
      expect(await account.getAddress()).toBe(child.address)
    })
  })

  describe('index and path', () => {
    test('index delegates to signer', () => {
      const child = makeChildSigner(3)
      const account = new WalletAccountTron(child, {})
      expect(account.index).toBe(3)
    })

    test('path delegates to signer', () => {
      const child = makeChildSigner(2)
      const account = new WalletAccountTron(child, {})
      expect(account.path).toBe("m/44'/195'/0'/0/2")
    })
  })

  describe('keyPair', () => {
    test('delegates to signer keyPair', () => {
      const child = makeChildSigner()
      const account = new WalletAccountTron(child, {})
      expect(account.keyPair).toEqual(child.keyPair)
    })
  })

  describe('sign()', () => {
    test('delegates to signer.sign()', async () => {
      const child = makeChildSigner()
      const signSpy = jest.spyOn(child, 'sign').mockResolvedValue('0xdeadbeef')
      const account = new WalletAccountTron(child, {})

      const result = await account.sign('test message')

      expect(signSpy).toHaveBeenCalledWith('test message')
      expect(result).toBe('0xdeadbeef')
    })
  })

  describe('sendTransaction()', () => {
    let child, account

    beforeEach(() => {
      child = makeChildSigner()
      account = new WalletAccountTron(child, { provider: 'https://api.trongrid.io' })

      const fakeTx = {
        txID: 'a'.repeat(64),
        raw_data_hex: 'b'.repeat(100)
      }
      mockSendTrx.mockResolvedValue(fakeTx)
      mockGetAccountResources.mockResolvedValue({ freeNetLimit: 1500, freeNetUsed: 0 })
      mockSendRawTransaction.mockResolvedValue({ result: true })
    })

    test('calls signer.signTransaction with the txID', async () => {
      const signTxSpy = jest.spyOn(child, 'signTransaction').mockResolvedValue('sig123')

      await account.sendTransaction({ to: 'TRecipient', value: 1000000 })

      expect(signTxSpy).toHaveBeenCalledWith('a'.repeat(64))
    })

    test('returns txID from signed transaction', async () => {
      jest.spyOn(child, 'signTransaction').mockResolvedValue('sig123')

      const result = await account.sendTransaction({ to: 'TRecipient', value: 1000000 })

      expect(result.hash).toBe('a'.repeat(64))
    })

    test('throws if not connected to TronWeb', async () => {
      const offlineAccount = new WalletAccountTron(child, {})
      await expect(offlineAccount.sendTransaction({ to: 'T', value: 0 })).rejects.toThrow('connected to tron web')
    })
  })

  describe('toReadOnlyAccount()', () => {
    test('returns WalletAccountReadOnlyTron', async () => {
      const child = makeChildSigner()
      const account = new WalletAccountTron(child, {})
      const readOnly = await account.toReadOnlyAccount()
      expect(readOnly).toBeInstanceOf(WalletAccountReadOnlyTron)
    })
  })

  describe('dispose()', () => {
    test('calls signer.dispose()', () => {
      const child = makeChildSigner()
      const disposeSpy = jest.spyOn(child, 'dispose')
      const account = new WalletAccountTron(child, {})

      account.dispose()

      expect(disposeSpy).toHaveBeenCalled()
    })

    test('sets isActive to false', () => {
      const child = makeChildSigner()
      const account = new WalletAccountTron(child, {})

      account.dispose()

      expect(account.isActive).toBe(false)
    })
  })
})
