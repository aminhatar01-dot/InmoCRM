// Zonaprop Sync Module
// Zonaprop is one of Argentina's major real estate classifieds portals.
// They offer a B2B integration via XML feed (Zonaprop Data Feed) or REST API.
//
// This module implements the REST API structure.
// To activate, the agent must provide their API credentials in Settings → Portals.

const ZONAPROP_API_URL = 'https://api.zonaprop.com/v1';

export async function publishToZonaprop(property: any, apiKey: string): Promise<{ success: boolean; error?: string }> {
  try {
    const payload = {
      operation: property.status === 'alquilada' ? 'rent' : 'sell',
      property_type: mapZonapropType(property.type),
      title: property.title || '',
      description: property.description || '',
      price: property.price || 0,
      currency: property.currency || 'USD',
      address: property.address || '',
      city: property.city || '',
      bedrooms: property.bedrooms || 0,
      bathrooms: property.bathrooms || 0,
      area_sqm: property.areaSqM || 0,
      images: (property.images || []),
      latitude: property.lat || undefined,
      longitude: property.lng || undefined,
    };

    const response = await fetch(`${ZONAPROP_API_URL}/listings`, {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[Zonaprop] Publish error:', response.status, err);
      return { success: false, error: `Zonaprop API error ${response.status}` };
    }

    const data = await response.json();
    console.log(`[Zonaprop] Property published: ${data.id}`);
    return { success: true };
  } catch (e: any) {
    console.error('[Zonaprop] Publish exception:', e);
    return { success: false, error: e.message };
  }
}

export async function updateZonapropListing(
  externalId: string,
  property: any,
  apiKey: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const payload = {
      operation: property.status === 'alquilada' ? 'rent' : 'sell',
      property_type: mapZonapropType(property.type),
      title: property.title || '',
      description: property.description || '',
      price: property.price || 0,
      currency: property.currency || 'USD',
      address: property.address || '',
      city: property.city || '',
      bedrooms: property.bedrooms || 0,
      bathrooms: property.bathrooms || 0,
      area_sqm: property.areaSqM || 0,
      images: (property.images || []),
      latitude: property.lat || undefined,
      longitude: property.lng || undefined,
    };

    const response = await fetch(`${ZONAPROP_API_URL}/listings/${externalId}`, {
      method: 'PUT',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[Zonaprop] Update error:', response.status, err);
      return { success: false, error: `Zonaprop API error ${response.status}` };
    }

    console.log(`[Zonaprop] Listing ${externalId} updated`);
    return { success: true };
  } catch (e: any) {
    console.error('[Zonaprop] Update exception:', e);
    return { success: false, error: e.message };
  }
}

function mapZonapropType(inmoType: string): string {
  const map: Record<string, string> = {
    casa: 'house',
    departamento: 'apartment',
    terreno: 'land',
    local: 'commercial',
    oficina: 'office',
  };
  return map[inmoType] || 'house';
}
