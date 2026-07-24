import dotenv from 'dotenv';
import sgMail from '@sendgrid/mail';

// Підтягуємо змінні з .env
dotenv.config();

// Підключаємо ключ
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const sendTest = async () => {
    const msg = {
        to: 'mksmballa@gmail.com', // Впиши сюди свою реальну скриньку, щоб перевірити доставку
        from: process.env.DEFAULT_SENDER_EMAIL || process.env.SENDER_EMAIL || 'your-email@domain.com', // Адреса відправника з .env
        subject: 'Тестовий запуск Serrvvice SaaS 🚀',
        text: 'Привіт! Якщо ти читаєш це, значить SendGrid налаштовано ідеально.',
        html: '<strong>Привіт!</strong><br>Якщо ти читаєш це, значить SendGrid налаштовано ідеально і ми готові пиляти UI.',
    };

    try {
        await sgMail.send(msg);
        console.log('✅ Тестовий лист успішно відправлено! Перевіряй пошту.');
    } catch (error) {
        console.error('❌ Помилка відправки:', error.response ? error.response.body : error);
    }
};

sendTest();