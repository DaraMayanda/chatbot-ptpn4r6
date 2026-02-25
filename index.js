const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
require('dotenv').config();

// Fungsi klasifikasi kategori keluhan
function tentukanKategori(keluhan) {
    const teks = keluhan.toLowerCase();
    if (teks.match(/wifi|internet|jaringan|kabel|koneksi|lan/)) return 'Jaringan';
    if (teks.match(/printer|komputer|layar|keyboard|pc|laptop|mouse|tinta/)) return 'Hardware';
    if (teks.match(/aplikasi|error|login|sistem|password|erp|akun/)) return 'Software';
    return 'Lainnya'; 
}

// Inisialisasi WhatsApp Client (DIPERBAIKI UNTUK CLOUD/RAILWAY)
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        // Ini kunci biar nggak error 'failed to launch browser' di Linux/Railway
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        // Ini jalur standar Google Chrome di Docker image yang kita pakai
        executablePath: '/usr/bin/google-chrome-stable',
    }
});

client.on('qr', (qr) => {
    // Generate QR di log Railway
    qrcode.generate(qr, { small: true });
    console.log('Scan QR Code di WhatsApp Anda.');
});

client.on('ready', () => {
    console.log('Bot WhatsApp Ready.');
});

// Handle incoming messages
client.on('message', async (msg) => {
    if (msg.from === 'status@broadcast' || msg.from.includes('@g.us') || msg.fromMe) return;

    const text = msg.body;
    const textLower = text.toLowerCase();

    if (textLower.includes('nama pelapor:') && textLower.includes('detail gangguan')) {
        
        const baris = text.split('\n');
        let nama = ''; let keluhan = ''; let divisi = '';

        baris.forEach(b => {
            const bLower = b.toLowerCase();
            if (bLower.startsWith('nama pelapor:')) {
                nama = b.substring(bLower.indexOf(':') + 1).trim();
            } else if (bLower.includes('detail gangguan') || bLower.includes('keluhan:')) {
                keluhan = b.substring(bLower.indexOf(':') + 1).trim();
            } else if (bLower.includes('unit') || bLower.includes('divisi')) {
                divisi = b.substring(bLower.indexOf(':') + 1).trim();
            }
        });

        if (nama && keluhan && divisi) {
            const kategori = tentukanKategori(keluhan);

            await msg.reply(`⏳ *Sedang memproses laporan ke GLPI...*\n\n✅ Data terbaca:\n👤 Nama: ${nama}\n🏢 Unit: ${divisi}\n📝 Keluhan: ${keluhan}\n🏷️ *Kategori:* ${kategori}`);

            try {
                const glpiUrl = process.env.GLPI_URL;
                const appToken = process.env.GLPI_APP_TOKEN;
                const userToken = process.env.GLPI_USER_TOKEN;

                const response = await axios.post(glpiUrl, {
                    nama_pelapor: nama,
                    unit_divisi: divisi,
                    detail_keluhan: keluhan,
                    kategori_sistem: kategori
                }, {
                    headers: {
                        'App-Token': appToken,
                        'Authorization': `user_token ${userToken}`
                    }
                });

                const nomorTiket = response.data.id || response.data.ticket_id || "TEREKAM DI SISTEM";

                msg.reply(`✅ *LAPORAN BERHASIL DIBUAT!*\n\n🎫 Nomor Tiket GLPI: *${nomorTiket}*\n\nTim IT akan segera menindaklanjuti kendala Anda.`);
                console.log(`Laporan dari ${nama} berhasil dikirim.`);

            } catch (error) {
                console.log('Error API GLPI:', error.message);
                msg.reply('❌ *Maaf, sistem GLPI sedang tidak dapat dijangkau.* \nMohon hubungi tim IT secara manual.');
            }

        } else {
            msg.reply('❌ Maaf, isian belum lengkap. Pastikan Nama, Keluhan, dan Unit sudah diisi semua.');
        }

    } else {
        msg.reply(`Halo! Untuk mempermudah pelaporan IT, silakan *copy-paste* pesan di bawah ini, isi data Anda, lalu kirimkan kembali:\n\nNama Pelapor:\nDetail Gangguan/ keluhan:\nunit / divisi:`);
    }
});

client.initialize();