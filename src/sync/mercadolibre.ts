// Mercado Libre Sync Module
// API docs: https://developers.mercadolibre.com.ar/

const ML_API_BASE = 'https://api.mercadolibre.com';

// Map InmoCRM property types to Mercado Libre category IDs (MLA = Argentina)
const CATEGORY_MAP: Record<string, string> = {
  casa: 'MLA1459',          // Casas
  departamento: 'MLA1460',  // Departamentos
  terreno: 'MLA1462',       // Terrenos
  local: 'MLA1463',         // Locales comerciales
  oficina: 'MLA1464',       // Oficinas
};

// Map InmoCRM status to Mercado Libre listing status
function mapStatus(inmoStatus: string): 'active' | 'paused' | 'closed' {
  switch (inmoStatus) {
    case 'disponible': return 'active';
    case 'reservada': return 'paused';
    case 'vendida': return 'closed';
    case 'alquilada': return 'closed';
    default: return 'active';
  }
}

function mapPropertyType(inmoType: string): string {
  return CATEGORY_MAP[inmoType] || 'MLA1459';
}

export async function publishToMercadoLibre(property: any, accessToken: string): Promise<{ id?: string; error?: string }> {
  try {
    const categoryId = mapPropertyType(property.type);
    const body: any = {
      title: property.title?.substring(0, 60) || 'Propiedad en venta',
      category_id: categoryId,
      price: property.price || 0,
      currency_id: property.currency || 'USD',
      available_quantity: 1,
      listing_type_id: 'gold_special',
      pictures: (property.images || []).map((url: string) => ({ source: url })),
      attributes: [
        { id: 'BEDROOMS', value_name: `${property.bedrooms || 0}` },
        { id: 'BATHROOMS', value_name: `${property.bathrooms || 0}` },
        { id: 'FULL_AREA', value_name: `${property.areaSqM || 0} m²` },
      ],
      description: { plain_text: property.description || property.title || '' },
      location: {
        address_line: property.address || '',
        city: { name: property.city || 'Capital Federal' },
      },
    };

    const response = await fetch(`${ML_API_BASE}/items`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[MercadoLibre] Publish error:', response.status, err);
      return { error: `ML API error ${response.status}: ${err}` };
    }

    const data = await response.json();
    console.log(`[MercadoLibre] Property published: ${data.id} (${data.permalink})`);
    return { id: data.id };
  } catch (e: any) {
    console.error('[MercadoLibre] Publish exception:', e);
    return { error: e.message };
  }
}

export async function updateMercadoLibreListing(
  mlItemId: string,
  property: any,
  accessToken: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const categoryId = mapPropertyType(property.type);
    const body: any = {
      title: property.title?.substring(0, 60) || 'Propiedad en venta',
      category_id: categoryId,
      price: property.price || 0,
      currency_id: property.currency || 'USD',
      available_quantity: 1,
      pictures: (property.images || []).map((url: string) => ({ source: url })),
      attributes: [
        { id: 'BEDROOMS', value_name: `${property.bedrooms || 0}` },
        { id: 'BATHROOMS', value_name: `${property.bathrooms || 0}` },
        { id: 'FULL_AREA', value_name: `${property.areaSqM || 0} m²` },
      ],
      description: { plain_text: property.description || property.title || '' },
      location: {
        address_line: property.address || '',
        city: { name: property.city || 'Capital Federal' },
      },
    };

    const response = await fetch(`${ML_API_BASE}/items/${mlItemId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[MercadoLibre] Update error:', response.status, err);
      return { success: false, error: `ML API error ${response.status}` };
    }

    console.log(`[MercadoLibre] Listing ${mlItemId} updated`);
    return { success: true };
  } catch (e: any) {
    console.error('[MercadoLibre] Update exception:', e);
    return { success: false, error: e.message };
  }
}

export async function changeMercadoLibreStatus(
  mlItemId: string,
  inmoStatus: string,
  accessToken: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const mlStatus = mapStatus(inmoStatus);
    const response = await fetch(`${ML_API_BASE}/items/${mlItemId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: mlStatus }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[MercadoLibre] Status change error:', response.status, err);
      return { success: false, error: `ML API error ${response.status}` };
    }

    console.log(`[MercadoLibre] Listing ${mlItemId} status changed to ${mlStatus}`);
    return { success: true };
  } catch (e: any) {
    console.error('[MercadoLibre] Status change exception:', e);
    return { success: false, error: e.message };
  }
}
