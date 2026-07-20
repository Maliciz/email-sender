import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false }
});

async function testConnection() {
    try {
        console.log('⏳ Пробуємо підключитися до Google Cloud SQL...');
        const res = await pool.query('SELECT NOW() as time, current_database() as db');
        
        console.log('✅ Підключення успішне!');
        console.log(`База: ${res.rows[0].db}, Час на сервері: ${res.rows[0].time}`);
        
        // Перевіряємо, чи бачить код твою таблицю
        const tableRes = await pool.query("SELECT count(*) FROM contacts");
        console.log(`✅ Таблиця 'contacts' знайдена. Зараз у ній записів: ${tableRes.rows[0].count}`);
        
        process.exit(0);
    } catch (err) {
        console.error('❌ Помилка підключення:', err.message);
        process.exit(1);
    }
}

testConnection();