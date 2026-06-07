// Google Ads Sync Module
// Creates search/text ad campaigns for real estate properties.
// Uses the Google Ads API (v16+).
// Docs: https://developers.google.com/google-ads/api/docs/start
//
// Required: Google Ads Developer Token, Client Customer ID,
// OAuth2 refresh token, and Client ID + Client Secret.
//
// The access token is stored in the integrations collection under `googleAds.token`.
// Additional config (customerId, developerToken) should be in `googleAds.config`.

const GOOGLE_ADS_API = 'https://googleads.googleapis.com/v16';

interface GoogleAdsConfig {
  accessToken: string;
  developerToken: string;
  customerId: string; // e.g. "1234567890" (no dashes)
}

export async function createGoogleAdCampaign(
  property: any,
  copyText: string,
  config: GoogleAdsConfig
): Promise<{ campaignId?: string; error?: string }> {
  try {
    const { accessToken, developerToken, customerId } = config;
    const customerPath = `customers/${customerId}`;

    // Step 1: Create Campaign
    const campaignBody = {
      name: `InmoCRM - ${property.title?.substring(0, 30) || 'Propiedad'}`,
      status: 'PAUSED',
      advertisingChannelType: 'SEARCH',
      biddingStrategyConfiguration: {
        biddingStrategyType: 'TARGET_CPA',
      },
      budget: {
        budgetId: '0', // Will be created below
      },
    };

    // Budget creation
    const budgetRes = await fetch(
      `${GOOGLE_ADS_API}/${customerPath}/campaignBudgets:mutate`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'developer-token': developerToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          operations: [{
            create: {
              name: `Budget - ${property.title?.substring(0, 20)}`,
              amountMicros: 5000000, // 5 ARS/day in micros
              deliveryMethod: 'STANDARD',
            },
          }],
        }),
      }
    );

    if (!budgetRes.ok) {
      const err = await budgetRes.text();
      console.error('[GoogleAds] Budget error:', err);
      return { error: `Budget: ${err}` };
    }

    const budgetData = await budgetRes.json();
    const budgetId = budgetData.results?.[0]?.resourceName;

    // Complete campaign with budget
    const campaignRes = await fetch(
      `${GOOGLE_ADS_API}/${customerPath}/campaigns:mutate`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'developer-token': developerToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          operations: [{
            create: {
              ...campaignBody,
              campaignBudget: budgetId,
            },
          }],
        }),
      }
    );

    if (!campaignRes.ok) {
      const err = await campaignRes.text();
      console.error('[GoogleAds] Campaign error:', err);
      return { error: `Campaign: ${err}` };
    }

    const campaignData = await campaignRes.json();
    const campaignId = campaignData.results?.[0]?.resourceName;

    // Step 2: Create Ad Group
    const adGroupRes = await fetch(
      `${GOOGLE_ADS_API}/${customerPath}/adGroups:mutate`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'developer-token': developerToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          operations: [{
            create: {
              name: `AdGroup - ${property.title?.substring(0, 20)}`,
              campaign: campaignId,
              status: 'PAUSED',
              type: 'SEARCH_STANDARD',
              cpcBidMicros: 1000000, // 1 ARS CPC
            },
          }],
        }),
      }
    );

    if (!adGroupRes.ok) {
      console.error('[GoogleAds] AdGroup error:', await adGroupRes.text());
      // Campaign created but ad group failed — log and continue
      return { campaignId, error: 'AdGroup creation failed' };
    }

    const adGroupData = await adGroupRes.json();
    const adGroupId = adGroupData.results?.[0]?.resourceName;

    // Step 3: Create Expanded Text Ad
    const headlines = property.title
      ? [property.title.substring(0, 30), property.city || 'Argentina', 'Venta']
      : ['Propiedad en Venta', 'Excelente Ubicación', 'Contactanos'];

    const adRes = await fetch(
      `${GOOGLE_ADS_API}/${customerPath}/adGroupAds:mutate`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'developer-token': developerToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          operations: [{
            create: {
              adGroup: adGroupId,
              status: 'PAUSED',
              ad: {
                finalUrls: [property.portalUrl || 'https://inmocrm.com'],
                headlines: headlines.slice(0, 3).map(h => ({ text: h })),
                descriptions: [
                  { text: (copyText || property.description || '').substring(0, 90) },
                  { text: `Precio: $${property.price?.toLocaleString() || 'Consultar'} ${property.currency || 'USD'}` },
                ],
              },
            },
          }],
        }),
      }
    );

    if (!adRes.ok) {
      console.error('[GoogleAds] Ad error:', await adRes.text());
      return { campaignId, error: 'Ad creation failed' };
    }

    console.log(`[GoogleAds] Campaign created: ${campaignId} (paused)`);
    return { campaignId };
  } catch (e: any) {
    console.error('[GoogleAds] Exception:', e);
    return { error: e.message };
  }
}

export async function pauseGoogleAdCampaign(
  campaignResourceName: string,
  config: GoogleAdsConfig
): Promise<{ success: boolean; error?: string }> {
  try {
    const { accessToken, developerToken, customerId } = config;
    const res = await fetch(
      `${GOOGLE_ADS_API}/customers/${customerId}/campaigns:mutate`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'developer-token': developerToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          operations: [{
            update: { resourceName: campaignResourceName, status: 'PAUSED' },
            updateMask: 'status',
          }],
        }),
      }
    );
    if (!res.ok) {
      const err = await res.text();
      return { success: false, error: err };
    }
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
