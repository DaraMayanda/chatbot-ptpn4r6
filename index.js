const { Client, LocalAuth, List } = require('whatsapp-web.js'); // Tambah List di sini
const qrcode = require('qrcode-terminal');
const axios = require('axios');
require('dotenv').config();

// Fungsi klasifikasi kategori keluhan (Tetap pakai kodemu)
function tentukanKategori(keluhan) {
    const teks = keluhan.toLowerCase();
    if (teks.match(/wifi|internet|jaringan|kabel|koneksi|lan/)) return 'Jaringan';
    if (teks.match(/printer|komputer|layar|keyboard|pc|laptop|mouse|tinta/)) return 'Hardware';
    if (teks.match(/aplikasi|error|login|sistem|password|erp|akun/)) return 'Software';
    return 'Lainnya'; 
}

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        handleSIGTERM: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('✅ Bot WhatsApp Ready - Versi Klik & Copy-Paste!');
});


const daftarUnitResmi = [
    "Sekretariat & Hukum",
    "SDM dan Manajemen Sistem",
    "Tanaman",
    "Teknik",
    "Akuntansi dan Keuangan",
    "Pengadaan dan TI"
];

client.on('message', async (msg) => {
    if (msg.from === 'status@broadcast' || msg.from.includes('@g.us') || msg.fromMe) return;

    const text = msg.body;
    const textLower = text.toLowerCase();

    // 1. JIKA USER CHAT "TES" ATAU APA SAJA (Bukan laporan) -> KASIH LIST KLIK
    if (!textLower.includes('nama pelapor:') && !daftarUnitResmi.includes(text)) {
        const rows = daftarUnitResmi.map(unit => ({ title: unit }));
        
        const list = new List(
            'Halo! Selamat datang di Layanan IT PTPN.\nSilakan klik tombol di bawah untuk memilih unit Anda:',
            'Pilih Unit',
            [{ title: 'Daftar Unit Resmi', rows: rows }],
            'Layanan Mandiri IT'
        );

        return client.sendMessage(msg.from, list);
    }

    // 2. JIKA USER KLIK SALAH SATU UNIT -> KASIH FORMAT COPY-PASTE (DENGAN NAMA UNIT TERISI)
    if (daftarUnitResmi.includes(text)) {
        return msg.reply(`Unit terpilih: *${text}*\n\nSilakan *copy-paste* pesan di bawah ini, isi Nama dan Keluhan Anda, lalu kirimkan kembali:\n\nNama Pelapor:\nDetail Gangguan/ keluhan:\nunit / divisi: ${text}`);
    }

    // 3. JIKA USER MENGIRIM FORMAT LAPORAN (Logika awalmu kembali bekerja)
    if (textLower.includes('nama pelapor:') && textLower.includes('detail gangguan')) {
        const baris = text.split('\n');
        let nama = ''; let keluhan = ''; let divisi = '';

        baris.forEach(b => {
            const bLower = b.toLowerCase();
            if (bLower.includes('nama pelapor:')) {
                nama = b.substring(b.indexOf(':') + 1).trim();
            } else if (bLower.includes('detail gangguan') || bLower.includes('keluhan:')) {
                keluhan = b.substring(b.indexOf(':') + 1).trim();
            } else if (bLower.includes('unit') || bLower.includes('divisi')) {
                divisi = b.substring(b.indexOf(':') + 1).trim();
            }
        });

        if (nama && keluhan && divisi) {
            const kategori = tentukanKategori(keluhan);
            await msg.reply(`⏳ *Sedang memproses laporan ke GLPI...*\n\n✅ Data terbaca:\n👤 Nama: ${nama}\n🏢 Unit: ${divisi}\n📝 Keluhan: ${keluhan}\n🏷️ *Kategori:* ${kategori}`);

            try {
                // Kirim ke API GLPI sesuai kodemu
                const response = await axios.post(process.env.GLPI_URL, {
                    nama_pelapor: nama,
                    unit_divisi: divisi,
                    detail_keluhan: keluhan,
                    kategori_sistem: kategori
                }, {
                    headers: {
                        'App-Token': process.env.GLPI_APP_TOKEN,
                        'Authorization': `user_token ${process.env.GLPI_USER_TOKEN}`
                    }
                });

                const nomorTiket = response.data.id || "TEREKAM";
                msg.reply(`✅ *LAPORAN BERHASIL DIBUAT!*\n\n🎫 Nomor Tiket GLPI: *${nomorTiket}*`);
            } catch (error) {
                console.log('❌ Error API:', error.message);
                msg.reply('❌ *Maaf, sistem GLPI sedang tidak dapat dijangkau.*');
            }
        } else {
            msg.reply('❌ Maaf, isian belum lengkap. Pastikan Nama dan Keluhan sudah diisi.');
        }
    }
});

client.initialize();