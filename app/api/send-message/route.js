import { NextResponse } from 'next/server';

export async function POST(request) {
    try {
        const { to, message } = await request.json();

        const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
        const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

        if (!accessToken || !phoneNumberId) {
            return NextResponse.json(
                { success: false, error: 'WhatsApp not configured. Set env vars in Vercel.' },
                { status: 500 }
            );
        }

        // Format phone number
        let phone = (to || '').replace(/[^0-9]/g, '');
        if (phone.length === 10) phone = '91' + phone;

        const res = await fetch(
            `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',
                    to: phone,
                    type: 'text',
                    text: { body: message || 'Hello from Fasal Charcha!' },
                }),
            }
        );

        const data = await res.json();

        if (data.messages && data.messages[0]) {
            return NextResponse.json({
                success: true,
                message: 'Text message sent!',
                phone,
                message_id: data.messages[0].id,
            });
        } else {
            return NextResponse.json({
                success: false,
                error: data.error?.message || 'Unknown WhatsApp API error',
                details: data,
            });
        }
    } catch (err) {
        return NextResponse.json(
            { success: false, error: err.message },
            { status: 500 }
        );
    }
}
