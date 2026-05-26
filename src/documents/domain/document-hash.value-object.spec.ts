/**
 * @file document-hash.value-object.spec.ts
 * @module documents/domain
 */

import { DocumentHash } from './document-hash.value-object';
import { InvalidDocumentHashException } from './exceptions/document.exceptions';

const VALID =
  '0xe8c6b5b48b78e66a103cd2c79aa19cd869a7e53fe31bba832f4592bf92e567c8';
const VALID2 =
  '0xa1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';

describe('DocumentHash', () => {
  describe('create', () => {
    it('debe crear un DocumentHash válido con formato bytes32', () => {
      expect(() => DocumentHash.create(VALID)).not.toThrow();
    });

    it('debe lanzar InvalidDocumentHashException con hash demasiado corto', () => {
      expect(() => DocumentHash.create('0xabc')).toThrow(
        InvalidDocumentHashException,
      );
    });

    it('debe lanzar InvalidDocumentHashException sin prefijo 0x', () => {
      expect(() =>
        DocumentHash.create(
          'e8c6b5b48b78e66a103cd2c79aa19cd869a7e53fe31bba832f4592bf92e567c8',
        ),
      ).toThrow(InvalidDocumentHashException);
    });

    it('debe lanzar InvalidDocumentHashException con caracteres no hexadecimales', () => {
      expect(() =>
        DocumentHash.create(
          '0xZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ',
        ),
      ).toThrow(InvalidDocumentHashException);
    });
  });

  describe('toString', () => {
    it('debe devolver el valor primitivo', () => {
      expect(DocumentHash.create(VALID).toString()).toBe(VALID);
    });
  });

  describe('equals', () => {
    it('debe retornar true para dos hashes con el mismo valor', () => {
      const a = DocumentHash.create(VALID);
      const b = DocumentHash.create(VALID);
      expect(a.equals(b)).toBe(true);
    });

    it('debe retornar false para dos hashes distintos', () => {
      const a = DocumentHash.create(VALID);
      const b = DocumentHash.create(VALID2);
      expect(a.equals(b)).toBe(false);
    });
  });
});
