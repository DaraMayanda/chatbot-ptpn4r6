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
    webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
    },
    puppeteer: {
        handleSIGTERM: false,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process', 
            '--disable-gpu'
        ],
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36'
    }
});

client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
    console.log('\n-----------------------------------------------------');
    console.log('KLIK LINK DI BAWAH INI UNTUK SCAN QR:');
    console.log(`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qr)}&size=300x300`);
    console.log('-----------------------------------------------------\n');
});

client.on('ready', () => {
    console.log('✅ Bot WhatsApp Ready dan Terhubung!');
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

    const text = msg.body.trim();
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

                const nomorTiket = response.data.id || response.data.ticket_id || "TEREKAM";
                msg.reply(`✅ *LAPORAN BERHASIL DIBUAT!*\n\n🎫 Nomor Tiket GLPI: *${nomorTiket}*\n\nTim IT akan segera menindaklanjuti kendala Anda.`);
                console.log(`🚀 Laporan sukses dikirim ke GLPI untuk ${nama}`);

            } catch (error) {
                console.log('❌ Error API GLPI:', error.message);
                msg.reply('❌ *Maaf, sistem GLPI sedang tidak dapat dijangkau.* \nMohon hubungi tim IT secara manual.');
            }
        } else {
            msg.reply('❌ Maaf, isian belum lengkap. Pastikan Nama, Keluhan, dan Unit sudah diisi semua.');
        }
        return; 
    }

    
    if (daftarUnit[text]) {
        const namaUnit = daftarUnit[text];
        return msg.reply(`Terima kasih. Silakan *copy-paste* pesan di bawah ini, isi Nama dan Keluhan Anda, lalu kirimkan kembali:\n\nNama Pelapor: \nDetail Gangguan: \nUnit / Divisi: ${namaUnit}`);
    }

    
    let pesanMenu = "Halo! Selamat datang di Layanan IT PTPN.\n\nSesuai prosedur, silakan pilih *Unit/Divisi* Anda dengan membalas *ANGKA* di bawah ini:\n";
    for (const [key, value] of Object.entries(daftarUnit)) {
        pesanMenu += `\n*${key}*. ${value}`;
    }
    msg.reply(pesanMenu);
});

client.initialize();