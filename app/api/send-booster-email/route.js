// API endpoint to send email for booster request
// Uses Roamjet API (smtp.roamjet.net) same as web app

export async function POST(request) {
  try {
    const requestBody = await request.json();
    const { 
      coachEmail,
      userName,
      userEmail,
      title = '🚀 בקשה להצטרפות לתכנית הבוסטר',
      message = ''
    } = requestBody;

    // Validation
    if (!coachEmail) {
      return Response.json(
        { error: 'Coach email is required' },
        { status: 400 }
      );
    }

    // Use Roamjet API to send email
    const roamjetProjectId = process.env.ROAMJET_PROJECT_ID || 'eZl22S3z7Pl0oGA01qyH';
    const roamjetTemplateId = process.env.ROAMJET_TEMPLATE_ID || 'lbbVwGT1BLMw87C3oHbI';
    
    // Build email message
    const emailTitle = title;
    const emailText = message || `המתאמן/ת ${userName || userEmail} מבקש/ת להצטרף לתכנית הבוסטר.`;

    // Send email via Roamjet API
    const roamjetUrl = new URL('https://smtp.roamjet.net/api/email/send');
    roamjetUrl.searchParams.set('email', coachEmail);
    roamjetUrl.searchParams.set('project_id', roamjetProjectId);
    roamjetUrl.searchParams.set('template_id', roamjetTemplateId);
    roamjetUrl.searchParams.set('title', emailTitle);
    roamjetUrl.searchParams.set('text', emailText);

    console.log('📧 Sending booster request email to:', coachEmail);

    const roamjetRes = await fetch(roamjetUrl.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const emailRes = await roamjetRes.json();

    if (roamjetRes.ok) {
      console.log('✅ Booster request email sent successfully:', emailRes);
      return Response.json({
        success: true,
        messageId: emailRes.messageId || 'sent',
        email: coachEmail
      });
    } else {
      console.error('❌ Email send failed:', emailRes);
      return Response.json(
        {
          success: false,
          error: emailRes.error || 'Failed to send email'
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('❌ Booster email API error:', error);
    return Response.json(
      {
        success: false,
        error: 'Internal server error',
        details: error.message
      },
      { status: 500 }
    );
  }
}
