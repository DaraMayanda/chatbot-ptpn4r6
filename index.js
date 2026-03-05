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

// Inisialisasi WhatsApp Client
const client = new Client({
    authStrategy: new LocalAuth(),
    takeoverOnConflict: true, 
    authTimeoutMs: 60000, 
    puppeteer: {
        handleSIGTERM: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-accelerated-2d-canvas', '--no-first-run', '--no-zygote', '--single-process', '--disable-gpu'],
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36'
    }
});

client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
    console.log('QR Code silakan di-scan...');
});

client.on('ready', () => {
    console.log('✅ Bot WhatsApp Ready - Versi One-Shot Mapping!');
});


const daftarUnit = {
    "1": "Sekretariat & Hukum",
    "2": "SDM dan Manajemen Sistem",
    "3": "Tanaman",
    "4": "Teknik",
    "5": "Akuntansi dan Keuangan",
    "6": "Pengadaan dan TI"
};

client.on('message', async (msg) => {
    if (msg.from === 'status@broadcast' || msg.from.includes('@g.us') || msg.fromMe) return;

    const text = msg.body;
    const textLower = text.toLowerCase();


    if (textLower.includes('nama pelapor:') && (textLower.includes('detail gangguan') || textLower.includes('keluhan:'))) {
        
        const baris = text.split('\n');
        let nama = ''; let keluhan = ''; let kodeDivisi = '';

       
        baris.forEach(b => {
            const bLower = b.toLowerCase();
            if (bLower.includes('nama pelapor:')) {
                nama = b.substring(b.indexOf(':') + 1).trim();
            } else if (bLower.includes('detail gangguan') || bLower.includes('keluhan:')) {
                keluhan = b.substring(b.indexOf(':') + 1).trim();
            } else if (bLower.includes('unit') || bLower.includes('divisi')) {
               
                kodeDivisi = b.substring(b.indexOf(':') + 1).trim().replace(/[^0-9]/g, ''); 
            }
        });

        if (nama && keluhan && kodeDivisi) {
            
            const divisiAsli = daftarUnit[kodeDivisi];

            if (!divisiAsli) {
                return msg.reply('❌ Angka Unit/Divisi tidak valid. Harap isi kolom Unit/Divisi dengan angka *1 sampai 6* saja.');
            }

            const kategori = tentukanKategori(keluhan);

        
            await msg.reply(`⏳ *Sedang memproses laporan ke GLPI...*\n\n✅ Data terbaca:\n👤 Nama: ${nama}\n🏢 Unit: ${divisiAsli}\n📝 Keluhan: ${keluhan}\n🏷️ *Kategori:* ${kategori}`);

            try {
                // Kirim ke API GLPI
                const response = await axios.post(process.env.GLPI_URL, {
                    nama_pelapor: nama,
                    unit_divisi: divisiAsli, 
                    detail_keluhan: keluhan,
                    kategori_sistem: kategori
                }, {
                    headers: {
                        'App-Token': process.env.GLPI_APP_TOKEN,
                        'Authorization': `user_token ${process.env.GLPI_USER_TOKEN}`
                    }
                });

                const nomorTiket = response.data.id || response.data.ticket_id || "TEREKAM";
                msg.reply(`✅ *LAPORAN BERHASIL DIBUAT!*\n\n🎫 Nomor Tiket GLPI: *${nomorTiket}*\n\nTim IT akan segera menindaklanjuti kendala Anda.`);

            } catch (error) {
                console.log('❌ Error API GLPI:', error.message);
                msg.reply('❌ *Maaf, sistem GLPI sedang tidak dapat dijangkau.* \nMohon hubungi tim IT secara manual.');
            }
        } else {
            msg.reply('❌ Maaf, isian belum lengkap. Pastikan Nama, Keluhan, dan Angka Unit sudah diisi.');
        }

    } else {
        
        msg.reply(`Halo! Selamat datang di Layanan IT PTPN.\n\nUntuk mempermudah pelaporan, silakan *copy-paste* pesan di bawah ini dan isi data Anda.\n\n*Daftar Unit/Divisi:*\n*1*. Sekretariat & Hukum\n*2*. SDM dan Manajemen Sistem\n*3*. Tanaman\n*4*. Teknik\n*5*. Akuntansi dan Keuangan\n*6*. Pengadaan dan TI\n\n--------------------------\n\nNama Pelapor: \nDetail Gangguan: \nUnit / Divisi (Isi dengan Angka 1-6): `);
    }
});

client.initialize();