// AES-GCM 256 加解密 + PBKDF2 密钥派生
// 用于敏感配置项的加密存储（D1 kbox_kv 表）
//
// 主密钥 = 用户 KBOX_TOKEN（= ACCESS_TOKEN = D1_API_TOKEN）
// 派生方式 = PBKDF2(password, salt, 100000 iterations, 256 bits)
// 不直接用 token 当密钥，加 salt 防彩虹表

const PBKDF2_ITERATIONS = 100000;
const KEY_LENGTH = 256; // bits
const IV_LENGTH = 12;   // bytes（AES-GCM 推荐 12 字节）

// 加密结果格式（存入 D1 的 value 字段）
interface EncryptedPayload {
  encrypted: true;
  salt: string;   // base64
  iv: string;     // base64
  data: string;   // base64 密文 + auth tag
}

// 判断是否为加密格式
export function isEncrypted(value: any): boolean {
  return value && typeof value === 'object' && value.encrypted === true
    && typeof value.salt === 'string' && typeof value.iv === 'string' && typeof value.data === 'string';
}

// base64 ↔ Uint8Array 转换
function bufToB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function b64ToBuf(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// 用 password + salt 派生 AES-GCM 密钥
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

// 加密：返回可存入 D1 的 JSON 对象
export async function encrypt(password: string, plaintext: string): Promise<EncryptedPayload> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await deriveKey(password, salt);
  const enc = new TextEncoder();
  const cipherBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plaintext)
  );
  return {
    encrypted: true,
    salt: bufToB64(salt),
    iv: bufToB64(iv),
    data: bufToB64(cipherBuf),
  };
}

// 解密：传入加密对象，返回明文
export async function decrypt(password: string, payload: EncryptedPayload): Promise<string> {
  const salt = b64ToBuf(payload.salt);
  const iv = b64ToBuf(payload.iv);
  const data = b64ToBuf(payload.data);
  const key = await deriveKey(password, salt);
  const plainBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );
  const dec = new TextDecoder();
  return dec.decode(plainBuf);
}
