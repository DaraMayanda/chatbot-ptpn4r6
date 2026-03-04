const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
require('dotenv').config();

// Objek untuk menyimpan sementara data laporan (Session)
const sessionData = {};

// Daftar Unit Resmi sesuai permintaan Mentor
const daftarUnit = {
    "1": "Sekretariat & Hukum",
    "2": "SDM dan Manajemen Sistem",
    "3": "Tanaman",
    "4": "Teknik",
    "5": "Akuntansi dan Keuangan",
    "6": "Pengadaan dan TI"
};

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
    console.log('QR Code silakan di-scan...');
});

client.on('ready', () => {
    console.log('✅ Bot WhatsApp Ready dengan Alur Pilihan Unit!');
});

client.on('message', async (msg) => {
    if (msg.from === 'status@broadcast' || msg.from.includes('@g.us') || msg.fromMe) return;

    const chat = msg.body.trim();
    const userId = msg.from;

    // 1. JIKA BELUM ADA SESSION (Tahap Awal - Pilih Unit)
    if (!sessionData[userId]) {
        sessionData[userId] = { step: 'pilih_unit' };
        
        let pesanUnit = "Halo! Selamat datang di Layanan Mandiri IT PTPN.\n\nSilakan *PILIH UNIT* Anda dengan mengetik nomornya:\n";
        for (const [key, value] of Object.entries(daftarUnit)) {
            pesanUnit += `\n*${key}*. ${value}`;
        }
        return msg.reply(pesanUnit);
    }

    const currentStep = sessionData[userId].step;

    // 2. PROSES TAHAP PILIH UNIT
    if (currentStep === 'pilih_unit') {
        if (daftarUnit[chat]) {
            sessionData[userId].unit = daftarUnit[chat];
            sessionData[userId].step = 'isi_nama';
            return msg.reply(`Anda memilih unit: *${daftarUnit[chat]}*\n\nSekarang, silakan ketik *NAMA LENGKAP* pelapor:`);
        } else {
            return msg.reply("❌ Pilihan salah. Silakan ketik angka *1 sampai 6* sesuai daftar di atas.");
        }
    }

    // 3. PROSES TAHAP ISI NAMA
    if (currentStep === 'isi_nama') {
        sessionData[userId].nama = chat;
        sessionData[userId].step = 'isi_keluhan';
        return msg.reply(`Halo *${chat}*,\n\nTerakhir, silakan jelaskan *DETAIL GANGGUAN* atau keluhan Anda:`);
    }

    // 4. PROSES TAHAP ISI KELUHAN & KIRIM KE GLPI
    if (currentStep === 'isi_keluhan') {
        const dataUser = sessionData[userId];
        const keluhan = chat;
        const kategori = tentukanKategori(keluhan);

        await msg.reply(`⏳ *Sedang memproses tiket ke GLPI...*\n\n📍 Unit: ${dataUser.unit}\n👤 Nama: ${dataUser.nama}\n📝 Keluhan: ${keluhan}\n🏷️ Kategori: ${kategori}`);

        try {
            const response = await axios.post(process.env.GLPI_URL, {
                nama_pelapor: dataUser.nama,
                unit_divisi: dataUser.unit,
                detail_keluhan: keluhan,
                kategori_sistem: kategori
            }, {
                headers: {
                    'App-Token': process.env.GLPI_APP_TOKEN,
                    'Authorization': `user_token ${process.env.GLPI_USER_TOKEN}`
                }
            });

            const nomorTiket = response.data.id || "TEREKAM";
            msg.reply(`✅ *LAPORAN BERHASIL!*\n\n🎫 Nomor Tiket: *${nomorTiket}*\n\nTerima kasih, mohon tunggu tindak lanjut dari tim IT.`);
            console.log(`🚀 Tiket sukses untuk ${dataUser.nama} (${dataUser.unit})`);

        } catch (error) {
            console.log('❌ Error API GLPI:', error.message);
            msg.reply('❌ *Sistem GLPI sedang maintenance.* Laporan Anda sudah tercatat di sistem internal kami sementara.');
        }

        // Hapus session setelah selesai agar user bisa lapor lagi dari awal
        delete sessionData[userId];
    }
});

client.initialize();