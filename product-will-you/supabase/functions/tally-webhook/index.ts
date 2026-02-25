// supabase/functions/tally-webhook/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload = await req.json()
    console.log("Webhook received!", payload)

    // 1. Initialize Supabase Client (Keys are auto-injected in the cloud!)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 2. Helper to find answer by Question Label
    const getAnswer = (labelMatch: string) => {
      const fields = payload.data?.fields || payload.fields || [];
      const field = fields.find((f: any) => 
        f.label && f.label.toLowerCase().includes(labelMatch.toLowerCase())
      )
      
      if (!field) return null;

      // If it's a dropdown, find the text matching the selected ID
      if (field.type === 'DROPDOWN' || field.type === 'MULTIPLE_CHOICE') {
        const selectedId = Array.isArray(field.value) ? field.value[0] : field.value;
        const option = field.options?.find((opt: any) => opt.id === selectedId);
        return option ? option.text : null;
      }

      // Otherwise, return normal text/array
      return field.value;
    }

    // 3. Extract Data 
    const recipientName = getAnswer("Partner's Name") || "My Love"
    const senderName = getAnswer("Your Name") || "Secret Admirer"
    const questionTypeRaw = getAnswer("occasion") || "Valentine's Day" 
    const musicVibeRaw = getAnswer("Music Vibe") || "Romantic"
    const loveNote = getAnswer("short note") || ""
    const startDate = getAnswer("When did you meet") || null 
    const email = getAnswer("Email Address") || ""

        // Safely lowercase the strings now that we know they are strings
    const questionType = String(questionTypeRaw).toLowerCase()
    const musicVibe = String(musicVibeRaw).toLowerCase()
    
    // 4. Handle File Uploads and Captions (Memories)
    const memories = [];
    
    // Assuming your form has up to 5 photo upload slots. 
    // Increase this number if you added "Upload Photo 6", etc.
    for (let i = 1; i <= 5; i++) {
      const photoField = getAnswer(`Upload Photo ${i}`);
      const captionField = getAnswer(`Caption for Photo ${i}`);
      
      // Tally sends file uploads as an array. We check if it exists and has a file.
      if (photoField && Array.isArray(photoField) && photoField.length > 0) {
        memories.push({
          url: photoField[0].url,      // Extracts the actual image URL
          caption: captionField || ""  // Pairs it with the matching caption
        });
      }
    }

    // 5. Insert into Supabase
    const { data, error } = await supabaseClient
      .from('gifts')
      .insert([
        {
          recipient_name: recipientName,
          sender_name: senderName,
          question_type: questionType,
          music_vibe: musicVibe,
          love_note: loveNote,
          start_date: startDate,
          sender_email: email,
          memories: memories, 
          payment_status: 'pending', 
        }
      ])
      .select()

    if (error) throw error

    return new Response(
      JSON.stringify({ success: true, gift_id: data[0].id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error(error)
    return new Response(
      JSON.stringify({ error: error.message || String(error) }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})