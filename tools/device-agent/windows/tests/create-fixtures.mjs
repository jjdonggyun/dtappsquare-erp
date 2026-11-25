import { mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const openssl = process.argv[2];
const fixture = path.resolve('output/device-agent-tests/fixture');
mkdirSync(fixture, { recursive: true });
function run(args) {
  const result = spawnSync(openssl, args, { encoding: 'utf8', windowsHide: true, timeout: 30_000 });
  if (result.error || result.status !== 0) throw new Error(result.error?.message ?? result.stderr);
}
run(['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-sha256', '-days', '2', '-keyout', path.join(fixture, 'ca.key'), '-out', path.join(fixture, 'company-root-ca.crt'), '-subj', '/CN=Device Agent Test CA', '-addext', 'basicConstraints=critical,CA:TRUE,pathlen:0', '-addext', 'keyUsage=critical,keyCertSign,cRLSign', '-addext', 'subjectKeyIdentifier=hash']);
run(['req', '-new', '-newkey', 'rsa:2048', '-nodes', '-keyout', path.join(fixture, 'server.key'), '-out', path.join(fixture, 'server.csr'), '-subj', '/CN=127.0.0.1']);
writeFileSync(path.join(fixture, 'server.ext'), 'basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\nsubjectAltName=IP:127.0.0.1\nsubjectKeyIdentifier=hash\nauthorityKeyIdentifier=keyid,issuer\n');
run(['x509', '-req', '-in', path.join(fixture, 'server.csr'), '-CA', path.join(fixture, 'company-root-ca.crt'), '-CAkey', path.join(fixture, 'ca.key'), '-CAcreateserial', '-out', path.join(fixture, 'server.crt'), '-days', '1', '-sha256', '-extfile', path.join(fixture, 'server.ext')]);
run(['x509', '-in', path.join(fixture, 'company-root-ca.crt'), '-outform', 'DER', '-out', path.join(fixture, 'company-root-ca.cer')]);
console.log('Created temporary test certificates under output/device-agent-tests/fixture.');
