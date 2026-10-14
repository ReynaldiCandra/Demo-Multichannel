/**
 * Diagnosa koneksi database (aman kredensial).
 *
 * Menjalankan tiga tahap koneksi dengan DATABASE_URL yang sama seperti
 * aplikasi: resolusi DNS, handshake TCP, lalu query Postgres sungguhan lewat
 * driver `postgres` yang sama seperti src/lib/db/index.ts. Kegagalan yang
 * hanya muncul di tahap tertentu langsung menunjukkan penyebabnya (DNS
 * tidak resolve? TCP ditolak? auth/query gagal?).
 *
 * Jalankan: ./node_modules/.bin/tsx scripts/db-ping.ts
 * Hanya menampilkan host & port — TIDAK menampilkan password/URL.
 */
import dotenv from 'dotenv';
import net from 'node:net';
import dns from 'node:dns/promises';
import postgres from 'postgres';

// Aplikasi Next.js membaca `.env.local` otomatis; dotenv default-hanya `.env`,
// jadi diarahkan eksplisit ke `.env.local`.
dotenv.config({ path: '.env.local' });

const redact = (text: string) =>
  text.replace(/\/\/[^@/\s]+@/g, '//[KREDENSIAL-DISEMBUNYIKAN]@').slice(0, 400);

const probeTcp = (address: string, probePort: number) =>
  new Promise<string>((resolve) => {
    const socket = net.connect({ host: address, port: probePort, timeout: 8000 });
    socket.on('connect', () => {
      socket.destroy();
      resolve(`TCP OK ke ${address}`);
    });
    socket.on('error', (error) =>
      resolve(`TCP GAGAL ke ${address}: ${'code' in error ? error.code : error.message}`),
    );
    socket.on('timeout', () => {
      socket.destroy();
      resolve(`TCP TIMEOUT ke ${address}`);
    });
  });

async function main() {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    console.log('DATABASE_URL tidak terbaca dari .env.local / environment.');
    process.exit(1);
  }

  let host = '?';
  let port = 5432;
  try {
    const url = new URL(raw);
    host = url.hostname;
    port = Number(url.port) || 5432;
  } catch {
    console.log('DATABASE_URL bukan format connection string yang valid.');
    process.exit(1);
  }

  console.log(`Tahap 1 — DNS: ${host}:${port}`);
  const addresses = await dns.lookup(host, { all: true }).catch((error) => {
    console.log(`  DNS GAGAL: ${error.code ?? error.message}`);
    return [];
  });
  for (const address of addresses) {
    console.log(`  resolve → ${address.address} (family ${address.family})`);
  }

  console.log('Tahap 2 — Handshake TCP:');
  const tcpResults = await Promise.all(addresses.map((address) => probeTcp(address.address, port)));
  for (const result of tcpResults) console.log(`  ${result}`);

  console.log('Tahap 3 — Query Postgres (driver postgres, seperti aplikasi):');
  const client = postgres(raw, { prepare: false, max: 1, connect_timeout: 8 });
  try {
    const rows = await client`select version() as version`;
    console.log(`  Query OK → ${String(rows[0]?.version).slice(0, 60)}`);
  } catch (error) {
    const e = error as { code?: string; message?: string; severity?: string };
    console.log(`  Query GAGAL → code=${e.code ?? '-'} severity=${e.severity ?? '-'}`);
    console.log(`  pesan: ${redact(e.message ?? '')}`);
  } finally {
    await client.end();
  }
}

main();
