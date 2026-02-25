// supabase/functions/razorpay-webhook/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// Helper to securely verify the Razorpay signature
async function verifySignature(bodyText: string, signature: string, secret: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const hashBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(bodyText));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex === signature;
}

serve(async (req) => {
  try {
    // 1. Get the raw text body (required for signature verification)
    const rawBody = await req.text();
    const body = JSON.parse(rawBody);
    
    // 2. Security Check: Verify Razorpay Signature
    const signature = req.headers.get('x-razorpay-signature');
    const secret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET');

    if (!signature || !secret) {
      console.error("Missing signature or secret.");
      return new Response("Unauthorized", { status: 401 });
    }

    const isValid = await verifySignature(rawBody, signature, secret);
    if (!isValid) {
      console.error("Invalid Razorpay signature. Potential spoofing attempt.");
      return new Response("Unauthorized", { status: 401 });
    }

    // 3. Process the Payment Event
    // We only care if the payment was captured successfully
    if (body.event === 'payment.captured') {
      const email = body.payload.payment.entity.email;
      console.log(`Processing successful payment for: ${email}`);

      // Initialize Supabase Admin Client
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      // STEP A: Find the exact ID of the most recent pending gift for this email
      const { data: pendingGifts, error: searchError } = await supabaseClient
        .from('gifts')
        .select('id')
        .eq('sender_email', email) // Using your exact column name
        .eq('payment_status', 'pending')
        .order('created_at', { ascending: false }) // Newest first
        .limit(1);

      if (searchError) throw searchError;

      if (!pendingGifts || pendingGifts.length === 0) {
        console.log(`No pending gifts found for email: ${email}`);
        return new Response(JSON.stringify({ status: 'ok', note: 'No pending row found' }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const exactGiftId = pendingGifts[0].id;

      // STEP B: Update strictly that one row
      const { data, error: updateError } = await supabaseClient
        .from('gifts')
        .update({ payment_status: 'paid' })
        .eq('id', exactGiftId) // STRICT MATCH
        .select();

      if (updateError) throw updateError;
      
      console.log(`Database updated successfully! Gift ID ${exactGiftId} is now PAID.`);
    } else {
      console.log(`Ignored event type: ${body.event}`);
    }

    // Razorpay expects a 200 OK response quickly
    return new Response(JSON.stringify({ status: 'ok' }), { 
      headers: { 'Content-Type': 'application/json' } 
    });

  } catch (error) {
    console.error("Webhook Error:", error);
    // Even on error, we often return 200 to Razorpay so it doesn't infinitely retry,
    // but 400 helps you debug in the Supabase logs.
    return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  }
})