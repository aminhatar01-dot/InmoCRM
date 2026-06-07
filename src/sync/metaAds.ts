// Meta Ads Sync Module
// Creates Facebook/Instagram ad campaigns for new properties.
// Uses the Meta Marketing API (v18.0+).
// Docs: https://developers.facebook.com/docs/marketing-apis/
//
// Required: A Meta access token with ads_management permission,
// an Ad Account ID, and a Facebook Page ID.
//
// The access token is stored in the integrations collection under `metaAds.token`.

const META_API_BASE = 'https://graph.facebook.com/v19.0';

interface MetaAdConfig {
  accessToken: string;
  adAccountId: string;
  pageId: string;
}

export async function createMetaAdCampaign(
  property: any,
  copyText: string,
  config: MetaAdConfig
): Promise<{ campaignId?: string; error?: string }> {
  try {
    const { accessToken, adAccountId, pageId } = config;
    const adAccountFormatted = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;

    // Step 1: Create Campaign
    const campaignRes = await fetch(`${META_API_BASE}/${adAccountFormatted}/campaigns`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `InmoCRM - ${property.title?.substring(0, 40) || 'Propiedad'}`,
        objective: 'REACH',
        status: 'PAUSED', // Start paused so agent can review
        special_ad_categories: ['HOUSING'], // Required for real estate in some regions
      }),
    });
    if (!campaignRes.ok) {
      const err = await campaignRes.text();
      console.error('[MetaAds] Campaign creation error:', err);
      return { error: `Campaign: ${err}` };
    }
    const campaign = await campaignRes.json();

    // Step 2: Create Ad Set
    const adSetRes = await fetch(`${META_API_BASE}/${adAccountFormatted}/adsets`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `Ad Set - ${property.title?.substring(0, 30)}`,
        campaign_id: campaign.id,
        status: 'PAUSED',
        billing_event: 'IMPRESSIONS',
        optimization_goal: 'REACH',
        daily_budget: 500, // ARS cents = 5 ARS/day default
        targeting: {
          geo_locations: {
            countries: ['AR'],
            ...(property.city ? { cities: [{ key: property.city }] } : {}),
          },
          age_min: 25,
          age_max: 65,
        },
        start_time: new Date().toISOString(),
      }),
    });
    if (!adSetRes.ok) {
      const err = await adSetRes.text();
      console.error('[MetaAds] AdSet creation error:', err);
      return { error: `AdSet: ${err}` };
    }
    const adSet = await adSetRes.json();

    // Step 3: Create Ad Creative
    const creativeRes = await fetch(`${META_API_BASE}/${adAccountFormatted}/adcreatives`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `Creative - ${property.title?.substring(0, 30)}`,
        object_story_spec: {
          page_id: pageId,
          link_data: {
            message: copyText?.substring(0, 200) || `¡Excelente propiedad en venta! ${property.title}`,
            link: property.portalUrl || 'https://inmocrm.com',
            name: property.title?.substring(0, 40),
            description: property.description?.substring(0, 100) || property.title || '',
            ...(property.images?.length > 0 ? { picture: property.images[0] } : {}),
          },
        },
      }),
    });
    if (!creativeRes.ok) {
      const err = await creativeRes.text();
      console.error('[MetaAds] Creative creation error:', err);
      return { error: `Creative: ${err}` };
    }
    const creative = await creativeRes.json();

    // Step 4: Create Ad
    const adRes = await fetch(`${META_API_BASE}/${adAccountFormatted}/ads`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `Ad - ${property.title?.substring(0, 30)}`,
        adset_id: adSet.id,
        creative: { creative_id: creative.id },
        status: 'PAUSED',
      }),
    });
    if (!adRes.ok) {
      const err = await adRes.text();
      console.error('[MetaAds] Ad creation error:', err);
      return { error: `Ad: ${err}` };
    }

    console.log(`[MetaAds] Campaign created: ${campaign.id} (paused — review in Meta Ads Manager)`);
    return { campaignId: campaign.id };
  } catch (e: any) {
    console.error('[MetaAds] Exception:', e);
    return { error: e.message };
  }
}

export async function pauseMetaAdCampaign(
  campaignId: string,
  accessToken: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${META_API_BASE}/${campaignId}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PAUSED' }),
    });
    if (!res.ok) {
      const err = await res.text();
      return { success: false, error: err };
    }
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function resumeMetaAdCampaign(
  campaignId: string,
  accessToken: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${META_API_BASE}/${campaignId}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ACTIVE' }),
    });
    if (!res.ok) {
      const err = await res.text();
      return { success: false, error: err };
    }
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
