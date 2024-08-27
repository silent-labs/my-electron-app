const crypto = require('crypto');

process.on('message', (message) => {
  if (message.type === 'encrypt') {
    const encryptedData = encryptData(message.data, message.password);
    process.send({ type: 'encryptResult', data: encryptedData });
  } else if (message.type === 'decrypt') {
    const decryptedData = decryptData(message.data, message.password);
    process.send({ type: 'decryptResult', data: decryptedData });
  }
});

function encryptData(data, password) {
  const algorithm = 'aes-256-cbc';
  const key = crypto.scryptSync(password, 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decryptData(encryptedData, password) {
  const algorithm = 'aes-256-cbc';
  const [ivHex, encryptedHex] = encryptedData.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const key = crypto.scryptSync(password, 'salt', 32);
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}