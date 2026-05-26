import * as crypto from 'crypto';

// Clave de encriptación de 32 bytes (256 bits).
// Se intenta leer de variables de entorno; si no existe, se usa una por defecto de desarrollo.
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'ab12cd34ef56gh78ij90kl12mn34op56'; // Debe tener exactamente 32 caracteres.
const ALGORITHM = 'aes-256-cbc';

export function encrypt(text: string): { iv: string; encryptedData: string } {
  if (!text) return { iv: '', encryptedData: '' };
  
  // Vector de Inicialización (IV) de 16 bytes.
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return {
    iv: iv.toString('hex'),
    encryptedData: encrypted,
  };
}

export function decrypt(encryptedData: string, ivHex: string): string {
  if (!encryptedData || !ivHex) return '';
  
  try {
    const iv = Buffer.from(ivHex, 'hex');
    const encryptedText = Buffer.from(encryptedData, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
    
    let decrypted = decipher.update(encryptedText);
    // Node Typescript compilation needs explicit cast or arguments
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted.toString('utf8');
  } catch (error) {
    console.error('Error al desencriptar datos:', error);
    return '[Error al descifrar el registro - Clave inválida o corrupta]';
  }
}
