const pool = require('./config/database');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function createAdmin() {
    const email = 'admin@gmail.com';
    const password = 'admin@123456';
    const fullName = 'System Admin';

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        // تعديل: غيرت "password" لـ "password_hash"
        const query = `
            INSERT INTO users (full_name, email, password_hash, role)
            VALUES ($1, $2, $3, 'admin')
            ON CONFLICT (email) DO NOTHING
            RETURNING id;
        `;

        const res = await pool.query(query, [fullName, email, hashedPassword]);

        if (res.rows.length > 0) {
            console.log('✅ Admin account created successfully!');
            console.log('Email: admin@rased.com | Password: admin123');
        } else {
            console.log('⚠️ User already exists or check column names.');
        }
    } catch (err) {
        console.error('❌ Error creating admin:', err.message);
        console.log('💡 Tip: If you still get an error, check your table structure in pgAdmin.');
    } finally {
        await pool.end();
    }
}

createAdmin();