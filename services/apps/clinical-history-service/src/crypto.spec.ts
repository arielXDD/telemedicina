import { encrypt, decrypt } from '../../shared/crypto';

describe('Criptografía de Datos de Salud (AES-256-CBC)', () => {
  it('debería encriptar y desencriptar un diagnóstico médico correctamente', () => {
    const originalText = 'El paciente presenta síntomas de fatiga crónica y taquicardia leve.';
    
    // Encriptar
    const enc = encrypt(originalText);
    
    expect(enc.iv).toBeDefined();
    expect(enc.encryptedData).toBeDefined();
    expect(enc.encryptedData).not.toBe(originalText);
    
    // Desencriptar
    const dec = decrypt(enc.encryptedData, enc.iv);
    expect(dec).toBe(originalText);
  });

  it('debería retornar un mensaje de error si el descifrado falla con una clave o IV corrupto', () => {
    const enc = encrypt('Datos Sensibles de Prueba');
    
    // Intentar desencriptar con un IV de prueba no hexadecimal inválido
    const dec = decrypt(enc.encryptedData, 'invalid_iv_hex');
    expect(dec).toContain('Error al descifrar');
  });

  it('debería retornar strings vacíos si los textos a encriptar o desencriptar están vacíos', () => {
    const enc = encrypt('');
    expect(enc.iv).toBe('');
    expect(enc.encryptedData).toBe('');
    
    const dec = decrypt('', '');
    expect(dec).toBe('');
  });
});
